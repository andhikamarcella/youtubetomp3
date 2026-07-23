import { EventEmitter } from "node:events";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { basename, dirname, extname } from "node:path";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { PassThrough, Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const require = createRequire(import.meta.url);
const childProcess = require("node:child_process");
const previousSpawn = childProcess.spawn.bind(childProcess);

const DEFAULT_INSTANCE_LIST_URL = "https://raw.githubusercontent.com/wiki/TeamPiped/Piped/Instances.md";
const DEFAULT_PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi-libre.kavin.rocks",
  "https://api.piped.projectsegfau.lt",
  "https://pipedapi.in.projectsegfau.lt",
  "https://pipedapi.us.projectsegfau.lt",
  "https://api.piped.privacydev.net",
  "https://piped-api.hostux.net",
  "https://pdapi.vern.cc",
  "https://api.piped.yt",
  "https://pipedapi.qdi.fi",
  "https://pipedapi.simpleprivacy.fr",
  "https://pipedapi.osphost.fi",
  "https://piapi.ggtyler.dev",
  "https://pipedapi.12a.app",
  "https://pipedapi.ngn.tf",
  "https://pipedapi.ducks.party",
];

const attemptedJobs = new Map();
let instanceCursor = 0;
let discoveryCache = { instances: [], expiresAt: 0 };

const disabled = (value = "") => /^(0|false|off|no|none)$/i.test(String(value || "").trim());
const uniqueStrings = (values = []) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];

const normalizeInstanceBase = (value = "") => {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || url.username || url.password) return "";
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const getPipedConfig = (env = process.env) => {
  const configuredInstances = uniqueStrings(String(env.YTDLP_PIPED_INSTANCES || "")
    .split(/[\n,;]+/)
    .map(normalizeInstanceBase)
    .filter(Boolean));
  const requestTimeoutMs = Math.max(2_000, Number(env.YTDLP_PIPED_REQUEST_TIMEOUT_MS || 8_000));
  const downloadTimeoutMs = Math.max(10_000, Number(env.YTDLP_PIPED_DOWNLOAD_TIMEOUT_MS || 180_000));
  const discoveryTimeoutMs = Math.max(2_000, Number(env.YTDLP_PIPED_DISCOVERY_TIMEOUT_MS || 8_000));
  const discoveryTtlMs = Math.max(60_000, Number(env.YTDLP_PIPED_DISCOVERY_TTL_MS || 30 * 60_000));
  const maxBytes = Math.max(5 * 1024 * 1024, Number(env.YTDLP_PIPED_MAX_MB || 800) * 1024 * 1024);
  const instanceBatchSize = Math.max(1, Math.min(10, Number(env.YTDLP_PIPED_BATCH_SIZE || 5)));
  const maxJobAttempts = Math.max(1, Math.min(4, Number(env.YTDLP_PIPED_JOB_ATTEMPTS || 2)));
  return {
    enabled: !disabled(env.YTDLP_PIPED_FALLBACK ?? "true"),
    explicitInstances: configuredInstances.length > 0,
    instances: configuredInstances.length ? configuredInstances : DEFAULT_PIPED_INSTANCES,
    instanceListUrl: disabled(env.YTDLP_PIPED_INSTANCE_LIST_URL) ? "" : String(env.YTDLP_PIPED_INSTANCE_LIST_URL || DEFAULT_INSTANCE_LIST_URL).trim(),
    requestTimeoutMs,
    downloadTimeoutMs,
    discoveryTimeoutMs,
    discoveryTtlMs,
    maxBytes,
    instanceBatchSize,
    maxJobAttempts,
  };
};

const commandUsesYtDlp = (command, args = []) => {
  const name = basename(String(command || "")).toLowerCase();
  if (name === "yt-dlp" || name === "yt-dlp.exe") return true;
  if (!/^(python|python3|python\.exe)$/i.test(name)) return false;
  return args.some((arg, index) => arg === "-m" && String(args[index + 1] || "").toLowerCase() === "yt_dlp");
};

