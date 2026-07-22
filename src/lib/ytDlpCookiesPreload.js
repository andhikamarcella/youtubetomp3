import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createRequire, syncBuiltinESMExports } from "node:module";

const require = createRequire(import.meta.url);
const childProcess = require("node:child_process");
const originalSpawn = childProcess.spawn.bind(childProcess);

const runtimeDir = join(process.cwd(), ".runtime");
const runtimeBinDir = join(runtimeDir, "bin");
const runtimePythonDir = join(runtimeDir, "python");
if (existsSync(runtimeBinDir)) {
  const currentPath = String(process.env.PATH || "");
  const pathParts = currentPath.split(":").filter(Boolean);
  if (!pathParts.includes(runtimeBinDir)) process.env.PATH = [runtimeBinDir, currentPath].filter(Boolean).join(":");
}
if (existsSync(runtimePythonDir)) {
  const currentPythonPath = String(process.env.PYTHONPATH || "");
  const pythonParts = currentPythonPath.split(":").filter(Boolean);
  if (!pythonParts.includes(runtimePythonDir)) {
    process.env.PYTHONPATH = [runtimePythonDir, currentPythonPath].filter(Boolean).join(":");
  }
}

const cookiesEnabled = !/^(0|false|off|no)$/i.test(String(process.env.ENABLE_SERVER_COOKIES || "true"));
const autoInjectCookies = /^(1|true|yes|on)$/i.test(String(process.env.YTDLP_AUTO_INJECT_COOKIES || "false"));
const workerBase = String(process.env.WORKER_API_BASE || "").trim().replace(/\/$/, "");
const workerSecret = String(process.env.WORKER_SHARED_SECRET || "").trim();
const syncIntervalMs = Math.max(5_000, Number(process.env.COOKIES_SYNC_INTERVAL_MS || 15_000));
const configuredYoutubeClients = String(process.env.YTDLP_YOUTUBE_PLAYER_CLIENTS || "mweb").trim();
const rawYoutubeClientPool = String(
  process.env.YTDLP_YOUTUBE_CLIENT_POOL || "mweb,web_embedded,android_vr,web_safari,default",
).trim();
const youtubeClientPool = [...new Set(rawYoutubeClientPool
  .split(/[,+]/)
  .map((value) => value.trim().toLowerCase())
  .map((value) => value === "tv_embedded" ? "web_embedded" : value === "android" ? "android_vr" : value)
  .filter((value) => ["mweb", "web_embedded", "android_vr", "web_safari", "default"].includes(value)))];
const youtubeAttemptByTarget = new Map();
const fetchPotPolicy = String(process.env.YTDLP_FETCH_POT || "always").trim().toLowerCase();
const potProviderUrl = String(process.env.YTDLP_POT_PROVIDER_URL || "http://127.0.0.1:4416").trim().replace(/\/$/, "");
const manualPoToken = String(process.env.YTDLP_YOUTUBE_PO_TOKEN || "").trim();
const impersonateTarget = String(process.env.YTDLP_IMPERSONATE || "").trim();
const sleepRequests = String(process.env.YTDLP_SLEEP_REQUESTS || "").trim();
const fixedProxy = String(process.env.YTDLP_PROXY || "").trim();
const proxyPool = String(process.env.YTDLP_PROXY_POOL || "")
  .split(/[\n,;]+/)
  .map((value) => value.trim())
  .filter(Boolean);
let proxyCursor = 0;
let lastForwardedHash = "";
let syncRunning = false;
let warnedLegacyClients = false;

const unique = (values) => [...new Set(values.filter(Boolean).map((value) => resolve(String(value))))];

const cookieCandidates = () => unique([
  process.env.COOKIES_PATH,
  process.env.COOKIE_FILE_PATH,
  process.env.WORKER_COOKIES_PATH,
  process.env.RAILWAY_VOLUME_MOUNT_PATH && join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "cookies.txt"),
  "/data/cookies.txt",
  join(process.cwd(), "data", "cookies.txt"),
  join(process.cwd(), "cookies.txt"),
]);

const normalizeCookieDataLine = (line = "") => {
  const value = String(line || "").trim();
  if (!value) return "";
  if (value.startsWith("#HttpOnly_")) return value.slice("#HttpOnly_".length);
  if (value.startsWith("#")) return "";
  return value;
};

