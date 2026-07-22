import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createRequire, syncBuiltinESMExports } from "node:module";

const require = createRequire(import.meta.url);
const childProcess = require("node:child_process");
const originalSpawn = childProcess.spawn.bind(childProcess);

const cookiesEnabled = !/^(0|false|off|no)$/i.test(String(process.env.ENABLE_SERVER_COOKIES || "true"));
const workerBase = String(process.env.WORKER_API_BASE || "").trim().replace(/\/$/, "");
const workerSecret = String(process.env.WORKER_SHARED_SECRET || "").trim();
const syncIntervalMs = Math.max(5_000, Number(process.env.COOKIES_SYNC_INTERVAL_MS || 15_000));
const explicitYoutubeClients = String(process.env.YTDLP_YOUTUBE_PLAYER_CLIENTS || "").trim();
const impersonateTarget = String(process.env.YTDLP_IMPERSONATE || "").trim();
const sleepRequests = String(process.env.YTDLP_SLEEP_REQUESTS || "").trim();
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

const rewriteYoutubeExtractorArg = (value = "") => {
  const raw = String(value || "");
  if (!/^youtube:/i.test(raw)) return raw;

  const separator = raw.indexOf(":");
  const parts = raw
    .slice(separator + 1)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  const filtered = parts.filter((part) => {
    if (!/^player[-_]client\s*=/i.test(part)) return true;
    return Boolean(explicitYoutubeClients);
  });

  if (!explicitYoutubeClients && filtered.length !== parts.length && !warnedLegacyClients) {
    warnedLegacyClients = true;
    console.log("[yt-dlp] removed hard-coded YouTube player clients; yt-dlp will choose cookie-compatible defaults");
  }

  return filtered.length ? `youtube:${filtered.join(";")}` : "";
};

const normalizeExtractorArgs = (args = []) => {
  const next = [];
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index];
    if (item !== "--extractor-args") {
      next.push(item);
      continue;
    }

    const value = rewriteYoutubeExtractorArg(args[index + 1]);
    index += 1;
    if (!value) continue;
    next.push("--extractor-args", value);
  }
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

const injectYtDlpArgs = (command, args) => {
  const source = Array.isArray(args) ? [...args] : [];
  if (!commandUsesYtDlp(command, source)) return source;

  let next = normalizeExtractorArgs(source);
  const cookies = readValidCookies();
  if (cookies && !next.includes("--cookies") && !next.includes("--cookies-from-browser")) {
    next = insertBeforeUrl(next, "--cookies", cookies.filePath);
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

export { forwardCookiesToWorker, injectYtDlpArgs, readValidCookies, rewriteYoutubeExtractorArg };