const isMetadataInvocation = (args = []) => args.some((item) => [
  "--dump-single-json",
  "--dump-json",
  "-J",
  "-j",
  "--get-url",
  "--get-title",
  "--get-id",
  "--get-duration",
  "--skip-download",
].includes(String(item || "")));

const getArgValue = (args = [], names = []) => {
  const accepted = new Set(names);
  for (let index = args.length - 2; index >= 0; index -= 1) {
    if (accepted.has(String(args[index] || ""))) return String(args[index + 1] || "");
  }
  return "";
};

const extractYoutubeVideoId = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let candidate = "";
    if (host === "youtu.be") candidate = url.pathname.split("/").filter(Boolean)[0] || "";
    else if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com")) {
      candidate = url.searchParams.get("v") || "";
      if (!candidate) {
        const match = url.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/i);
        candidate = match?.[1] || "";
      }
    }
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : "";
  } catch {
    const match = raw.match(/(?:youtu\.be\/|[?&]v=|\/(?:shorts|embed|live)\/)([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)/i);
    return match?.[1] || "";
  }
};

const findYoutubeTarget = (args = []) => {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    const value = String(args[index] || "");
    if (/^https?:/i.test(value) && /(?:youtube\.com|youtu\.be)/i.test(value)) return value;
  }
  return "";
};

const isAudioDownloadInvocation = (args = []) => {
  if (isMetadataInvocation(args)) return false;
  if (args.includes("--merge-output-format")) return false;
  if (args.includes("-x") || args.includes("--extract-audio")) return true;
  if (getArgValue(args, ["--audio-format"])) return true;
  const selector = getArgValue(args, ["-f", "--format"]);
  return Boolean(selector && /audio/i.test(selector) && !/(?:bestvideo|worstvideo|\bbv\b)/i.test(selector));
};

const resolveYtDlpOutputTemplate = (args = []) => getArgValue(args, ["-o", "--output"]);

const isBotCheckText = (value = "") => /sign in to confirm|not a bot|bot check|use --cookies|cookies-from-browser|confirm you(?:'|’)re not a bot/i.test(String(value || ""));

const isSafeRemoteUrl = (value = "") => {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
    if (/^(?:0|10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)\./.test(host)) return false;
    if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return false;
    return true;
  } catch {
    return false;
  }
};

const parsePipedInstanceList = (markdown = "") => {
  const instances = [];
  for (const line of String(markdown || "").split(/\r?\n/)) {
    if (!line.includes("|")) continue;
    const urls = line.match(/https:\/\/[^\s|<>()]+/gi) || [];
    for (const rawUrl of urls) {
      const normalized = normalizeInstanceBase(rawUrl.replace(/[),.;]+$/, ""));
      if (!normalized || !isSafeRemoteUrl(normalized)) continue;
      try {
        const host = new URL(normalized).hostname.toLowerCase();
        if (host.includes("github") || host === "piped.video" || host.endsWith(".piped.video")) continue;
      } catch {
        continue;
      }
      instances.push(normalized);
      break;
    }
  }
  return uniqueStrings(instances);
};

const requestedAudioFormat = (args = []) => String(getArgValue(args, ["--audio-format"]) || "").toLowerCase();

const streamExtension = (stream = {}) => {
  const mime = String(stream.mimeType || stream.mime || "").toLowerCase();
  const format = String(stream.format || "").toLowerCase();
  if (mime.includes("audio/mp4") || format.includes("m4a") || format === "mp4") return "m4a";
  if (mime.includes("audio/webm") || format.includes("webm")) return "webm";
  if (mime.includes("audio/ogg") || format.includes("ogg")) return "ogg";
  if (mime.includes("audio/mpeg") || format.includes("mp3")) return "mp3";
  if (mime.includes("audio/aac") || format.includes("aac")) return "aac";
  try {
    const suffix = extname(new URL(String(stream.url || "")).pathname).replace(/^\./, "").toLowerCase();
    if (/^(?:m4a|mp4|webm|ogg|opus|mp3|aac)$/.test(suffix)) return suffix === "mp4" ? "m4a" : suffix;
  } catch { }
  return "m4a";
};