const readValidCookies = () => {
  if (!cookiesEnabled) return null;
  for (const filePath of cookieCandidates()) {
    try {
      if (!existsSync(filePath)) continue;
      const stat = statSync(filePath);
      if (!stat.isFile() || stat.size < 16) continue;
      const content = readFileSync(filePath, "utf8");
      const rows = content
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map(normalizeCookieDataLine)
        .filter(Boolean);
      const validRows = rows.filter((line) => {
        const parts = line.split("\t");
        return parts.length >= 7 && /^(TRUE|FALSE)$/i.test(parts[1] || "") && /^(TRUE|FALSE)$/i.test(parts[3] || "");
      });
      if (!validRows.length) continue;
      if (!validRows.some((line) => /(^|\.)youtube\.com\t|(^|\.)google\.com\t|(^|\.)youtu\.be\t/i.test(line))) continue;
      return { filePath, content, hash: createHash("sha256").update(content, "utf8").digest("hex") };
    } catch {
      // Try the next known storage location.
    }
  }
  return null;
};

const commandUsesYtDlp = (command, args = []) => {
  const name = basename(String(command || "")).toLowerCase();
  if (name === "yt-dlp" || name === "yt-dlp.exe") return true;
  if (!/^(python|python3|python\.exe)$/i.test(name)) return false;
  return args.some((arg, index) => arg === "-m" && String(args[index + 1] || "").toLowerCase() === "yt_dlp");
};

const isDisabledValue = (value = "") => /^(0|false|off|no|none)$/i.test(String(value || "").trim());

const preferredYoutubeClient = () => {
  const values = configuredYoutubeClients
    .split(/[,+]/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.includes("mweb")) return "mweb";
  if (values.includes("web_embedded")) return "web_embedded";
  if (values.includes("android_vr")) return "android_vr";
  if (values.includes("web_safari")) return "web_safari";
  return values[0] || "mweb";
};

const getYoutubeTarget = (args = []) => {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    const value = String(args[index] || "");
    if (/^(?:https?:|ytsearch|ytmsearch)/i.test(value) && (/(?:youtube\.com|youtu\.be)/i.test(value) || /^(?:ytsearch|ytmsearch)/i.test(value))) {
      return value;
    }
  }
  return "youtube";
};

const nextYoutubeClient = (args = []) => {
  const pool = youtubeClientPool.length ? youtubeClientPool : [preferredYoutubeClient()];
  const target = getYoutubeTarget(args);
  const attempt = youtubeAttemptByTarget.get(target) || 0;
  youtubeAttemptByTarget.set(target, attempt + 1);
  return pool[attempt % pool.length];
};

const rewriteYoutubeExtractorArg = (value = "", selectedClient = preferredYoutubeClient()) => {
  const raw = String(value || "");
  if (!/^youtube:/i.test(raw)) return raw;

  const separator = raw.indexOf(":");
  const parts = raw
    .slice(separator + 1)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  const nextParts = [];
  let hadPlayerClient = false;
  let hadFetchPot = false;
  let hadPoToken = false;
  for (const part of parts) {
    if (/^player[-_]client\s*=/i.test(part)) {
      hadPlayerClient = true;
      nextParts.push(`player_client=${selectedClient}`);
      const originalClients = part.split("=").slice(1).join("=");
      if (/[,+]/.test(originalClients) && !warnedLegacyClients) {
        warnedLegacyClients = true;
        console.log(`[yt-dlp] normalized legacy YouTube clients to ${selectedClient}`);
      }
      continue;
    }
    if (/^fetch_pot\s*=/i.test(part)) {
      hadFetchPot = true;
      if (selectedClient === "mweb" && !isDisabledValue(fetchPotPolicy)) {
        nextParts.push(`fetch_pot=${fetchPotPolicy || "always"}`);
      }
      continue;
    }
    if (/^po_token\s*=/i.test(part)) {
      hadPoToken = true;
      nextParts.push(part);
      continue;
    }
    nextParts.push(part);
  }

  if (!hadPlayerClient) nextParts.unshift(`player_client=${selectedClient}`);
  if (!hadFetchPot && selectedClient === "mweb" && !isDisabledValue(fetchPotPolicy)) nextParts.push(`fetch_pot=${fetchPotPolicy || "always"}`);
  if (!hadPoToken && manualPoToken) nextParts.push(`po_token=${manualPoToken}`);
  return `youtube:${nextParts.join(";")}`;
};

const isYoutubeTarget = (args = []) => args.some((item) => {
  const value = String(item || "");
  return /^(?:ytsearch|ytmsearch)/i.test(value) || /(?:youtube\.com|youtu\.be)/i.test(value);
});