const rankPipedAudioStreams = (streams = [], preferredFormat = "") => {
  const preferred = String(preferredFormat || "").toLowerCase();
  return (Array.isArray(streams) ? streams : [])
    .filter((stream) => stream && isSafeRemoteUrl(stream.url))
    .map((stream) => {
      const ext = streamExtension(stream);
      const bitrate = Number(stream.bitrate || stream.audioBitrate || 0);
      let score = Number.isFinite(bitrate) ? bitrate : 0;
      if (["m4a", "aac", "alac"].includes(preferred) && ext === "m4a") score += 10_000_000;
      if (["opus", "ogg"].includes(preferred) && ["webm", "ogg", "opus"].includes(ext)) score += 10_000_000;
      if (preferred === "mp3" && ext === "m4a") score += 2_000_000;
      if (String(stream.codec || "").toLowerCase().includes("opus")) score += 50_000;
      return { ...stream, _ext: ext, _score: score };
    })
    .sort((left, right) => right._score - left._score);
};

const selectPipedAudioStream = (streams = [], preferredFormat = "") => rankPipedAudioStreams(streams, preferredFormat)[0] || null;

const outputPathForTemplate = (template = "", extension = "m4a") => {
  const ext = String(extension || "m4a").replace(/[^a-z0-9]/gi, "").toLowerCase() || "m4a";
  if (!template) return "";
  if (/%\(ext\)s/.test(template)) return template.replace(/%\(ext\)s/g, ext);
  return `${template}.${ext}`;
};

const fetchWithTimeout = async (fetchImpl, url, options = {}, timeoutMs = 12_000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const resolvePipedInstances = async ({ fetchImpl = globalThis.fetch, config = getPipedConfig() } = {}) => {
  if (config.explicitInstances || !config.instanceListUrl || typeof fetchImpl !== "function") {
    return uniqueStrings(config.instances.map(normalizeInstanceBase).filter(Boolean));
  }
  const now = Date.now();
  if (discoveryCache.expiresAt > now && discoveryCache.instances.length) return [...discoveryCache.instances];
  let discovered = [];
  try {
    if (!isSafeRemoteUrl(config.instanceListUrl)) throw new Error("unsafe instance-list URL");
    const response = await fetchWithTimeout(fetchImpl, config.instanceListUrl, {
      headers: { Accept: "text/plain,text/markdown;q=0.9,*/*;q=0.5", "User-Agent": "YTConv/1.0 Piped instance discovery" },
      redirect: "follow",
    }, config.discoveryTimeoutMs);
    if (!response.ok) throw new Error(`instance list HTTP ${response.status}`);
    discovered = parsePipedInstanceList(await response.text());
  } catch {
    discovered = [];
  }
  const instances = uniqueStrings([...discovered, ...config.instances]
    .map(normalizeInstanceBase)
    .filter((value) => value && isSafeRemoteUrl(value)))
    .slice(0, 48);
  discoveryCache = { instances, expiresAt: now + config.discoveryTtlMs };
  return instances;
};

const downloadResponseToFile = async ({ response, outputPath, maxBytes }) => {
  if (!response?.ok || !response.body) throw new Error(`stream HTTP ${response?.status || "unknown"}`);
  const contentLength = Number(response.headers?.get?.("content-length") || 0);
  if (contentLength > maxBytes) throw new Error(`stream exceeds ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
  await mkdir(dirname(outputPath), { recursive: true });
  await rm(outputPath, { force: true }).catch(() => {});
  let bytes = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > maxBytes) callback(new Error(`stream exceeds ${Math.round(maxBytes / 1024 / 1024)} MB limit`));
      else callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(outputPath, { flags: "wx" }));
  } catch (error) {
    await rm(outputPath, { force: true }).catch(() => {});
    throw error;
  }
  if (!existsSync(outputPath) || bytes < 1024) {
    await rm(outputPath, { force: true }).catch(() => {});
    throw new Error("downloaded fallback stream is empty");
  }
  return bytes;
};

const pruneAttemptedJobs = (now = Date.now()) => {
  const ttl = 10 * 60 * 1000;
  for (const [key, entry] of attemptedJobs) {
    const timestamp = typeof entry === "object" ? entry.timestamp : Number(entry);
    if (!Number.isFinite(timestamp) || now - timestamp > ttl) attemptedJobs.delete(key);
  }
  if (attemptedJobs.size > 1_000) {
    const oldest = attemptedJobs.keys().next().value;
    if (oldest) attemptedJobs.delete(oldest);
  }
};

const claimJobAttempt = (jobKey, maxAttempts = 2) => {
  pruneAttemptedJobs();
  const current = attemptedJobs.get(jobKey) || { count: 0, timestamp: Date.now() };
  if (current.count >= maxAttempts) return false;
  attemptedJobs.set(jobKey, { count: current.count + 1, timestamp: Date.now() });
  return true;
};

const shouldAttemptPipedFallback = ({ command, args = [], code, stderr = "", config = getPipedConfig() } = {}) => {
  if (!config.enabled || Number(code) === 0) return false;
  if (!commandUsesYtDlp(command, args) || !isAudioDownloadInvocation(args)) return false;
  if (!isBotCheckText(stderr)) return false;
  const target = findYoutubeTarget(args);
  return Boolean(extractYoutubeVideoId(target) && resolveYtDlpOutputTemplate(args));
};

const fetchPipedMetadata = async ({ base, videoId, preferredFormat, fetchImpl, config }) => {
  const apiUrl = new URL(`/streams/${videoId}`, `${base}/`).toString();
  const metadataResponse = await fetchWithTimeout(fetchImpl, apiUrl, {
    headers: { Accept: "application/json", "User-Agent": "YTConv/1.0 Piped fallback" },
    redirect: "follow",
  }, config.requestTimeoutMs);
  if (!metadataResponse.ok) throw new Error(`metadata HTTP ${metadataResponse.status}`);
  const contentType = String(metadataResponse.headers?.get?.("content-type") || "").toLowerCase();
  if (contentType && !contentType.includes("json")) throw new Error(`metadata content-type ${contentType}`);
  const metadata = await metadataResponse.json();
  const candidates = rankPipedAudioStreams(metadata?.audioStreams, preferredFormat).slice(0, 4);
  if (!candidates.length) throw new Error("no usable audio streams");
  return { base, candidates };
};

const runPipedAudioFallback = async ({ args = [], fetchImpl = globalThis.fetch, config = getPipedConfig() } = {}) => {
  if (typeof fetchImpl !== "function") throw new Error("fetch is unavailable");
  const target = findYoutubeTarget(args);
  const videoId = extractYoutubeVideoId(target);
  const outputTemplate = resolveYtDlpOutputTemplate(args);
  if (!videoId || !outputTemplate) throw new Error("missing YouTube video ID or output template");

  const jobKey = `${videoId}:${outputTemplate}`;
  if (!claimJobAttempt(jobKey, config.maxJobAttempts)) throw new Error("Piped fallback attempt limit reached for this job");

  const preferredFormat = requestedAudioFormat(args);
  const instances = await resolvePipedInstances({ fetchImpl, config });
  const start = instances.length ? instanceCursor++ % instances.length : 0;
  const orderedInstances = instances.length ? [...instances.slice(start), ...instances.slice(0, start)] : [];
  const errors = [];

  for (let index = 0; index < orderedInstances.length; index += config.instanceBatchSize) {
    const batch = orderedInstances.slice(index, index + config.instanceBatchSize);
    const metadataResults = await Promise.allSettled(batch.map((base) => fetchPipedMetadata({
      base,
      videoId,
      preferredFormat,
      fetchImpl,
      config,
    })));

    for (let resultIndex = 0; resultIndex < metadataResults.length; resultIndex += 1) {
      const metadataResult = metadataResults[resultIndex];
      const base = batch[resultIndex];
      if (metadataResult.status !== "fulfilled") {
        errors.push(`${base}: ${metadataResult.reason?.message || metadataResult.reason}`);
        continue;
      }
      for (const candidate of metadataResult.value.candidates) {
        const outputPath = outputPathForTemplate(outputTemplate, candidate._ext);
        try {
          const streamResponse = await fetchWithTimeout(fetchImpl, candidate.url, {
            headers: { Accept: "audio/*,application/octet-stream;q=0.9,*/*;q=0.5", "User-Agent": "YTConv/1.0 Piped fallback" },
            redirect: "follow",
          }, config.downloadTimeoutMs);
          const bytes = await downloadResponseToFile({ response: streamResponse, outputPath, maxBytes: config.maxBytes });
          return { outputPath, bytes, instance: metadataResult.value.base, videoId, extension: candidate._ext };
        } catch (streamError) {
          errors.push(`${metadataResult.value.base} stream: ${streamError?.message || streamError}`);
        }
      }
    }
  }

  throw new Error(`all Piped instances failed: ${errors.slice(-12).join(" | ")}`);
};

const createPipedFallbackSpawn = (spawnImpl = previousSpawn, { fetchImpl = globalThis.fetch, env = process.env } = {}) => function pipedFallbackSpawn(command, args, options) {
  const sourceArgs = Array.isArray(args) ? [...args] : [];
  const child = spawnImpl(command, args, options);
  const config = getPipedConfig(env);
  if (!config.enabled || !commandUsesYtDlp(command, sourceArgs) || isMetadataInvocation(sourceArgs) || !isAudioDownloadInvocation(sourceArgs)) {
    return child;
  }

  const facade = new EventEmitter();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let stderrText = "";
  let childError = null;
  let settled = false;

  facade.stdout = stdout;
  facade.stderr = stderr;
  facade.stdin = child.stdin;
  facade.stdio = [child.stdin, stdout, stderr];
  facade.kill = (...killArgs) => child.kill(...killArgs);
  facade.ref = (...refArgs) => child.ref?.(...refArgs);
  facade.unref = (...unrefArgs) => child.unref?.(...unrefArgs);
  facade.send = (...sendArgs) => child.send?.(...sendArgs);
  facade.disconnect = (...disconnectArgs) => child.disconnect?.(...disconnectArgs);
  for (const property of ["pid", "killed", "connected", "spawnfile", "spawnargs"]) {
    Object.defineProperty(facade, property, { enumerable: true, get: () => child[property] });
  }
  facade.exitCode = null;
  facade.signalCode = null;

  child.stdout?.on("data", (chunk) => stdout.write(chunk));
  child.stderr?.on("data", (chunk) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    stderr.write(buffer);
    stderrText = `${stderrText}${buffer.toString("utf8")}`.slice(-128_000);
  });
  child.on("error", (error) => { childError = error; });

  const finish = (code, signal) => {
    if (settled) return;
    settled = true;
    facade.exitCode = code;
    facade.signalCode = signal || null;
    stdout.end();
    stderr.end();
    if (childError && Number(code) !== 0) facade.emit("error", childError);
    facade.emit("exit", code, signal || null);
    facade.emit("close", code, signal || null);
  };

  child.on("close", async (code, signal) => {
    if (settled) return;
    if (shouldAttemptPipedFallback({ command, args: sourceArgs, code, stderr: stderrText, config })) {
      try {
        stderr.write("\n[ytconv:piped] Render IP bot-check detected; discovering working Piped instances...\n");
        const result = await runPipedAudioFallback({ args: sourceArgs, fetchImpl, config });
        stderr.write(`[ytconv:piped] fallback succeeded via ${result.instance} (${result.extension}, ${result.bytes} bytes)\n`);
        finish(0, null);
        return;
      } catch (error) {
        stderr.write(`[ytconv:piped] fallback failed: ${error?.message || error}\n`);
      }
    }
    finish(code, signal);
  });

  return facade;
};

childProcess.spawn = createPipedFallbackSpawn(previousSpawn);
syncBuiltinESMExports();

export {
  createPipedFallbackSpawn,
  extractYoutubeVideoId,
  getPipedConfig,
  isAudioDownloadInvocation,
  isBotCheckText,
  outputPathForTemplate,
  parsePipedInstanceList,
  rankPipedAudioStreams,
  resolvePipedInstances,
  resolveYtDlpOutputTemplate,
  runPipedAudioFallback,
  selectPipedAudioStream,
  shouldAttemptPipedFallback,
  streamExtension,
};