const ensureExtractorArgs = (args = [], selectedClient = preferredYoutubeClient()) => {
  if (!isYoutubeTarget(args)) return [...args];
  const source = [...args];
  let urlArg = null;
  for (let index = source.length - 1; index >= 0; index -= 1) {
    if (/^(https?:|ytsearch|ytmsearch)/i.test(String(source[index] || ""))) {
      urlArg = source.splice(index, 1)[0];
      break;
    }
  }
  const next = [];
  let youtubeArgSeen = false;
  let providerArgSeen = false;

  for (let index = 0; index < source.length; index += 1) {
    const item = source[index];
    if (item !== "--extractor-args") {
      next.push(item);
      continue;
    }

    const value = String(source[index + 1] || "");
    index += 1;
    if (/^youtube:/i.test(value)) {
      next.push("--extractor-args", rewriteYoutubeExtractorArg(value, selectedClient));
      youtubeArgSeen = true;
      continue;
    }
    if (/^youtubepot-bgutilhttp:/i.test(value)) providerArgSeen = true;
    next.push("--extractor-args", value);
  }

  if (!youtubeArgSeen) {
    next.push("--extractor-args", rewriteYoutubeExtractorArg("youtube:", selectedClient));
  }
  if (potProviderUrl && !providerArgSeen) {
    next.push("--extractor-args", `youtubepot-bgutilhttp:base_url=${potProviderUrl}`);
  }
  if (urlArg) next.push(urlArg);
  return next;
};

const insertBeforeUrl = (args, ...values) => {
  const next = [...args];
  let insertAt = next.length;
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const value = String(next[index] || "");
    if (/^(https?:|ytsearch|ytmsearch)/i.test(value)) {
      insertAt = index;
      break;
    }
  }
  next.splice(insertAt, 0, ...values);
  return next;
};

const chooseProxy = () => {
  if (fixedProxy) return fixedProxy;
  if (!proxyPool.length) return "";
  const selected = proxyPool[proxyCursor % proxyPool.length];
  proxyCursor = (proxyCursor + 1) % proxyPool.length;
  return selected;
};

const injectYtDlpArgs = (command, args) => {
  const source = Array.isArray(args) ? [...args] : [];
  if (!commandUsesYtDlp(command, source)) return source;

  const hasExplicitCookies = source.includes("--cookies") || source.includes("--cookies-from-browser");
  const selectedClient = hasExplicitCookies ? preferredYoutubeClient() : nextYoutubeClient(source);
  let next = ensureExtractorArgs(source, selectedClient);
  const cookies = readValidCookies();
  if (autoInjectCookies && cookies && !next.includes("--cookies") && !next.includes("--cookies-from-browser")) {
    next = insertBeforeUrl(next, "--cookies", cookies.filePath);
  }

  if (!next.includes("--proxy")) {
    const proxy = chooseProxy();
    if (proxy) next = insertBeforeUrl(next, "--proxy", proxy);
  }

  if (impersonateTarget && !isDisabledValue(impersonateTarget) && !next.includes("--impersonate")) {
    next = insertBeforeUrl(next, "--impersonate", impersonateTarget);
  }

  if (sleepRequests && Number.isFinite(Number(sleepRequests)) && Number(sleepRequests) >= 0 && !next.includes("--sleep-requests")) {
    next = insertBeforeUrl(next, "--sleep-requests", sleepRequests);
  }

  return next;
};

childProcess.spawn = function patchedSpawn(command, args, options) {
  return originalSpawn(command, injectYtDlpArgs(command, args), options);
};
syncBuiltinESMExports();

const forwardCookiesToWorker = async () => {
  if (syncRunning || !workerBase || !workerSecret) return;
  const cookies = readValidCookies();
  if (!cookies || cookies.hash === lastForwardedHash) return;

  syncRunning = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  timeout.unref?.();
  try {
    const response = await fetch(`${workerBase}/admin/upload-cookies`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workerSecret}`,
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: cookies.content,
      signal: controller.signal,
    });
    if (response.ok) {
      lastForwardedHash = cookies.hash;
      console.log(`[cookie-sync] forwarded uploaded cookies to worker (${cookies.filePath})`);
    } else {
      console.warn(`[cookie-sync] worker rejected cookies with HTTP ${response.status}`);
    }
  } catch (error) {
    console.warn("[cookie-sync] unable to forward cookies to worker", error?.message || error);
  } finally {
    clearTimeout(timeout);
    syncRunning = false;
  }
};

setTimeout(forwardCookiesToWorker, 1_000).unref?.();
const syncTimer = setInterval(forwardCookiesToWorker, syncIntervalMs);
syncTimer.unref?.();

export { forwardCookiesToWorker, injectYtDlpArgs, nextYoutubeClient, readValidCookies, rewriteYoutubeExtractorArg };
