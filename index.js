import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { promises as fsp } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { join, dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, timingSafeEqual } from "node:crypto";
import { nanoid } from "nanoid";
// Tambahan untuk ffmpeg portable (opsional)
let ffmpegPath = null;
try {
  ffmpegPath = (await import("ffmpeg-static")).default;
} catch {
  ffmpegPath = null;
}

let ffprobePath = null;
try {
  ffprobePath = (await import("ffprobe-static")).path;
} catch {
  ffprobePath = null;
}

const normalizeHeaderInit = (input) => {
  if (!input) return {};
  if (Array.isArray(input)) {
    return input.reduce((acc, [key, value]) => {
      if (key) acc[String(key).toLowerCase()] = String(value);
      return acc;
    }, {});
  }
  if (typeof input?.forEach === "function" && typeof input?.entries === "function") {
    const acc = {};
    input.forEach((value, key) => {
      if (key != null && value != null) acc[String(key).toLowerCase()] = String(value);
    });
    return acc;
  }
  if (typeof input === "object") {
    return Object.entries(input).reduce((acc, [key, value]) => {
      if (key != null && value != null) acc[String(key).toLowerCase()] = String(value);
      return acc;
    }, {});
  }
  return {};
};

const createResponseObject = (urlStr, statusCode, statusMessage, headersObj, bodyBuffer) => {
  const headerMap = new Map();
  for (const [key, value] of Object.entries(headersObj || {})) {
    if (Array.isArray(value)) {
      headerMap.set(String(key).toLowerCase(), value.join(", "));
    } else if (value != null) {
      headerMap.set(String(key).toLowerCase(), String(value));
    }
  }
  const baseBuffer = Buffer.from(bodyBuffer || Buffer.alloc(0));
  const arrayBuf = baseBuffer.buffer.slice(
    baseBuffer.byteOffset,
    baseBuffer.byteOffset + baseBuffer.byteLength,
  );
  const textCache = baseBuffer.toString("utf8");

  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode || 0,
    statusText: statusMessage || "",
    url: urlStr,
    headers: {
      get: (name) => headerMap.get(String(name).toLowerCase()) ?? null,
      has: (name) => headerMap.has(String(name).toLowerCase()),
      entries: () => headerMap.entries(),
    },
    text: async () => textCache,
    json: async () => {
      if (!textCache) return null;
      try {
        return JSON.parse(textCache);
      } catch (err) {
        const parseErr = new Error("Response JSON tidak valid");
        parseErr.cause = err;
        throw parseErr;
      }
    },
    arrayBuffer: async () => arrayBuf,
    clone: () => createResponseObject(urlStr, statusCode, statusMessage, headersObj, Buffer.from(baseBuffer)),
  };
};

const createFetchFallback = () => {
  const fetchFallback = (input, init = {}, redirectCount = 0) => new Promise((resolve, reject) => {
    try {
      const target = input instanceof URL ? input : new URL(String(input));
      const method = (init.method || "GET").toUpperCase();
      const headers = normalizeHeaderInit(init.headers);
      if (!headers["accept-encoding"]) headers["accept-encoding"] = "identity";

      const requestFn = target.protocol === "http:" ? httpRequest
        : target.protocol === "https:" ? httpsRequest
        : null;
      if (!requestFn) {
        reject(new Error(`Protocol tidak didukung: ${target.protocol}`));
        return;
      }

      let settled = false;
      const settle = (handler) => {
        if (settled) return;
        settled = true;
        if (abortHandler && init.signal) {
          init.signal.removeEventListener("abort", abortHandler);
        }
        handler();
      };

      let abortHandler;
      const req = requestFn({
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "http:" ? 80 : 443),
        path: `${target.pathname}${target.search}` || "/",
        method,
        headers,
      }, (res) => {
        const statusCode = res.statusCode || 0;
        const statusMessage = res.statusMessage || "";
        const location = res.headers?.location;
        if (location && [301, 302, 303, 307, 308].includes(statusCode) && init.redirect !== "manual" && redirectCount < 5) {
          const nextUrl = new URL(location, target);
          res.resume();
          settle(() => resolve(fetchFallback(nextUrl, init, redirectCount + 1)));
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          settle(() => resolve(createResponseObject(target.toString(), statusCode, statusMessage, res.headers, body)));
        });
        res.on("error", (err) => settle(() => reject(err)));
      });

      req.on("error", (err) => settle(() => reject(err)));

      if (init.signal) {
        abortHandler = () => {
          req.destroy(new Error("aborted"));
          const abortErr = new Error("The operation was aborted");
          abortErr.name = "AbortError";
          settle(() => reject(abortErr));
        };
        if (init.signal.aborted) {
          abortHandler();
          return;
        }
        init.signal.addEventListener("abort", abortHandler, { once: true });
      }

      if (init.body) {
        if (Buffer.isBuffer(init.body)) {
          req.write(init.body);
        } else if (init.body instanceof ArrayBuffer) {
          req.write(Buffer.from(init.body));
        } else if (typeof init.body === "string") {
          req.write(init.body);
        } else {
          req.write(JSON.stringify(init.body));
        }
      }

      req.end();
    } catch (err) {
      reject(err);
    }
  });

  return fetchFallback;
};

let fetchImpl = globalThis.fetch;
if (!fetchImpl) {
  try {
    fetchImpl = (await import("node-fetch")).default;
  } catch {
    fetchImpl = createFetchFallback();
  }
}

const safeFetch = async (...args) => {
  if (!fetchImpl) {
    throw new Error("fetch API tidak tersedia di lingkungan ini");
  }
  return fetchImpl(...args);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors());

// ==== Direktori publik & jobs ====
const PUBLIC_DIR = join(__dirname, "public");
const JOBS_DIR   = join(PUBLIC_DIR, "jobs");
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });
if (!existsSync(JOBS_DIR))   mkdirSync(JOBS_DIR,   { recursive: true });

const PUBLIC_ROOT = pathResolve(PUBLIC_DIR);
// direktori tambahan seperti thumbnail/cloud sudah dihapus

const backgroundJobs = new Map();
const backgroundQueue = [];
let backgroundProcessing = false;

// ==== Util ====
const abrToQ = (abr) => {
  const n = Number(abr) || 128;
  if (n >= 320) return "0";
  if (n >= 256) return "1";
  if (n >= 192) return "2";
  if (n >= 160) return "3";
  if (n >= 128) return "4";
  if (n >= 96)  return "5";
  if (n >= 80)  return "6";
  if (n >= 64)  return "7";
  return "8";
};

const sanitizeFileName = (name = "") =>
  name
    .replace(/[\\/:*?"<>|\r\n]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const LANGUAGE_VARIANTS = {
  id: ["id", "in", "ms", "ms-my", "ms-id", "jv", "jw", "su"],
  en: ["en", "en-us", "en-gb", "en-au", "en-ca", "en-in", "eng"],
};

const FALLBACK_LANG = "en";

const normalizePreferredLang = (value = "") => {
  if (!value) return "";
  const normalized = String(value).trim().toLowerCase();
  if (!normalized || normalized === "auto") return "";
  if (LANGUAGE_VARIANTS.id.includes(normalized)) return "id";
  if (LANGUAGE_VARIANTS.en.includes(normalized)) return "en";
  const base = normalized.split(/[-_]/)[0];
  if (!base) return FALLBACK_LANG;
  if (LANGUAGE_VARIANTS.id.includes(base)) return "id";
  if (LANGUAGE_VARIANTS.en.includes(base)) return "en";
  return FALLBACK_LANG;
};

const SMART_TITLE_PATTERNS = [
  /\s*\((?:official(?:\s+music)?\s+video|official\s+audio|lyrics?|lyric\s+video|lirik|audio|video|visualizer|mv|music\s+video|color\s+coded|teaser|live|performance|practice|karaoke|remix).*?\)/gi,
  /\s*\[(?:official(?:\s+music)?\s+video|official\s+audio|lyrics?|lyric\s+video|lirik|audio|video|visualizer|mv|music\s+video|color\s+coded|teaser|live|performance|practice|karaoke|remix).*?\]/gi,
  /\s*-\s*(?:official(?:\s+music)?\s+video|official\s+audio|lyrics?|lyric\s+video|lirik|audio(?:\s+only)?|mv|music\s+video)\b/gi,
  /\b(?:official(?:\s+music)?\s+video|official\s+audio|lyrics?|lyric\s+video|lirik|mv|music\s+video|visualizer|audio\s+only|full\s+album|shorts)\b/gi,
  /\b(?:HD|4K|1080p|720p)\b/gi,
];

const cleanVideoTitle = (rawTitle = "") => {
  let result = String(rawTitle || "");
  SMART_TITLE_PATTERNS.forEach((pattern) => {
    result = result.replace(pattern, "");
  });
  result = result.replace(/[-–—]\s*(?:official|lyrics?|lyric\s+video|lirik|audio)$/gi, "");
  return result.replace(/\s{2,}/g, " ").trim();
};

const extractBestThumbnail = (info) => {
  if (!info || typeof info !== "object") return null;
  if (typeof info.thumbnail === "string" && info.thumbnail.trim()) {
    return info.thumbnail.trim();
  }
  if (Array.isArray(info.thumbnails)) {
    const sorted = [...info.thumbnails]
      .filter((item) => item && typeof item === "object")
      .sort((a, b) => (Number(b?.width) || 0) - (Number(a?.width) || 0));
    const candidate = sorted.find((item) => item?.url) || sorted[0];
    if (candidate?.url) return String(candidate.url);
  }
  return null;
};

const buildVideoMetadata = (entry = {}, { requestedUrl = "", keywordUsed = false } = {}) => {
  if (!entry || typeof entry !== "object") return null;
  const baseTitle = entry.track || entry.title || entry.fulltitle || "";
  const cleaned = cleanVideoTitle(baseTitle);
  const artist = entry.artist || entry.channel || entry.uploader || entry.uploader_id || "";
  const albumSource = entry.album || entry.playlist_title || entry.playlist || "";
  const album = albumSource ? cleanVideoTitle(albumSource) : "";
  const webpageUrl =
    entry.original_url ||
    entry.webpage_url ||
    entry.url ||
    (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : requestedUrl || "");
  const duration = Number.isFinite(entry.duration) ? Number(entry.duration) : null;
  const languageList = Array.isArray(entry.languages)
    ? entry.languages.map((lang) => (lang == null ? null : String(lang))).filter(Boolean)
    : entry.language
      ? [String(entry.language)]
      : [];
  const keywords = Array.isArray(entry.tags)
    ? entry.tags.map((tag) => (tag == null ? null : String(tag))).filter(Boolean)
    : [];

  const cover = extractBestThumbnail(entry);

  return {
    id: entry.id || null,
    title: baseTitle,
    cleanTitle: cleaned || baseTitle,
    author: entry.channel || entry.uploader || entry.channel_id || "",
    artist: artist || "",
    album: album || cleaned || baseTitle,
    cover,
    thumbnail: cover,
    duration,
    webpageUrl,
    keywords,
    languages: Array.from(new Set(languageList)),
    keywordUsed: Boolean(keywordUsed),
    id3: {
      title: cleaned || baseTitle,
      artist: artist || entry.channel || "",
      album: album || cleaned || baseTitle,
      cover,
    },
  };
};

const buildYtDlpCandidates = () => {
  const envBin = typeof process.env.YTDLP_PATH === "string" ? process.env.YTDLP_PATH.trim() : "";
  const envPython =
    typeof process.env.PYTHON === "string"
      ? process.env.PYTHON.trim()
      : typeof process.env.PYTHON_PATH === "string"
        ? process.env.PYTHON_PATH.trim()
        : typeof process.env.PYTHON_BIN === "string"
          ? process.env.PYTHON_BIN.trim()
          : "";

  const candidates = [
    envBin ? { cmd: envBin, prefix: [] } : null,
    { cmd: "yt-dlp", prefix: [] },
    envPython ? { cmd: envPython, prefix: ["-m", "yt_dlp"] } : null,
    { cmd: "python3", prefix: ["-m", "yt_dlp"] },
    { cmd: "python", prefix: ["-m", "yt_dlp"] },
    process.platform === "win32" ? { cmd: "py", prefix: ["-3", "-m", "yt_dlp"] } : null,
  ].filter(Boolean);

  const seen = new Set();
  return candidates.filter(({ cmd, prefix }) => {
    const key = `${cmd} ${(prefix || []).join(" ")}`.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const runYtDlpAttempt = (command, args, { label }) =>
  new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const proc = spawn(command.cmd, [...(command.prefix || []), ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const displayArgs = [...(command.prefix || []), ...args].join(" ");
    const baseLog = `${label}: ${command.cmd} ${displayArgs}`.trim();

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      const error = new Error("yt-dlp tidak bisa dijalankan");
      error.cause = err;
      error.stdout = stdout;
      error.stderr = stderr;
      error.baseLog = baseLog;
      error.logs = [baseLog, stderr, stdout, err.message].filter(Boolean).join("\n");
      reject(error);
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        const error = new Error("yt-dlp gagal mengambil metadata");
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        error.baseLog = baseLog;
        error.logs = [baseLog, stderr || stdout].filter(Boolean).join("\n");
        reject(error);
      } else {
        resolve({ stdout, stderr, baseLog });
      }
    });
  });

const runYtDlpJson = async (args, { label = "yt-dlp" } = {}) => {
  const errors = [];
  const candidates = buildYtDlpCandidates();
  let lastStdout = "";
  let lastStderr = "";
  let lastLog = "";

  for (const candidate of candidates) {
    try {
      const { stdout, stderr, baseLog } = await runYtDlpAttempt(candidate, args, { label });
      lastStdout = stdout;
      lastStderr = stderr;
      lastLog = baseLog;
      const jsonText = stdout || "{}";
      try {
        return JSON.parse(jsonText);
      } catch (parseErr) {
        const error = new Error("Respons yt-dlp tidak valid");
        error.stdout = jsonText;
        error.stderr = stderr;
        error.baseLog = baseLog;
        error.logs = [baseLog, stderr, jsonText, parseErr.message]
          .filter(Boolean)
          .join("\n");
        throw error;
      }
    } catch (err) {
      errors.push(err.logs || err.message || "yt-dlp gagal mengambil metadata");
      lastStdout = err.stdout || lastStdout;
      lastStderr = err.stderr || lastStderr;
      lastLog = err.baseLog || lastLog;
    }
  }

  const error = new Error("yt-dlp gagal mengambil metadata");
  error.logs = [lastLog, lastStderr, lastStdout, ...errors].filter(Boolean).join("\n");
  throw error;
};

const fetchVideoInfo = async ({ url, keyword, preferLang } = {}) => {
  const rawUrl = typeof url === "string" ? url.trim() : "";
  const rawKeyword = typeof keyword === "string" ? keyword.trim() : "";
  let target = rawUrl;
  let keywordUsed = false;
  const language = normalizePreferredLang(preferLang);
  if (!target) {
    if (!rawKeyword) {
      throw new Error("URL atau kata kunci tidak valid");
    }
    keywordUsed = true;
    target = `ytsearch1:${rawKeyword}`;
  }

  const args = [
    "--dump-single-json",
    "--skip-download",
    "--no-warnings",
    "--default-search",
    "ytsearch",
    "--no-playlist",
  ];
  if (language) {
    args.push("--sub-lang", language);
  }
  if (existsSync(COOKIES_PATH)) {
    args.push("--cookies", COOKIES_PATH);
  }
  args.push(target);

  const json = await runYtDlpJson(args, { label: keywordUsed ? "ytsearch" : "info" });
  const entry = Array.isArray(json?.entries) && json.entries.length ? json.entries[0] : json;
  if (!entry) {
    throw new Error("Video tidak ditemukan");
  }
  const metadata = buildVideoMetadata(entry, { requestedUrl: rawUrl, keywordUsed });
  if (!metadata?.webpageUrl) {
    metadata.webpageUrl = rawUrl || metadata?.id ? `https://www.youtube.com/watch?v=${metadata.id}` : "";
  }
  return metadata;
};

const searchYoutubeVideos = async ({ query, limit = 6, preferLang } = {}) => {
  const rawQuery = typeof query === "string" ? query.trim() : "";
  if (!rawQuery) {
    throw new Error("Kata kunci pencarian kosong");
  }
  const clamped = clamp(Number(limit) || 6, 1, 15);
  const target = `ytsearch${clamped}:${rawQuery}`;
  const language = normalizePreferredLang(preferLang);
  const args = [
    "--dump-single-json",
    "--skip-download",
    "--no-warnings",
    "--default-search",
    "ytsearch",
    "--no-playlist",
  ];
  if (language) {
    args.push("--sub-lang", language);
  }
  if (existsSync(COOKIES_PATH)) {
    args.push("--cookies", COOKIES_PATH);
  }
  args.push(target);

  const json = await runYtDlpJson(args, { label: "search" });
  const entries = Array.isArray(json?.entries) ? json.entries : [];
  return entries
    .filter(Boolean)
    .slice(0, clamped)
    .map((entry) => buildVideoMetadata(entry, { keywordUsed: true }))
    .filter(Boolean);
};

const toPositiveInt = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num);
};

const parseSampleRate = (value) => toPositiveInt(value);

const resolvePublicPath = (urlPath = "") => {
  if (typeof urlPath !== "string") return null;
  const cleaned = urlPath.replace(/\\/g, "/").trim();
  if (!cleaned.startsWith("/public/")) return null;
  const relative = cleaned.slice("/public/".length);
  const fullPath = pathResolve(PUBLIC_ROOT, relative);
  if (!fullPath.startsWith(PUBLIC_ROOT)) return null;
  return fullPath;
};

const probeAudioStream = async (inputPath) => {
  if (!inputPath) return null;
  const args = [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=sample_rate,channels",
    "-of",
    "json",
    inputPath,
  ];
  return await new Promise((resolve) => {
    const ffprobeBin = ffprobePath || "ffprobe";
    const proc = spawn(ffprobeBin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    proc.stdout.on("data", (d) => {
      output += d.toString();
    });
    proc.on("error", () => resolve(null));
    proc.on("close", (code) => {
      if (code !== 0) return resolve(null);
      try {
        const json = JSON.parse(output || "{}");
        const stream = Array.isArray(json.streams) ? json.streams[0] : null;
        if (!stream) return resolve(null);
        const sampleRate = parseSampleRate(stream.sample_rate);
        const channels = toPositiveInt(stream.channels);
        resolve({ sampleRate, channels });
      } catch {
        resolve(null);
      }
    });
  });
};

const GENRE_KEYWORDS = [
  { rx: /(lo[-\s]?fi|study|chillhop|coffee shop)/i, value: "Lo-Fi" },
  { rx: /(hip\s?hop|rap)/i, value: "Hip-Hop" },
  { rx: /(trap|808|drill)/i, value: "Trap" },
  { rx: /(edm|electro|dance|club|festival)/i, value: "EDM" },
  { rx: /(rock|guitar|band)/i, value: "Rock" },
  { rx: /(metal|screamo|hardcore)/i, value: "Metal" },
  { rx: /(jazz|swing|sax)/i, value: "Jazz" },
  { rx: /(lofi|sleep|relax|ambient|meditation)/i, value: "Ambient" },
  { rx: /(piano|violin|orchestra|symphony)/i, value: "Classical" },
  { rx: /(k\-?pop|kpop)/i, value: "K-Pop" },
  { rx: /(dangdut|koplo)/i, value: "Dangdut" },
];

const MOOD_KEYWORDS = [
  { rx: /(happy|joy|summer|sunshine)/i, value: "Happy" },
  { rx: /(sad|heartbreak|galau|melancholy|cry)/i, value: "Melancholy" },
  { rx: /(relax|calm|sleep|study|focus)/i, value: "Chill" },
  { rx: /(epic|cinematic|battle|orchestra)/i, value: "Epic" },
  { rx: /(rain|night|midnight|lofi)/i, value: "Midnight" },
  { rx: /(pump|gym|workout|power)/i, value: "Hype" },
];

const ENERGY_KEYWORDS = [
  { rx: /(sleep|ambient|relax|asmr)/i, value: "Low" },
  { rx: /(lofi|study|chill|coffee)/i, value: "Medium" },
  { rx: /(edm|nightcore|dance|club|hard|festival|live)/i, value: "High" },
];

const pickFromKeywords = (text, rules, fallback) => {
  for (const rule of rules) {
    if (rule.rx.test(text)) return rule.value;
  }
  return fallback;
};

const buildAiTags = ({ title = "", description = "", channel = "", duration } = {}) => {
  const combined = `${title}\n${description}\n${channel}`;
  const genre = pickFromKeywords(combined, GENRE_KEYWORDS, "Pop");
  const mood = pickFromKeywords(combined, MOOD_KEYWORDS, duration && duration > 360 ? "Calm" : "Energetic");
  let energy = pickFromKeywords(combined, ENERGY_KEYWORDS, duration && duration > 420 ? "Medium" : "High");
  if (/acoustic|piano|ambient/i.test(combined)) energy = "Low";
  const yearMatch = /(20\d{2}|19\d{2})/.exec(description) || /(20\d{2}|19\d{2})/.exec(title);
  const year = yearMatch ? yearMatch[1] : undefined;

  const cleanTitle = title.replace(/\[[^\]]+\]/g, "").replace(/\([^)]*official[^)]*\)/ig, "").trim();
  const suggestedTitle = cleanTitle || title;
  const suggestedAlbum = suggestedTitle;
  const suggestedArtist = channel?.trim() || undefined;

  const tags = {
    title: suggestedTitle,
    artist: suggestedArtist,
    album: suggestedAlbum,
    genre,
    mood,
    energy,
  };
  if (year) tags.year = year;
  tags.comment = `AI tags · ${genre} · ${mood}${year ? ` · ${year}` : ""}`;
  return tags;
};

const formatDurationLabel = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 60) return `${Math.round(value)}s`;
  const minutes = Math.floor(value / 60);
  const secs = Math.round(value % 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins ? ` ${mins}m` : ""}`.trim();
  }
  return `${minutes}m${secs ? ` ${secs}s` : ""}`.trim();
};

const slugifyTag = (value) => {
  if (!value) return null;
  const slug = value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
  return slug || null;
};

const MOOD_EMOJIS = {
  Happy: "😊",
  Chill: "😌",
  Melancholy: "💜",
  Epic: "🔥",
  Midnight: "🌙",
  Hype: "⚡️",
  Calm: "🌿",
  Energetic: "🚀",
};

const MOOD_PLAYLIST_HINTS = {
  Happy: ["Feel Good Hits", "Sunrise Drive"],
  Chill: ["Focus Flow", "Coffee & Beats"],
  Melancholy: ["Late Night Lyrics", "Deep Focus"],
  Epic: ["Cinematic Adventure", "Boss Battle"],
  Midnight: ["Midnight Lounge", "Night Riders"],
  Hype: ["Beast Mode", "Workout Bangers"],
  Calm: ["Peaceful Piano", "Sleep Tight"],
  Energetic: ["Dance Party", "Cardio Boost"],
};

const GENRE_PLAYLIST_HINTS = {
  "Lo-Fi": ["Lo-Fi Cafe", "Study Session"],
  "Hip-Hop": ["Rap Radar"],
  Trap: ["Trap Nation"],
  EDM: ["Festival Bangers"],
  Rock: ["Alternative Anthems"],
  Metal: ["Heavy Rotation"],
  Jazz: ["Late Night Jazz"],
  Ambient: ["Deep Focus"],
  Classical: ["Cinematic Scores"],
  "K-Pop": ["K-Pop Now"],
  Dangdut: ["Dangdut Hits"],
  Pop: ["Today's Top Hits"],
};

const HOOK_GENRE_EMOJI = {
  EDM: "⚡️",
  "Lo-Fi": "🌙",
  "Hip-Hop": "🎤",
  Trap: "🔥",
  Rock: "🎸",
  Pop: "🎶",
  Jazz: "🎷",
  Ambient: "🌧️",
  Classical: "🎻",
  Dangdut: "🥁",
  "K-Pop": "💖",
};

const COVER_PRESETS = {
  EDM: {
    style: "Neon cyberpunk poster",
    visuals: "laser beams, silhouette crowd, futuristic city skyline",
    lighting: "Backlit neon glow",
    texture: "Chromatic aberration + subtle grain",
    vibe: "Festival energy",
    palette: [
      { hex: "#FF4ECD", label: "Magenta neon" },
      { hex: "#09FBD3", label: "Aqua laser" },
      { hex: "#08070B", label: "Deep midnight" },
    ],
  },
  "Lo-Fi": {
    style: "Cozy illustrated cassette cover",
    visuals: "window view, rain-streaked glass, desk setup with headphones",
    lighting: "Warm lamp light",
    texture: "Paper grain + soft blur",
    vibe: "Study & chill",
    palette: [
      { hex: "#D4A373", label: "Warm latte" },
      { hex: "#264653", label: "Deep teal" },
      { hex: "#2A9D8F", label: "Seafoam accent" },
    ],
  },
  "Hip-Hop": {
    style: "Bold street collage",
    visuals: "boom box, graffiti backdrop, dynamic typography",
    lighting: "High contrast spotlight",
    texture: "Ripped paper + spray paint",
    vibe: "Block party hype",
    palette: [
      { hex: "#FF8A00", label: "Amber pop" },
      { hex: "#161616", label: "Concrete black" },
      { hex: "#FFD60A", label: "Tape highlight" },
    ],
  },
  Rock: {
    style: "Gritty live stage poster",
    visuals: "guitar silhouette, stage smoke, crowd hands",
    lighting: "Crimson spotlight",
    texture: "Distressed paper + halftone",
    vibe: "Raw performance",
    palette: [
      { hex: "#F94144", label: "Stage red" },
      { hex: "#1B1B1B", label: "Amp black" },
      { hex: "#F3722C", label: "Amber flare" },
    ],
  },
  Ambient: {
    style: "Minimal gradient mist",
    visuals: "soft fog layers, floating geometric shapes",
    lighting: "Diffused dawn glow",
    texture: "Bloom + smooth blur",
    vibe: "Meditative soundscape",
    palette: [
      { hex: "#8ECAE6", label: "Sky blue" },
      { hex: "#023047", label: "Deep ocean" },
      { hex: "#CAD2C5", label: "Cloud mist" },
    ],
  },
  Jazz: {
    style: "Retro lounge poster",
    visuals: "sax silhouette, vinyl curves, smoky gradients",
    lighting: "Golden hour spotlight",
    texture: "Soft grain + silk paper",
    vibe: "Late night swing",
    palette: [
      { hex: "#F9C74F", label: "Brass gold" },
      { hex: "#90BE6D", label: "Olive accent" },
      { hex: "#577590", label: "Midnight blue" },
    ],
  },
  Dangdut: {
    style: "Festive batik fusion",
    visuals: "dynamic dancer silhouette, batik-inspired patterns, stage lights",
    lighting: "Vibrant spotlight sweep",
    texture: "Foil shimmer + grain",
    vibe: "Panggung hajatan",
    palette: [
      { hex: "#FF9F1C", label: "Sunset orange" },
      { hex: "#FFBF69", label: "Champagne shimmer" },
      { hex: "#2EC4B6", label: "Turquoise pop" },
    ],
  },
  Pop: {
    style: "Glossy pastel poster",
    visuals: "floating shapes, bold sans-serif title, sparkles",
    lighting: "Studio beauty light",
    texture: "Soft gloss + tiny glitter",
    vibe: "Chart-ready polish",
    palette: [
      { hex: "#FF80AB", label: "Candy pink" },
      { hex: "#845EC2", label: "Violet depth" },
      { hex: "#00C9A7", label: "Mint pop" },
    ],
  },
  default: {
    style: "Modern streaming cover",
    visuals: "abstract gradients, floating typography, subtle motion blur",
    lighting: "Soft rim light",
    texture: "Fine grain + bloom",
    vibe: "Clean digital aesthetic",
    palette: [
      { hex: "#FF6B6B", label: "Coral highlight" },
      { hex: "#5F27CD", label: "Indigo depth" },
      { hex: "#0B132B", label: "Night base" },
    ],
  },
};

const buildAiCaption = ({
  title = "",
  channel = "",
  duration,
  speedMode = "normal",
  denoise = false,
  volumeBoost = 0,
  enhancer = "none",
  format = "",
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  const trackTitle = tags.title || title || "Track Baru";
  const artist = tags.artist || channel || "Creator";
  const moodEmoji = MOOD_EMOJIS[tags.mood] || "🎧";
  const detailParts = [];
  if (tags.genre) detailParts.push(tags.genre);
  if (tags.mood) detailParts.push(tags.mood);
  if (tags.energy) detailParts.push(tags.energy);
  const durationLabel = formatDurationLabel(duration);
  if (durationLabel) detailParts.push(durationLabel);

  const tweaks = [];
  if (speedMode === "nightcore") tweaks.push("Nightcore tempo");
  else if (speedMode === "slow_reverb") tweaks.push("Slowed + reverb vibes");
  if (denoise) tweaks.push("Noise cleaned");
  const boostVal = Number(volumeBoost);
  if (Number.isFinite(boostVal) && boostVal > 0) tweaks.push(`+${boostVal} dB boost`);
  if (enhancer && enhancer !== "none") {
    const enhancerLabels = {
      clarity: "Clarity enhancer",
      warm: "Warm tone",
      club: "Club lift",
    };
    tweaks.push(enhancerLabels[enhancer] || `Enhancer: ${enhancer}`);
  }

  const captionLines = [`${moodEmoji} ${trackTitle} — ${artist}`];
  if (detailParts.length) captionLines.push(detailParts.join(" · "));
  if (tweaks.length) captionLines.push(`Tweak: ${tweaks.join(", ")}`);
  captionLines.push("Scan QR di web atau klik link buat dengar sekarang.");

  const hashtags = new Set(["#music"]);
  const pushTag = (value) => {
    const slug = slugifyTag(value);
    if (!slug) return;
    hashtags.add(`#${slug}`);
  };

  [tags.genre, tags.mood, tags.energy, artist, format].forEach(pushTag);
  if (speedMode === "nightcore") hashtags.add("#nightcore");
  else if (speedMode === "slow_reverb") hashtags.add("#slowedreverb");
  if (denoise) hashtags.add("#noiseclean");
  if (boostVal > 0) hashtags.add("#volumeboost");

  const titleParts = trackTitle.split(/\s+/).slice(0, 2);
  titleParts.forEach(pushTag);

  const hashtagList = Array.from(hashtags).filter(Boolean).slice(0, 8);
  return { caption: captionLines.join("\n"), hashtags: hashtagList, tags };
};

const buildAiPitch = ({
  title = "",
  description = "",
  channel = "",
  duration,
  genre,
  mood,
} = {}) => {
  const tags = buildAiTags({ title, description, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  if (mood && typeof mood === "string" && mood.trim()) tags.mood = mood.trim();
  const trackTitle = tags.title || title || "Track Baru";
  const artist = tags.artist || channel || "Creator";
  const descriptorParts = [tags.genre, tags.mood, tags.energy].filter(Boolean);
  const descriptor = descriptorParts.length ? descriptorParts.join(" · ") : null;
  const durationLabel = formatDurationLabel(duration);
  const playlistHints = new Set();
  if (tags.mood && MOOD_PLAYLIST_HINTS[tags.mood]) {
    for (const item of MOOD_PLAYLIST_HINTS[tags.mood]) playlistHints.add(item);
  }
  if (tags.genre && GENRE_PLAYLIST_HINTS[tags.genre]) {
    for (const item of GENRE_PLAYLIST_HINTS[tags.genre]) playlistHints.add(item);
  }
  const playlists = Array.from(playlistHints).slice(0, 4);
  const hookMood = tags.mood ? tags.mood.toLowerCase() : "fresh";
  const hookGenre = tags.genre ? `${tags.genre.toLowerCase()} groove` : "sonic palette";
  const hook = `${trackTitle} menghadirkan nuansa ${hookMood} dengan ${hookGenre}${durationLabel ? ` dalam ${durationLabel}` : ""}.`;
  const pitchLines = [];
  if (descriptor) {
    pitchLines.push(`${trackTitle} oleh ${artist} memadukan ${descriptor}${durationLabel ? ` sepanjang ${durationLabel}` : ""}.`);
  } else {
    pitchLines.push(`${trackTitle} oleh ${artist}${durationLabel ? ` (${durationLabel})` : ""}.`);
  }
  if (playlists.length) {
    pitchLines.push(`Cocok untuk playlist ${playlists.join(", ")}.`);
  } else {
    pitchLines.push("Siap melengkapi daftar putar favoritmu.");
  }
  return {
    pitch: pitchLines.join(" "),
    hook,
    playlists,
    tags,
  };
};

const pickAudiophileProfile = (tags = {}) => {
  const genre = (tags.genre || "").toLowerCase();
  const mood = (tags.mood || "").toLowerCase();

  if (/(hip[- ]?hop|trap|edm|house|dance|dubstep|electro|bass|club)/.test(genre) || /(energetic|hype|club)/.test(mood)) {
    return {
      focus: "Bass Impact & Groove",
      summary: "{{TRACK}}: Fokus pada sub-bass rapat tanpa mengorbankan vokal utama.",
      eq: [
        "Low-shelf +3 dB di ~60 Hz (Q ≈ 1.0) untuk dorongan sub-bass.",
        "Potong -1.5 dB di 250 Hz (Q ≈ 1.2) agar low-mid tidak muddy.",
        "High-shelf +1 dB mulai 9 kHz supaya hi-hat tetap berkilau.",
      ],
      playback: [
        "Gunakan headphone closed-back dengan seal rapat atau speaker + sub aktif.",
        "Jaga level master sekitar -6 dBFS sebelum limiter agar transien kick tetap utuh.",
      ],
      enhancements: [
        "Periksa fase L/R di bawah 80 Hz agar bass tetap terpusat.",
      ],
    };
  }

  if (/(jazz|acoustic|folk|classical|ambient|lo[- ]?fi|lofi|blues|soul|ballad|r\u0026b|r&b)/.test(genre) || /(calm|chill|midnight|melancholy)/.test(mood)) {
    return {
      focus: "Detail & Stage Depth",
      summary: "{{TRACK}}: Prioritaskan midrange alami dan ruang ambience yang luas.",
      eq: [
        "High-pass lembut di 28 Hz (Q ≈ 0.7) untuk membersihkan rumble.",
        "Angkat +2 dB di 3 kHz (Q ≈ 1.1) demi artikulasi vokal/instrumen utama.",
        "Air boost +1.5 dB di 12 kHz dengan shelf lebar untuk nuansa udara.",
      ],
      playback: [
        "Monitor memakai headphone open-back atau nearfield dengan tweeter halus untuk imaging akurat.",
        "Posisikan diri membentuk segitiga sama sisi dengan speaker untuk kedalaman panggung terbaik.",
      ],
      enhancements: [
        "Tambahkan reverb kamar <1.2s seperlunya agar kedalaman bertambah tanpa menutup detail.",
      ],
    };
  }

  if (/(rock|metal|punk|indie|alternative)/.test(genre) || /(epic)/.test(mood)) {
    return {
      focus: "Midrange Punch & Presence",
      summary: "{{TRACK}}: Jaga serangan gitar dan vokal tanpa menusuk telinga.",
      eq: [
        "Cut -2 dB di 3.5 kHz (Q ≈ 2) bila gitar terlalu tajam.",
        "Boost +2 dB di 120 Hz (Q ≈ 1.0) untuk menambah bobot kick & bass.",
        "Shelf +1 dB di 8 kHz supaya cymbal tetap hidup.",
      ],
      playback: [
        "Gunakan monitor dengan respon cepat atau headphone semi-open untuk mengecek distorsi.",
        "Periksa kompatibilitas mono agar gitar ganda tidak saling membatalkan.",
      ],
      enhancements: [
        "Kompresi bus 2–3 dB cukup untuk menjaga energi tanpa meratakan dinamika.",
      ],
    };
  }

  return {
    focus: "Balanced Clarity",
    summary: "{{TRACK}}: Pertahankan keseimbangan frekuensi yang nyaman di berbagai perangkat.",
    eq: [
      "High-pass 25 Hz untuk membuang subsonik yang tidak terdengar.",
      "Tambahkan +1.5 dB di 2.5 kHz (Q ≈ 1.0) guna meningkatkan intelligibility.",
      "High-shelf lembut +1 dB di 10 kHz agar udara tetap hadir.",
    ],
    playback: [
      "Cross-check di speaker kecil atau earbuds supaya mid tetap jelas.",
      "Kalibrasi level monitoring sekitar 79 dB SPL agar telinga tidak cepat lelah.",
    ],
    enhancements: [
      "Aktifkan dither saat downsample untuk menjaga detail halus.",
    ],
  };
};

const buildAiAudiophileGuide = ({
  title = "",
  channel = "",
  duration,
  genre,
  mood,
  format = "",
  sampleRate,
  speedMode = "normal",
  enhancer = "none",
  denoise = false,
  volumeBoost = 0,
  normalize = false,
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  if (mood && typeof mood === "string" && mood.trim()) tags.mood = mood.trim();

  const profile = pickAudiophileProfile(tags);
  const eq = [...(profile.eq || [])];
  const playback = [...(profile.playback || [])];
  const enhancements = [...(profile.enhancements || [])];

  const trackTitle = tags.title || title || "Track";
  const artist = tags.artist || channel || "Artist";
  const summary = (profile.summary || "{{TRACK}}").replace(/\{\{TRACK\}\}/g, `${trackTitle} — ${artist}`);

  const fmt = (format || "").toLowerCase();
  const sr = Number(sampleRate);
  let sampleAdvice;
  if (fmt === "flac" || fmt === "wav") {
    if (Number.isFinite(sr) && sr >= 96000) {
      sampleAdvice = "Pertahankan 96 kHz lossless untuk headroom mixing dan arsip.";
    } else {
      sampleAdvice = "Render lossless minimal 48 kHz; gunakan 96 kHz bila sumber dan perangkat mendukung.";
    }
  } else if (fmt === "m4a") {
    sampleAdvice = "Gunakan 44.1 kHz AAC agar encoder paling efisien dan kompatibel.";
  } else if (fmt === "mp3") {
    sampleAdvice = "Kunci di 48 kHz maksimum — MP3 tidak stabil di atas 48 kHz.";
  } else if (Number.isFinite(sr) && sr > 0) {
    sampleAdvice = `Jaga ${Math.round(sr)} Hz dan aktifkan dither saat downsample supaya detail terpelihara.`;
  } else {
    sampleAdvice = "Pertahankan minimal 48 kHz agar detail high-end tidak hilang di berbagai player.";
  }

  const durationLabel = formatDurationLabel(duration);
  if (durationLabel) {
    playback.push(`Durasi konten ${durationLabel} — cek konsistensi gain sepanjang track.`);
  }
  if (tags.mood) playback.push(`Mood terdeteksi: ${tags.mood}. Sesuaikan ambience ruangan agar nuansanya tersampaikan.`);
  if (tags.energy) playback.push(`Level energi: ${tags.energy}. Atur volume playback supaya tidak melelahkan telinga.`);

  if (speedMode === "nightcore") {
    eq.push("Tambahkan low-shelf +1 dB di 120 Hz untuk mengisi tubuh setelah pitch-up nightcore.");
    enhancements.push("Gunakan low-pass halus di 17 kHz bila terdengar aliasing akibat percepatan.");
  } else if (speedMode === "slow_reverb") {
    eq.push("High-shelf +1.5 dB di 10 kHz menjaga kilau setelah slowed + reverb.");
    enhancements.push("High-pass 30 Hz pasca reverb untuk mencegah build-up frekuensi rendah.");
  }

  const boostVal = Number(volumeBoost);
  if (Number.isFinite(boostVal) && boostVal > 0) {
    enhancements.push(`Boost +${boostVal} dB telah diterapkan — sisakan headroom minimal 1 dBTP agar tidak clip.`);
  }
  if (normalize) enhancements.push("Normalisasi aktif — targetkan -14 LUFS untuk streaming atau -9 LUFS untuk club set.");
  if (denoise) enhancements.push("Denoise aktif — setel threshold ringan agar high-hat tidak ikut hilang.");

  if (enhancer && enhancer !== "none") {
    const enhancerNotes = {
      clarity: "Mode Clarity menonjolkan vokal & hi-hat — cocok untuk fokus detail.",
      warm: "Mode Warm menambah harmonik mid, ideal untuk rekaman analog atau vokal mellow.",
      club: "Mode Club menaikkan low-mid; awasi limiter agar punch tidak pecah.",
    };
    enhancements.push(enhancerNotes[enhancer] || `Gunakan enhancer ${enhancer} seperlunya.`);
  }

  return {
    focus: profile.focus,
    summary,
    sampleRate: sampleAdvice,
    eq,
    playback,
    enhancements,
    tags,
  };
};

const buildAiHook = ({
  title = "",
  channel = "",
  duration,
  genre,
  speedMode = "normal",
  volumeBoost = 0,
  enhancer = "none",
  denoise = false,
  eq = {},
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  const trackTitle = tags.title || title || "Track Baru";
  const artist = tags.artist || channel || "Creator";
  const emoji = HOOK_GENRE_EMOJI[tags.genre] || MOOD_EMOJIS[tags.mood] || "✨";
  const moodLabel = tags.mood ? `${tags.mood.toLowerCase()} mood` : "fresh mood";
  const energyLabel = tags.energy ? `${tags.energy.toLowerCase()} energy` : "dynamic energy";

  const tweaks = [];
  if (speedMode === "nightcore") tweaks.push("nightcore tempo");
  else if (speedMode === "slow_reverb") tweaks.push("slowed + reverb feel");
  const boostVal = Number(volumeBoost);
  if (Number.isFinite(boostVal) && boostVal > 0) tweaks.push(`+${boostVal} dB boost`);
  if (enhancer && enhancer !== "none") {
    const enhancerLabels = {
      clarity: "vocal clarity",
      warm: "warm glow",
      club: "club lift",
    };
    tweaks.push(enhancerLabels[enhancer] || `enhancer: ${enhancer}`);
  }
  if (denoise) tweaks.push("noise cleaned");

  const eqHighlights = [];
  const bassVal = Number(eq?.bass ?? 0);
  const midVal = Number(eq?.mid ?? 0);
  const trebleVal = Number(eq?.treble ?? 0);
  if (bassVal > 2) eqHighlights.push("deep bass impact");
  else if (bassVal < -2) eqHighlights.push("tight low-end");
  if (midVal > 2) eqHighlights.push("forward mids for vocals");
  if (trebleVal > 2) eqHighlights.push("sparkling high-end shimmer");

  const studioLine = [...eqHighlights, ...tweaks].length
    ? `Studio touch: ${[...eqHighlights, ...tweaks].join(', ')}.`
    : null;

  const hooks = [
    `${emoji} ${trackTitle} by ${artist} menghadirkan ${moodLabel} dengan ${energyLabel}.`,
  ];
  if (studioLine) hooks.push(studioLine);
  hooks.push("Tap & dengarkan sekarang — biar vibe-nya takeover harimu!");

  const ctas = [
    "🎧 Dengerin sekarang",
    "💾 Save ke playlist favoritmu",
  ];
  if (tags.energy === "High" || tags.mood === "Hype") ctas.push("🔥 Share ke geng untuk boost semangat");
  else ctas.push("✨ Jadikan soundtrack aktivitasmu");

  const hashtags = new Set();
  [tags.genre, tags.mood, tags.energy, artist].forEach((value) => {
    const slug = slugifyTag(value);
    if (slug) hashtags.add(`#${slug}`);
  });
  if (speedMode === "nightcore") hashtags.add("#nightcore");
  if (speedMode === "slow_reverb") hashtags.add("#slowedreverb");

  const focus = tags.genre && tags.mood ? `${tags.genre} · ${tags.mood}` : null;

  return {
    hooks: hooks.slice(0, 3),
    ctas: ctas.slice(0, 3),
    hashtags: Array.from(hashtags).slice(0, 5),
    tone: `${tags.mood || 'Fresh'} ${tags.genre || ''}`.trim(),
    emoji,
    focus,
  };
};

const buildAiCoverPrompt = ({
  title = "",
  channel = "",
  duration,
  genre,
  format = "",
  speedMode = "normal",
  enhancer = "none",
  volumeBoost = 0,
  denoise = false,
  normalize = false,
  eq = {},
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  const trackTitle = tags.title || title || "Track Baru";
  const artist = tags.artist || channel || "Creator";
  const preset = COVER_PRESETS[tags.genre] || COVER_PRESETS.default;
  const moodDescriptor = tags.mood ? `${tags.mood.toLowerCase()} mood` : "modern mood";
  const energyDescriptor = tags.energy ? `${tags.energy.toLowerCase()} energy` : "smooth energy";

  const eqHints = [];
  if (Number(eq?.bass ?? 0) > 2) eqHints.push("visualize sub-bass waves at the bottom");
  if (Number(eq?.mid ?? 0) > 2) eqHints.push("add warm vocal aura around the center");
  if (Number(eq?.treble ?? 0) > 2) eqHints.push("sprinkle high-frequency particles around the title");
  if (Number(eq?.treble ?? 0) < -2) eqHints.push("keep top area soft and clean");
  if (enhancer === "clarity") eqHints.push("keep typography crisp and glossy");
  if (enhancer === "warm") eqHints.push("use warm light bloom");
  if (enhancer === "club") eqHints.push("accent with strobe reflections");
  if (denoise) eqHints.push("avoid noisy background, use clean gradients");
  if (normalize) eqHints.push("balanced overall contrast");

  const promptParts = [
    `Album cover for "${trackTitle}" by ${artist}.`,
    `${preset.visuals} with ${moodDescriptor} and ${energyDescriptor}.`,
    `${preset.style}, lighting ${preset.lighting}, texture ${preset.texture}.`,
  ];
  if (eqHints.length) promptParts.push(`Details: ${eqHints.join('; ')}.`);
  promptParts.push('Square format 1:1, streaming-ready, high resolution, cinematic rendering.');

  return {
    prompt: promptParts.join(' '),
    palette: preset.palette,
    style: preset.style,
    lighting: preset.lighting,
    texture: preset.texture,
    vibe: preset.vibe,
  };
};

const buildAiReleasePlan = ({
  title = "",
  channel = "",
  duration,
  genre,
  format = "",
  speedMode = "normal",
  backgroundMode = false,
  autoDownload = false,
  queueLength = 0,
  hasPlaylist = false,
  volumeBoost = 0,
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  const trackTitle = tags.title || title || "Track Baru";
  const vibe = `${tags.genre || 'Multi-genre'} ${tags.mood || 'Fresh'}`.trim();

  const plan = [
    { timing: "-7 Hari", title: "Teaser visual", detail: `Rilis snippet 15 detik + WIP cover art untuk ${trackTitle} di Reels/Shorts.` },
    { timing: "-3 Hari", title: "Hook blast", detail: "Gunakan AI Hook + caption untuk CTA, ajak pre-save dan buka diskusi vibe." },
    { timing: "-1 Hari", title: "Komunitas & checklist", detail: "DM inner circle, siapin playlist pitch, aktifkan story countdown." },
    { timing: "Release Day", title: "Launch & QR share", detail: "Drop track, bagikan QR mini player + link share, highlight fitur preview dan caption AI." },
    { timing: "+2 Hari", title: "Konten lanjutan", detail: "Upload behind-the-scenes/lyric cut, ajak fans duet atau stitch vibe." },
    { timing: "+5 Hari", title: "Playlist follow-up", detail: "Kirim AI Playlist Pitch ke curator dan update komunitas/Discord." },
  ];

  if (backgroundMode) {
    plan.splice(2, 0, {
      timing: "-2 Hari",
      title: "Siapkan background job",
      detail: "Aktifkan Background mode di web untuk monitor convert & deliver link early access.",
    });
  }

  if (hasPlaylist || (Number(queueLength) || 0) > 1) {
    plan.push({
      timing: "+1 Minggu",
      title: "Bundle playlist",
      detail: "Rilis ZIP playlist/remix pack, gunakan Download ZIP & share QR ke subscriber.",
    });
  }

  if (autoDownload) {
    plan.push({
      timing: "Automation",
      title: "Auto-download siap",
      detail: "Aktifkan Auto-download agar hasil langsung tersimpan dan siap dibagikan.",
    });
  }

  if (Number(volumeBoost) > 6) {
    plan.push({
      timing: "+10 Hari",
      title: "High-energy recap",
      detail: "Potong video live reaction yang nunjukin boost energi +${volumeBoost} dB, ajak fans tag kamu.",
    });
  }

  const summary = `Strategi 1 minggu: teaser → hook → launch → follow-up untuk ${vibe.toLowerCase()} audience.`;
  const focus = `Fokus: ${tags.genre || 'Multi-genre'} · ${tags.mood || 'Fresh'} · ${tags.energy || 'Balanced'}`;

  return { plan, summary, focus };
};

const buildAiPressKit = ({
  title = "",
  channel = "",
  duration,
  genre,
  mood,
  format = "",
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  if (mood && typeof mood === "string" && mood.trim()) tags.mood = mood.trim();
  const trackTitle = tags.title || title || "Rilisan Baru";
  const artist = tags.artist || channel || "Creator";
  const vibe = `${tags.genre || "Multi-genre"} · ${tags.mood || "Fresh"}`;
  const runtime = formatDurationLabel(duration);
  const formatLabel = format && typeof format === "string" && format.trim() ? format.toUpperCase() : "MP3";

  const headline = `${trackTitle} oleh ${artist} siap ${tags.energy === "High" ? "mengguncang" : "menemani"} playlist kamu`;

  const storyParts = [
    `${artist} merilis ${trackTitle}${runtime ? ` berdurasi ${runtime}` : ""} dalam format ${formatLabel}.`,
    `Rilisan ini memadukan nuansa ${vibe.toLowerCase()} dengan karakter ${tags.energy?.toLowerCase() || "dinamis"}.`,
  ];
  if (tags.comment) storyParts.push(tags.comment);

  const highlights = [
    `Genre utama: ${tags.genre || "Eksploratif"}`,
    `Mood: ${tags.mood || "Serbaguna"}`,
    `Energi: ${tags.energy || "Seimbang"}`,
  ];
  if (runtime) highlights.push(`Durasi: ${runtime}`);
  if (formatLabel) highlights.push(`Format unggulan: ${formatLabel}`);

  const socialHook = `Gunakan hashtag #${slugifyTag(trackTitle) || "MusikBaru"} untuk ikut merayakan perilisan.`;
  const quote = `"${trackTitle} adalah ${tags.mood ? tags.mood.toLowerCase() : "perjalanan"} sonik yang ${tags.energy === "High" ? "penuh energi" : "hangat"}." — ${artist}`;

  return {
    headline,
    story: storyParts.join(" "),
    highlights,
    quote,
    socialHook,
  };
};

const buildAiOutreachEmail = ({
  title = "",
  channel = "",
  duration,
  genre,
  mood,
  target = "curator",
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  if (mood && typeof mood === "string" && mood.trim()) tags.mood = mood.trim();
  const trackTitle = tags.title || title || "Rilisan Baru";
  const artist = tags.artist || channel || "Creator";
  const vibe = `${tags.genre || "multi-genre"} • ${tags.mood || "fresh"}`;
  const durationLabel = formatDurationLabel(duration);
  const friendlyTarget = target === "press" ? "media" : target === "community" ? "komunitas" : "kurator";

  const subject = `${trackTitle} – ${tags.genre || "genre"} ${tags.mood || "mood"} terbaru dari ${artist}`;
  const opener = `Halo ${friendlyTarget},`;
  const intro = `Aku ${artist}. Mau bagi ${trackTitle}${durationLabel ? ` (${durationLabel})` : ""} yang lagi siap dipromosikan.`;
  const hook = `Nuansanya ${vibe.toLowerCase()} dengan energi ${tags.energy?.toLowerCase() || "menarik"}.`;
  const why = target === "press"
    ? "Materi ini cocok untuk liputan rilisan baru atau playlist rekomendasi mingguan."
    : target === "community"
      ? "Kusertakan assets buat challenge komunitas + QR mini player biar gampang dishare."
      : "Rasanya pas buat playlist tematik dan takeover segar di minggu ini.";
  const cta = target === "press"
    ? "Kalau tertarik, bisa aku kirim press kit lengkap & link interview."
    : target === "community"
      ? "Boleh bantu share atau pakai buat konten komunitas ya, nanti ku-repost."
      : "Boleh minta feedback atau masuk playlist kamu?";

  const extras = [`Link dengar cepat: {{preview_link}}`];
  if (tags.comment) extras.push(tags.comment);
  extras.push("Terima kasih atas waktunya!", `Salam hangat, ${artist}`);

  return {
    subject,
    opener,
    intro,
    hook,
    why,
    cta,
    extras,
  };
};

const buildAiLyricTeaser = ({
  title = "",
  channel = "",
  duration,
  genre,
  mood,
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  if (mood && typeof mood === "string" && mood.trim()) tags.mood = mood.trim();
  const trackTitle = tags.title || title || "Rilisan Baru";
  const vibe = `${tags.genre || "pop"} ${tags.mood || "fresh"}`.toLowerCase();
  const energyEmoji = MOOD_EMOJIS[tags.mood] || "🎵";

  const opening = tags.mood === "Epic"
    ? "Langkahmu memantul, lampu kota jadi saksi"
    : tags.mood === "Calm"
      ? "Sunyi merona di balik helaan napas"
      : tags.mood === "Happy"
        ? "Tawa kita meledak seperti kembang api"
        : "Nada berputar, memori ikut menari";
  const bridge = tags.energy === "High"
    ? "Detak menaik, bass memeluk malam"
    : "Langkah melambat, kata tetap menyala";
  const closer = tags.mood === "Melancholy"
    ? "Kusimpan kisahmu di sela senja"
    : "Kita ulang lagi sampai fajar menyapa";

  const lines = [opening, bridge, closer];
  const hashtags = [
    `#${slugifyTag(trackTitle) || "NewMusic"}`,
    `#${(tags.genre || "genre").replace(/\s+/g, "")}`,
    `#${(tags.mood || "mood").replace(/\s+/g, "")}`,
  ];

  const callout = `${energyEmoji} ${trackTitle} · teaser lirik vibe ${vibe}`;

  return {
    lines,
    hashtags,
    callout,
  };
};

// ==== AI Assistant helper ====
const DEFAULT_ASSISTANT_SUGGESTIONS = [
  "Ketik /faq untuk membuka daftar pertanyaan cepat di tab Experience.",
  "Gunakan /walkthrough bila ingin tur fitur langkah demi langkah.",
  "Tekan ikon robot di kanan bawah kapan saja untuk memanggil AI Navigator.",
];

const normalizeAssistantPrompt = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dedupeList = (items = []) => {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const text = typeof item === "string" ? item.trim() : "";
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
};

const keywordScore = (text, keywords = []) => {
  let score = 0;
  for (const entry of keywords) {
    if (!entry) continue;
    if (typeof entry === "string") {
      if (text.includes(entry)) score += Math.max(1, Math.min(4, Math.round(entry.length / 4)));
    } else if (typeof entry === "object") {
      const term = typeof entry.term === "string" ? entry.term : "";
      if (!term) continue;
      if (text.includes(term)) {
        const weight = Number(entry.weight);
        score += Number.isFinite(weight) ? weight : Math.max(1, Math.min(4, Math.round(term.length / 4)));
      }
    }
  }
  return score;
};

const assistantTopicReply = {
  donation: () =>
    "Untuk donasi tinggal klik tombol Buka Saweria. Nominal default otomatis Rp10.000 dan kamu bisa pilih Rp5.000, Rp10.000, Rp25.000, atau Rp100.000 langsung di kartu donasi neo-brutalisme. Kalau pop-up diblokir, pakai tombol manual supaya link https://saweria.co/DhikaMarcella terbuka.",
  subtitle: () =>
    "Subtitle diambil dari track Indonesia dan Inggris. Tekan Ambil Subtitle, kami ambil caption resmi, auto-generated, lalu fallback ke transkrip halaman watch bila perlu. File .srt dan .txt langsung siap di Riwayat unduhan.",
  profile: () =>
    "Tab Profil menampilkan avatar dinamis lengkap dengan XP, badge, dan milestone level. Buka Profil untuk melihat progress, klaim badge, dan lanjutkan pengalaman dari Experience Hub.",
  music: () => {
    const moodBadges = Object.entries(MOOD_EMOJIS)
      .map(([mood, emoji]) => `${emoji} ${mood}`)
      .slice(0, 6)
      .join(", ");
    return `Adaptive Background Music siap jalan. Pilih mood manual atau biarkan mode otomatis mengikuti waktu — varian yang tersedia: ${moodBadges}. Mini player tetap sinkron di setiap tab.`;
  },
  voice: () =>
    "Voice Navigation dan Narrator ada di Pengaturan → Aksesibilitas. Aktifkan lalu tekan ikon mic untuk perintah seperti 'buka donasi', 'mainkan game', atau 'bacakan halaman'. Narrator akan membaca konten langsung di browser.",
  offline: () =>
    "Converter ini sudah PWA-ready. Tekan tombol 'Pasang aplikasi' di header untuk instal di HP/desktop, kemudian semua tab termasuk Experience Hub dan mini player bisa dipakai offline setelah sekali sinkron.",
  game: () =>
    "Neo Runner ada di tab Experience sebagai panel terpisah seperti mini player. Tekan Mulai, gunakan Space atau tap untuk lompat, dan coba kombinasi ↑↑↓↓←→←→BA buat membuka animasi easter egg.",
  avatar: () =>
    "Dynamic Avatar ada di Experience Hub. Klik avatar melayang untuk membuka profil, lihat level, serta daftar achievement. Aktivitas seperti convert, donasi, voice command, dan main game otomatis menambah poin.",
  performance: () =>
    "Supaya konversi lebih kencang, ikuti Tips Kecepatan: pilih format yang pas, aktifkan auto-download, dan gunakan Background Mode untuk antrean panjang. Volume booster dan EQ stepper sudah ramah sentuhan di desktop maupun mobile.",
  accessibility: () =>
    "Pengaturan menyediakan opsi aksesibilitas: tema kontras tinggi, teks besar, hingga pengurangan animasi. Kamu juga bisa menyesuaikan dashboard, tata letak mini player, dan preferensi font typewriter dari panel Customizable Dashboard.",
  walkthrough: () =>
    "Butuh tur singkat? Tekan tombol Mulai Walkthrough di Experience Hub. Ada indikator progres dan kamu bisa jalankan ulang kapan saja dari panel Pengaturan.",
  issues: () =>
    "Kalau tombol terasa tidak merespons, coba muat ulang sekali untuk menyegarkan service worker. Kamu juga bisa buka Pengaturan → Offline Mode untuk memaksa pembaruan cache lalu jalankan ulang fitur yang bermasalah.",
};

const ASSISTANT_TOPICS = [
  {
    key: "donation",
    keywords: ["donasi", "donate", "saweria", "dukungan", "support", "tip", "100000", "100 ribu", "100k", "100rb"],
    suggestions: [
      "Gunakan tombol nominal cepat Rp5.000–Rp100.000 di kartu donasi.",
      "Aktifkan animasi confetti dengan memilih tombol Rp100.000.",
      "Izinkan pop-up browser supaya Saweria terbuka otomatis.",
    ],
  },
  {
    key: "subtitle",
    keywords: ["subtitle", "subtitel", "transkrip", "transcript", "caption video", "captions", "teks video"],
    suggestions: [
      "Pilih prioritas bahasa di form subtitle bila ingin fokus Indonesia atau Inggris.",
      "Unduh versi .srt atau .txt dari Riwayat unduhan setelah proses selesai.",
      "Aktifkan Narrator Mode kalau ingin teks dibacakan langsung.",
    ],
  },
  {
    key: "profile",
    keywords: ["profil", "avatar", "xp", "badge", "poin", "achievement"],
    suggestions: [
      "Buka tab Profil untuk melihat level avatar dan daftar badge.",
      "Jelajahi Experience Hub agar XP naik lebih cepat.",
      "Donasi, main game, dan pakai voice command untuk mengumpulkan badge baru.",
    ],
  },
  {
    key: "music",
    keywords: ["musik", "lagu", "background", "bgm", "adaptive", "soundtrack"],
    suggestions: [
      "Buka Experience Hub → bagian Music untuk ganti mood secara manual.",
      "Gunakan voice command 'musik chill' setelah mengaktifkan Voice Navigation.",
      "Mini player bisa tetap memutar musik sambil kamu buka tab lain.",
    ],
  },
  {
    key: "voice",
    keywords: ["voice", "narrator", "narator", "perintah suara", "mic", "microphone", "speech"],
    suggestions: [
      "Aktifkan Voice & Narrator dari Pengaturan → Aksesibilitas.",
      "Ucapkan perintah seperti 'buka donasi' atau 'mainkan game' untuk navigasi cepat.",
      "Gunakan narrator untuk membacakan FAQ panjang otomatis.",
    ],
  },
  {
    key: "offline",
    keywords: ["offline", "pwa", "install", "pasang aplikasi", "app", "aplikasi"],
    suggestions: [
      "Tekan tombol Pasang aplikasi di header saat koneksi stabil.",
      "Buka situs sekali saat online supaya cache offline terbarui.",
      "Gunakan mini player offline untuk memutar hasil konversi terakhir.",
    ],
  },
  {
    key: "game",
    keywords: ["game", "neo runner", "minigame", "mini game", "konami", "easter egg"],
    suggestions: [
      "Masuk ke tab Experience lalu buka panel Neo Runner.",
      "Gunakan Space atau tap layar di mobile untuk melompat.",
      "Coba kode ↑↑↓↓←→←→BA untuk animasi rahasia.",
    ],
  },
  {
    key: "avatar",
    keywords: ["avatar", "profil", "profile", "achievement", "badge", "level", "poin"],
    suggestions: [
      "Klik avatar melayang untuk melihat profil dan pencapaian.",
      "Selesaikan walkthrough dan main Neo Runner untuk lencana tambahan.",
      "Aktifkan Reward System agar poin tersimpan di perangkatmu.",
    ],
  },
  {
    key: "performance",
    keywords: ["cepat", "lambat", "lemot", "antri", "antrean", "background mode", "auto download", "konversi"],
    suggestions: [
      "Gunakan Tips Kecepatan di panel utama sebelum convert.",
      "Aktifkan Background Mode untuk antrean panjang atau banyak link.",
      "Pilih format yang sesuai supaya proses encoding lebih ringan.",
    ],
  },
  {
    key: "accessibility",
    keywords: ["aksesibilitas", "accessibility", "kontras", "font besar", "tema", "layout", "custom", "dashboard"],
    suggestions: [
      "Toggle High Contrast dari Pengaturan → Aksesibilitas.",
      "Aktifkan Reduced Motion bila ingin animasi lebih tenang.",
      "Atur tata letak Experience Hub lewat panel Customizable Dashboard.",
    ],
  },
  {
    key: "walkthrough",
    keywords: ["walkthrough", "tutorial", "panduan", "tour", "guide"],
    suggestions: [
      "Tekan tombol Mulai Walkthrough di Experience Hub.",
      "Gunakan /walkthrough di chat ini untuk memicu tur otomatis.",
      "Ikuti indikator progres agar tidak melewatkan langkah penting.",
    ],
  },
  {
    key: "issues",
    keywords: ["error", "gagal", "tidak bisa", "bug", "masalah", "rusak"],
    suggestions: [
      "Refresh halaman untuk memuat ulang service worker terbaru.",
      "Cek koneksi lalu coba ulang fitur setelah cache diperbarui.",
      "Laporkan detail langkah ke tim bila masalah terus muncul.",
    ],
  },
];

const buildAssistantResponse = (prompt) => {
  const raw = typeof prompt === "string" ? prompt.trim() : String(prompt ?? "").trim();
  if (!raw) {
    return {
      reply: "Aku siap bantu optimalkan converter ini. Tanyakan apa saja seputar donasi, subtitle, Experience Hub, atau profil avatar.",
      suggestions: DEFAULT_ASSISTANT_SUGGESTIONS,
    };
  }

  const normalized = normalizeAssistantPrompt(raw);
  const matches = ASSISTANT_TOPICS
    .map((topic) => ({
      topic,
      score: keywordScore(normalized, topic.keywords),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const replySegments = [];
  const suggestionPool = [];

  if (matches.length) {
    for (const { topic } of matches.slice(0, 2)) {
      const builder = assistantTopicReply[topic.key];
      if (typeof builder === "function") {
        const segment = builder({ raw, normalized });
        if (segment) replySegments.push(segment);
      }
      if (Array.isArray(topic.suggestions)) suggestionPool.push(...topic.suggestions);
    }
  }

  if (!replySegments.length) {
    replySegments.push(
      "Aku siap bantu optimalkan converter ini. Bahas donasi, subtitle, Experience Hub, profil avatar, musik latar, atau aktifkan walkthrough bila butuh panduan."
    );
  }

  suggestionPool.push(...DEFAULT_ASSISTANT_SUGGESTIONS);
  const suggestions = dedupeList(suggestionPool).slice(0, 5);

  return {
    reply: replySegments.join("\n\n"),
    suggestions,
  };
};

const validateConvertPayload = (payload = {}) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload tidak valid");
  }
  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL tidak valid");
  }
  const format = String(payload.format || "mp3").toLowerCase();
  if (!SUPPORTED_FORMATS.has(format)) {
    throw new Error("Format tidak didukung");
  }
  const speedMode = payload.speedMode || "normal";
  if (!VALID_SPEED_MODES.has(speedMode)) {
    throw new Error("Mode kecepatan tidak dikenali");
  }
  if (payload.sampleRate !== undefined) {
    const sr = Number(payload.sampleRate);
    if (!Number.isFinite(sr) || sr <= 0) {
      throw new Error("sampleRate tidak valid");
    }
  }
  if (payload.trim && typeof payload.trim === "object") {
    const { start, end } = payload.trim;
    if (start !== undefined) {
      const s = Number(start);
      if (!Number.isFinite(s) || s < 0) throw new Error("trim.start tidak valid");
    }
    if (end !== undefined) {
      const e = Number(end);
      if (!Number.isFinite(e) || e < 0) throw new Error("trim.end tidak valid");
    }
    if (start !== undefined && end !== undefined) {
      if (Number(end) < Number(start)) throw new Error("trim.end harus >= trim.start");
    }
  }
  if (payload.volumeBoost !== undefined) {
    const boost = Number(payload.volumeBoost);
    if (!Number.isFinite(boost) || boost < -24 || boost > 24) {
      throw new Error("volumeBoost di luar batas");
    }
  }
  return {
    ...payload,
    url,
    format,
    speedMode,
  };
};

const enqueueBackgroundJob = (payload = {}) => {
  const normalized = validateConvertPayload(payload);
  const id = nanoid(12);
  const job = {
    id,
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: normalized,
    logs: "",
  };
  backgroundJobs.set(id, job);
  backgroundQueue.push(id);
  job.queuePosition = backgroundQueue.length;
  processBackgroundQueue().catch(() => {});
  return job;
};

const processBackgroundQueue = async () => {
  if (backgroundProcessing) return;
  backgroundProcessing = true;
  while (backgroundQueue.length) {
    const jobId = backgroundQueue.shift();
    const job = backgroundJobs.get(jobId);
    if (!job) continue;
    job.queuePosition = 0;
    job.status = "processing";
    job.startedAt = Date.now();
    job.updatedAt = Date.now();
    try {
      const result = await convertSingle({ ...job.payload, noPlaylist: true });
      job.status = "done";
      job.completedAt = Date.now();
      job.result = {
        downloadUrl: result.downloadUrl,
        fileName: result.fileName,
        format: result.format,
        baseName: result.baseName,
        ext: result.ext,
        sampleRate: result.sampleRate,
        channels: result.channels,
      };
      if (result.fullPath) job.result.fullPath = result.fullPath;
      job.logs = (result.logs || "").slice(-8000);
    } catch (err) {
      job.status = "error";
      job.completedAt = Date.now();
      job.error = err.message || "Gagal memproses";
      job.logs = (err.logs || "").slice(-8000);
    }
    job.updatedAt = Date.now();
  }
  backgroundProcessing = false;
};

const serializeJob = (job) => {
  if (!job) return null;
  const data = {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    queuePosition: job.queuePosition,
  };
  if (job.error) data.error = job.error;
  if (job.logs) data.logs = job.logs;
  if (job.result) {
    data.result = {
      downloadUrl: job.result.downloadUrl,
      fileName: job.result.fileName,
      format: job.result.format,
      baseName: job.result.baseName,
      ext: job.result.ext,
    };
    if (job.result.sampleRate !== undefined) data.result.sampleRate = job.result.sampleRate;
    if (job.result.channels !== undefined) data.result.channels = job.result.channels;
    if (job.result.speedMode) data.result.speedMode = job.result.speedMode;
  }
  return data;
};

const resolveJobFilePath = (job) => {
  if (!job) return null;
  if (job.result?.fullPath) return job.result.fullPath;
  if (job.result?.downloadUrl) return resolvePublicPath(job.result.downloadUrl);
  return null;
};

const SUPPORTED_FORMATS = new Set(["mp3", "m4a", "flac", "wav", "ogg"]);
const VALID_SPEED_MODES = new Set(["normal", "nightcore", "slow_reverb"]);

const FORMAT_RULES = {
  mp3: {
    abr: [320, 256, 192, 128, 64],
    sampleRates: [44100, 48000],
    speedModes: ["normal", "nightcore", "slow_reverb"],
  },
  m4a: {
    abr: [192],
    sampleRates: [44100],
    speedModes: ["normal"],
  },
  flac: {
    abr: [320, 256, 192],
    sampleRates: [96000],
    speedModes: ["normal"],
  },
  wav: {
    abr: [],
    sampleRates: [48000, 44100, 96000],
    speedModes: ["normal"],
  },
  ogg: {
    abr: [256, 192, 160, 128],
    sampleRates: [48000, 44100],
    speedModes: ["normal", "nightcore"],
  },
};

const pickFormatSampleRate = (fmt) => {
  const rule = FORMAT_RULES[fmt];
  if (rule?.sampleRates?.length) return rule.sampleRates[0];
  return 44100;
};

const sanitizeFormatOptions = (fmt, { abr, sampleRate, speedMode }) => {
  const rule = FORMAT_RULES[fmt] || {};
  let cleanedAbr = abr;
  if (Array.isArray(rule.abr)) {
    const abrNumber = Number(abr);
    cleanedAbr = rule.abr.includes(abrNumber) ? abrNumber : (rule.abr[0] ?? null);
    if (!rule.abr.length) cleanedAbr = null;
  }

  let cleanedSampleRate = undefined;
  if (sampleRate !== undefined) {
    const srNumber = parseSampleRate(sampleRate);
    if (Array.isArray(rule.sampleRates) && rule.sampleRates.length) {
      cleanedSampleRate = rule.sampleRates.includes(srNumber) ? srNumber : rule.sampleRates[0];
    } else {
      cleanedSampleRate = srNumber || undefined;
    }
  }

  let cleanedSpeed = speedMode;
  if (Array.isArray(rule.speedModes) && rule.speedModes.length) {
    cleanedSpeed = rule.speedModes.includes(speedMode) ? speedMode : rule.speedModes[0];
  }

  return {
    abr: cleanedAbr,
    sampleRate: cleanedSampleRate,
    speedMode: cleanedSpeed,
  };
};

const deriveFilterSampleRate = (fmt, requested, detected) => {
  const requestedRate = parseSampleRate(requested);
  const rule = FORMAT_RULES[fmt];
  if (requestedRate) {
    if (!rule?.sampleRates?.length || rule.sampleRates.includes(requestedRate)) return requestedRate;
    return rule.sampleRates[0];
  }
  const detectedRate = parseSampleRate(detected);
  if (detectedRate && (!rule?.sampleRates?.length || rule.sampleRates.includes(detectedRate))) {
    return detectedRate;
  }
  if (rule?.sampleRates?.length) return rule.sampleRates[0];
  return pickFormatSampleRate(fmt);
};

const buildAudioFilters = ({
  normalize = false,
  speedMode = "normal",
  denoise = false,
  volumeBoost = 0,
  enhancer = "none",
  sampleRate,
  sourceSampleRate,
} = {}) => {
  const filters = [];
  const baseSampleRate =
    parseSampleRate(sampleRate) ||
    parseSampleRate(sourceSampleRate) ||
    44100;
  if (speedMode && speedMode !== "normal") {
    if (speedMode === "nightcore") {
      const refSampleRate = baseSampleRate || 44100;
      const boosted = Math.max(8000, Math.round(refSampleRate * 1.25));
      filters.push(`asetrate=${boosted}`, `aresample=${refSampleRate}`);
    } else if (speedMode === "slow_reverb") {
      filters.push("atempo=0.85", "aecho=0.6:0.6:1000:0.25");
    }
  }
  if (denoise) filters.push("afftdn");
  const boost = Number(volumeBoost);
  if (!Number.isNaN(boost) && boost !== 0) {
    filters.push(`volume=${clamp(boost, -20, 20)}dB`);
  }
  if (enhancer && typeof enhancer === "string" && enhancer !== "none") {
    if (enhancer === "clarity") {
      filters.push("acompressor=threshold=-18dB:ratio=2:attack=5:release=50", "equalizer=f=3200:t=h:w=2:g=3");
    } else if (enhancer === "warm") {
      filters.push("equalizer=f=160:t=h:w=2:g=4", "equalizer=f=6400:t=h:w=2:g=-3");
    } else if (enhancer === "club") {
      filters.push("acompressor=threshold=-16dB:ratio=3:attack=8:release=80", "equalizer=f=90:t=h:w=2:g=5", "equalizer=f=8500:t=h:w=2:g=2");
    }
  }
  if (normalize) filters.push("loudnorm");
  return filters;
};

const applyAudioFilters = (args, filters = []) => {
  if (filters && filters.length) {
    args.push("-filter:a", filters.join(","));
  }
};

const runFfmpeg = (args) => new Promise((resolve, reject) => {
  const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  ff.stdout.on("data", (d) => (logs += d.toString()));
  ff.stderr.on("data", (d) => (logs += d.toString()));
  ff.on("error", (err) => {
    const error = new Error(err.code === "ENOENT" ? "ffmpeg tidak ditemukan" : err.message || "ffmpeg gagal");
    error.logs = logs;
    reject(error);
  });
  ff.on("close", (code) => {
    if (code === 0) resolve(logs);
    else {
      const error = new Error(`ffmpeg exit ${code}`);
      error.logs = logs;
      reject(error);
    }
  });
});

const vttToSrt = (input = "") => {
  const clean = (input || "").replace(/^WEBVTT.*\n+/i, "").replace(/\r/g, "");
  const blocks = clean.split(/\n\n+/);
  const lines = [];
  let idx = 1;
  for (const block of blocks) {
    const parts = block.split(/\n+/).map((line) => line.trim());
    if (!parts.length) continue;
    let cursor = 0;
    if (/^\d+$/.test(parts[cursor])) cursor += 1;
    if (cursor >= parts.length) continue;
    const timeLine = parts[cursor];
    if (!timeLine.includes("-->")) continue;
    const [rawStart, rawEndWithMeta] = timeLine.split("-->");
    if (!rawEndWithMeta) continue;
    const start = rawStart.trim().replace(/\./g, ",");
    const end = rawEndWithMeta.trim().split(/\s+/)[0]?.replace(/\./g, ",");
    if (!start || !end) continue;
    const textLines = parts.slice(cursor + 1).map((line) => line.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
    if (!textLines.length) continue;
    lines.push(String(idx));
    lines.push(`${start} --> ${end}`);
    lines.push(...textLines);
    lines.push("");
    idx += 1;
  }
  return lines.join("\n").trim();
};

const decodeHtmlEntities = (input = "") =>
  (input || "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });

const stripHtml = (input = "") =>
  decodeHtmlEntities((input || "").replace(/<br\s*\/?>(?=\s*\n?)/gi, "\n").replace(/<[^>]+>/g, "")).replace(/\s+$/gm, "");

const msToSrtTime = (value) => {
  const ms = Math.max(0, Math.round(Number(value) || 0));
  const totalSeconds = Math.floor(ms / 1000);
  const milli = ms % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (num, len = 2) => String(num).padStart(len, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milli, 3)}`;
};

const parseClockTime = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d+(?:\.\d+)?ms$/i.test(trimmed)) return Number.parseFloat(trimmed) || 0;
  if (/^\d+(?:\.\d+)?s$/i.test(trimmed)) return (Number.parseFloat(trimmed) || 0) * 1000;
  if (/^\d+(?:\.\d+)?m$/i.test(trimmed)) return (Number.parseFloat(trimmed) || 0) * 60 * 1000;
  if (/^\d+(?:\.\d+)?h$/i.test(trimmed)) return (Number.parseFloat(trimmed) || 0) * 3600 * 1000;
  if (/^\d{1,2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)) {
    const [h, m, s] = trimmed.split(":");
    const seconds = Number.parseFloat(s) || 0;
    return ((Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + seconds) * 1000;
  }
  return null;
};

const convertSrvXmlToSrt = (xml = "") => {
  const entries = [];
  const regex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = regex.exec(xml))) {
    const attrs = match[1] || "";
    const text = stripHtml(match[2] || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const startMatch = attrs.match(/\bt="([^"]+)"/i) || attrs.match(/\bbegin="([^"]+)"/i);
    const durMatch = attrs.match(/\bd="([^"]+)"/i) || attrs.match(/\bdur="([^"]+)"/i);
    const endMatch = attrs.match(/\bend="([^"]+)"/i);
    const startRaw = startMatch ? Number.parseFloat(startMatch[1]) : null;
    const durRaw = durMatch ? Number.parseFloat(durMatch[1]) : null;
    const endRaw = endMatch ? Number.parseFloat(endMatch[1]) : null;
    const start = Number.isFinite(startRaw) ? startRaw : parseClockTime(startMatch?.[1]) || 0;
    let end = Number.isFinite(endRaw) ? endRaw : parseClockTime(endMatch?.[1]);
    let dur = Number.isFinite(durRaw) ? durRaw : parseClockTime(durMatch?.[1]);
    entries.push({
      start,
      dur,
      end,
      text,
    });
  }
  entries.sort((a, b) => (a.start || 0) - (b.start || 0));
  if (!entries.length) return "";
  for (let i = 0; i < entries.length; i += 1) {
    const item = entries[i];
    if (!Number.isFinite(item.end)) {
      if (Number.isFinite(item.dur)) item.end = (item.start || 0) + item.dur;
      else if (entries[i + 1]) item.end = entries[i + 1].start;
    }
    if (!Number.isFinite(item.end)) item.end = (item.start || 0) + 2000;
  }
  const lines = [];
  let idx = 1;
  for (const item of entries) {
    const start = msToSrtTime(item.start || 0);
    const end = msToSrtTime(item.end || ((item.start || 0) + 2000));
    lines.push(String(idx));
    lines.push(`${start} --> ${end}`);
    lines.push(...item.text.split(/\n+/).map((line) => line.trim()).filter(Boolean));
    lines.push("");
    idx += 1;
  }
  return lines.join("\n").trim();
};

const convertTtmlToSrt = (xml = "") => {
  const entries = [];
  const regex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = regex.exec(xml))) {
    const attrs = match[1] || "";
    const text = stripHtml(match[2] || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const beginMatch = attrs.match(/\bbegin="([^"]+)"/i);
    const endMatch = attrs.match(/\bend="([^"]+)"/i);
    const durMatch = attrs.match(/\bdur="([^"]+)"/i);
    const start = parseClockTime(beginMatch?.[1]) || 0;
    let end = parseClockTime(endMatch?.[1]);
    const dur = parseClockTime(durMatch?.[1]);
    entries.push({ start, end, dur, text });
  }
  entries.sort((a, b) => (a.start || 0) - (b.start || 0));
  if (!entries.length) return "";
  for (let i = 0; i < entries.length; i += 1) {
    const item = entries[i];
    if (!Number.isFinite(item.end)) {
      if (Number.isFinite(item.dur)) item.end = (item.start || 0) + item.dur;
      else if (entries[i + 1]) item.end = entries[i + 1].start;
    }
    if (!Number.isFinite(item.end)) item.end = (item.start || 0) + 2000;
  }
  const lines = [];
  let idx = 1;
  for (const item of entries) {
    const start = msToSrtTime(item.start || 0);
    const end = msToSrtTime(item.end || ((item.start || 0) + 2000));
    lines.push(String(idx));
    lines.push(`${start} --> ${end}`);
    lines.push(...item.text.split(/\n+/).map((line) => line.trim()).filter(Boolean));
    lines.push("");
    idx += 1;
  }
  return lines.join("\n").trim();
};

const convertJson3ToSrt = (jsonText = "") => {
  try {
    const data = JSON.parse(jsonText || "{}");
    const events = Array.isArray(data.events) ? data.events : [];
    const entries = [];
    for (const event of events) {
      const start = Number(event.tStartMs || event.tstartMs || 0);
      const dur = Number(event.dDurationMs || event.dur || 0);
      let text = "";
      if (Array.isArray(event.segs)) {
        text = event.segs.map((seg) => (typeof seg?.utf8 === "string" ? seg.utf8 : "")).join("");
      } else if (typeof event.utf8 === "string") {
        text = event.utf8;
      }
      text = stripHtml(text).replace(/\s+/g, " ").trim();
      if (!text) continue;
      entries.push({ start, dur, text });
    }
    if (!entries.length) return "";
    entries.sort((a, b) => (a.start || 0) - (b.start || 0));
    for (let i = 0; i < entries.length; i += 1) {
      const item = entries[i];
      if (!item.dur && entries[i + 1]) item.dur = entries[i + 1].start - item.start;
      if (!item.dur || item.dur <= 0) item.dur = 2000;
    }
    const lines = [];
    let idx = 1;
    for (const item of entries) {
      lines.push(String(idx));
      lines.push(`${msToSrtTime(item.start || 0)} --> ${msToSrtTime((item.start || 0) + item.dur)}`);
      lines.push(...item.text.split(/\n+/).map((line) => line.trim()).filter(Boolean));
      lines.push("");
      idx += 1;
    }
    return lines.join("\n").trim();
  } catch {
    return "";
  }
};

const normalizeSrt = (text = "") => {
  const normalized = (text || "").replace(/\r/g, "").trim();
  if (!normalized) return "";
  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
};

const convertSubtitleToSrt = (content = "", ext = "") => {
  const lower = String(ext || "").toLowerCase();
  if (lower === "srt") return normalizeSrt(content);
  if (lower === "vtt" || lower === "webvtt") return normalizeSrt(vttToSrt(content));
  if (lower === "ttml" || lower === "dfxp" || lower === "xml") return normalizeSrt(convertTtmlToSrt(content));
  if (lower === "srv3" || lower === "srv2" || lower === "srv1") return normalizeSrt(convertSrvXmlToSrt(content));
  if (lower === "json3") return normalizeSrt(convertJson3ToSrt(content));
  const converted = vttToSrt(content);
  if (converted) return normalizeSrt(converted);
  throw new Error(`Format subtitle ${ext || ""} tidak didukung`);
};

const parseLangPreferences = (input) =>
  String(input || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

const wildcardToRegex = (pattern) => {
  if (!pattern) return /^$/i;
  let regex = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "*") {
      regex += ".*";
      continue;
    }
    if (char === "." && pattern[i + 1] === "*") {
      regex += "(?:[._-].*)?";
      i += 1;
      continue;
    }
    if (char === "?") {
      regex += ".";
      continue;
    }
    if (/[[\]{}()+?.,\\^$|#\s]/.test(char)) {
      regex += `\\${char}`;
    } else {
      regex += char;
    }
  }
  return new RegExp(`^${regex}$`, "i");
};

const SUPPORTED_SUB_EXTS = ["srt", "vtt", "webvtt", "ttml", "dfxp", "srv3", "srv2", "srv1", "json3"];

const pickSourceFromCatalog = (catalog = {}, patterns = []) => {
  const entries = Object.entries(catalog || {})
    .map(([lang, sources]) => {
      const list = Array.isArray(sources) ? sources : [sources];
      const filtered = list
        .map((item) => (item && item.url ? { ...item, ext: String(item.ext || "").toLowerCase() } : null))
        .filter(Boolean);
      return filtered.length ? { lang, sources: filtered } : null;
    })
    .filter(Boolean);
  if (!entries.length) return null;

  const pickByPattern = (pattern) => {
    const rx = wildcardToRegex(pattern);
    const match = entries.find((entry) => rx.test(entry.lang));
    if (!match) return null;
    for (const ext of SUPPORTED_SUB_EXTS) {
      const src = match.sources.find((item) => item.ext === ext);
      if (src) return { lang: match.lang, source: src };
    }
    return { lang: match.lang, source: match.sources[0] };
  };

  for (const pattern of patterns) {
    const picked = pickByPattern(pattern);
    if (picked) return picked;
  }

  const english = pickByPattern("en.*") || pickByPattern("en");
  if (english) return english;

  const fallback = entries[0];
  for (const ext of SUPPORTED_SUB_EXTS) {
    const src = fallback.sources.find((item) => item.ext === ext);
    if (src) return { lang: fallback.lang, source: src };
  }
  return { lang: fallback.lang, source: fallback.sources[0] };
};

const sanitizeLangKey = (lang, auto) => {
  const clean = String(lang || (auto ? "auto" : "subtitle"))
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (clean) return clean;
  return auto ? "auto" : "subtitle";
};

const selectSubtitleTrack = (info, { patterns = [], preferAuto = true } = {}) => {
  const entries = Array.isArray(info?.entries) ? info.entries : [info];
  for (const entry of entries) {
    if (!entry) continue;
    const manual = pickSourceFromCatalog(entry.subtitles, patterns);
    const auto = pickSourceFromCatalog(entry.automatic_captions, patterns);
    if (manual && !preferAuto) {
      return { ...manual.source, lang: manual.lang, auto: false };
    }
    if (preferAuto && auto) {
      return { ...auto.source, lang: auto.lang, auto: true };
    }
    if (manual) {
      return { ...manual.source, lang: manual.lang, auto: false };
    }
    if (auto) {
      return { ...auto.source, lang: auto.lang, auto: true };
    }
  }
  return null;
};

const extractJsonFromSource = (source = "", marker = "") => {
  if (!source || !marker) return null;
  const index = source.indexOf(marker);
  if (index === -1) return null;
  let start = index + marker.length;
  while (start < source.length && source[start] !== "{" && source[start] !== "[") {
    start += 1;
  }
  if (start >= source.length) return null;
  const openChar = source[start];
  const closeChar = openChar === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  return null;
};

const parseWatchPlayerResponse = (html = "") => {
  const markers = [
    "ytInitialPlayerResponse = ",
    "ytInitialPlayerResponse=",
    "window[\"ytInitialPlayerResponse\"] = ",
    "window['ytInitialPlayerResponse'] = ",
  ];
  for (const marker of markers) {
    const jsonText = extractJsonFromSource(html, marker);
    if (!jsonText) continue;
    try {
      return JSON.parse(jsonText);
    } catch {
      // ignore and try next marker
    }
  }
  return null;
};

const parseLangFromVssId = (vssId = "") => {
  const value = String(vssId || "").trim();
  if (!value) return "";
  if (value.startsWith("a.")) return value.slice(2);
  if (value.startsWith(".")) return value.slice(1);
  return value;
};

const ensureCaptionUrl = (baseUrl = "", { translateTo } = {}) => {
  if (!baseUrl) return null;
  let url;
  try {
    url = new URL(baseUrl, "https://www.youtube.com");
  } catch {
    return null;
  }
  if (!url.searchParams.get("fmt")) {
    url.searchParams.set("fmt", "srv3");
  }
  const fmt = url.searchParams.get("fmt") || "srv3";
  if (translateTo) {
    url.searchParams.set("tlang", translateTo);
  } else {
    url.searchParams.delete("tlang");
  }
  return { url: url.toString(), ext: fmt.toLowerCase() };
};

const pushCaptionEntry = (catalog, lang, entry) => {
  const key = String(lang || (entry?.auto ? "auto" : "subtitle"))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!key) return;
  if (!catalog[key]) catalog[key] = [];
  catalog[key].push(entry);
};

const buildCaptionCatalogFromTracks = (tracks = []) => {
  const manual = {};
  const auto = {};
  for (const track of tracks) {
    if (!track?.baseUrl) continue;
    const langCode = (track.languageCode || parseLangFromVssId(track.vssId) || "subtitle").toLowerCase();
    const isAuto = track.kind === "asr" || /^a\./i.test(track.vssId || "");
    const base = ensureCaptionUrl(track.baseUrl);
    if (!base) continue;
    const name =
      track.name?.simpleText ||
      (Array.isArray(track.name?.runs) ? track.name.runs.map((run) => run?.text || "").join("") : "");
    const common = {
      url: base.url,
      ext: base.ext,
      name,
      auto: isAuto,
      trackKind: track.kind,
      originalLang: langCode,
    };
    const target = isAuto ? auto : manual;
    pushCaptionEntry(target, langCode, common);

    const translations = Array.isArray(track.translationLanguages)
      ? track.translationLanguages.map((item) => item?.languageCode).filter(Boolean)
      : [];
    for (const translation of translations) {
      const translatedLang = String(translation || "").toLowerCase();
      if (!translatedLang || translatedLang === langCode) continue;
      const translated = ensureCaptionUrl(track.baseUrl, { translateTo: translatedLang });
      if (!translated) continue;
      pushCaptionEntry(target, translatedLang, {
        ...common,
        url: translated.url,
        ext: translated.ext,
        translated: true,
        translatedFrom: langCode,
      });
    }
  }
  return { subtitles: manual, automatic_captions: auto };
};

const extractYouTubeVideoId = (input = "") => {
  const value = String(input || "").trim();
  if (!value) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (/youtu\.be$/i.test(url.hostname)) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] && /^[a-zA-Z0-9_-]{11}$/.test(parts[0])) return parts[0];
    }
    if (/youtube\.com$/i.test(url.hostname)) {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const shorts = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shorts) return shorts[1];
      const embed = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embed) return embed[1];
    }
  } catch {
    // ignore
  }
  const match = value.match(/([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const fetchWithTimeout = async (url, { timeout = 15000, headers = {} } = {}) => {
  if (!fetchImpl) {
    throw new Error("Lingkungan tidak mendukung fetch untuk subtitle");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeout));
  try {
    const response = await safeFetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
        "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        ...headers,
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
};

const fetchSubtitleViaYtDlp = async ({ url, langOpt, preferAuto }) => {
  const args = ["--dump-single-json", "--no-progress", "--skip-download", "--no-warnings"];
  if (ffmpegPath) args.push("--ffmpeg-location", ffmpegPath);
  if (existsSync(COOKIES_PATH)) args.push("--cookies", COOKIES_PATH);
  args.push(url);

  let stdout = "";
  let stderr = "";
  const logs = [`yt-dlp ${args.join(" ")}`];

  try {
    await new Promise((resolve, reject) => {
      const proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
      proc.stdout.on("data", (d) => {
        const chunk = d.toString();
        stdout += chunk;
      });
      proc.stderr.on("data", (d) => {
        const chunk = d.toString();
        stderr += chunk;
      });
      proc.on("error", (err) => {
        const error = new Error("yt-dlp tidak bisa dijalankan");
        error.cause = err;
        reject(error);
      });
      proc.on("close", (code) => {
        if (code !== 0) {
          const error = new Error("yt-dlp gagal mengambil metadata subtitle");
          reject(error);
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    const error = new Error(err.message || "yt-dlp gagal");
    error.logs = [...logs, stdout, stderr].filter(Boolean).join("\n");
    throw error;
  }

  const patterns = parseLangPreferences(langOpt);
  let info;
  try {
    info = JSON.parse(stdout || "{}");
  } catch (err) {
    const error = new Error("Respons yt-dlp tidak valid");
    error.logs = [...logs, stderr, stdout].filter(Boolean).join("\n");
    throw error;
  }

  const track = selectSubtitleTrack(info, { patterns, preferAuto });
  if (!track || !track.url) {
    const error = new Error("Subtitle tidak ditemukan");
    error.logs = [...logs, stderr, stdout].filter(Boolean).join("\n");
    throw error;
  }

  let body;
  try {
    const response = await fetchWithTimeout(track.url, {});
    if (!response.ok) {
      const error = new Error(`Gagal mengunduh subtitle (${response.status})`);
      error.logs = [...logs, stderr, stdout, `HTTP ${response.status}`].filter(Boolean).join("\n");
      throw error;
    }
    body = await response.text();
  } catch (err) {
    if (err.logs) throw err;
    const error = new Error(err.message || "Gagal mengambil subtitle");
    error.logs = [...logs, stderr, stdout].filter(Boolean).join("\n");
    throw error;
  }

  let srt;
  try {
    srt = convertSubtitleToSrt(body, track.ext);
  } catch (err) {
    const error = new Error(err.message || "Gagal mengonversi subtitle");
    error.logs = [...logs, stderr, stdout].filter(Boolean).join("\n");
    throw error;
  }

  const safeLang = sanitizeLangKey(track.lang, track.auto);
  return {
    srt,
    safeLang,
    lang: track.lang || safeLang,
    auto: Boolean(track.auto),
    logs: [...logs, stderr].filter(Boolean).join("\n").slice(-8000),
  };
};

const fetchSubtitleViaWatch = async ({ url, langOpt, preferAuto }) => {
  const logs = [];
  const appendLog = (value) => {
    if (!value) return;
    logs.push(value);
  };

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    const error = new Error("ID video YouTube tidak dikenali");
    error.logs = logs.join("\n");
    throw error;
  }

  const watchUrl = new URL("https://www.youtube.com/watch");
  watchUrl.searchParams.set("v", videoId);
  watchUrl.searchParams.set("hl", "en");
  watchUrl.searchParams.set("bpctr", "9999999999");
  watchUrl.searchParams.set("has_verified", "1");
  appendLog(`fetch ${watchUrl.toString()}`);

  let html;
  try {
    const response = await fetchWithTimeout(watchUrl.toString(), {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,id;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
      },
    });
    appendLog(`watch status ${response.status}`);
    if (!response.ok) {
      const error = new Error(`Gagal membuka halaman YouTube (HTTP ${response.status})`);
      error.logs = logs.join("\n");
      throw error;
    }
    html = await response.text();
  } catch (err) {
    if (err?.logs) throw err;
    const error = new Error(err.message || "Gagal membuka halaman YouTube");
    error.logs = logs.join("\n");
    throw error;
  }

  const playerResponse = parseWatchPlayerResponse(html);
  if (!playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
    const error = new Error("Subtitle tidak ditemukan di halaman YouTube");
    error.logs = logs.join("\n");
    throw error;
  }

  const catalog = buildCaptionCatalogFromTracks(
    playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks,
  );

  const patterns = parseLangPreferences(langOpt);
  const track = selectSubtitleTrack({ entries: [{ ...catalog }] }, { patterns, preferAuto });
  if (!track || !track.url) {
    const error = new Error("Subtitle tidak ditemukan");
    error.logs = logs.join("\n");
    throw error;
  }

  appendLog(
    `pilih track ${track.lang || track.originalLang || "unknown"} (${track.ext || "srv3"})${
      track.translated ? " · translate" : ""
    }${track.auto ? " · auto" : ""}`,
  );

  let body;
  try {
    const response = await fetchWithTimeout(track.url, {
      headers: {
        "accept-language": "en-US,en;q=0.9,id;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
      },
    });
    appendLog(`subtitle status ${response.status}`);
    if (!response.ok) {
      const error = new Error(`Gagal mengunduh subtitle (HTTP ${response.status})`);
      error.logs = logs.join("\n");
      throw error;
    }
    body = await response.text();
  } catch (err) {
    if (err?.logs) throw err;
    const error = new Error(err.message || "Gagal mengambil subtitle");
    error.logs = logs.join("\n");
    throw error;
  }

  let srt;
  try {
    srt = convertSubtitleToSrt(body, track.ext);
  } catch (err) {
    const error = new Error(err.message || "Gagal mengonversi subtitle");
    error.logs = logs.join("\n");
    throw error;
  }

  const safeLang = sanitizeLangKey(track.lang, track.auto);
  return {
    srt,
    safeLang,
    lang: track.lang || safeLang,
    auto: Boolean(track.auto),
    translated: Boolean(track.translated),
    translatedFrom: track.translatedFrom || track.originalLang || null,
    originalLang: track.originalLang || null,
    logs: logs.join("\n").slice(-8000),
  };
};

const fetchSubtitleViaPyTube = async ({ url, langOpt, preferAuto }) => {
  const args = [
    join(__dirname, "download_subtitle.py"),
    url,
    langOpt || "",
    preferAuto ? "1" : "0",
  ];
  let stdout = "";
  let stderr = "";
  const logs = [`python3 ${args.map((arg) => (arg.includes(" ") ? `"${arg}"` : arg)).join(" ")}`];
  try {
    await new Promise((resolve, reject) => {
      const proc = spawn("python3", args, { stdio: ["ignore", "pipe", "pipe"] });
      proc.stdout.on("data", (d) => {
        stdout += d.toString();
      });
      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });
      proc.on("error", (err) => {
        const error = new Error("PyTube tidak bisa dijalankan");
        error.cause = err;
        reject(error);
      });
      proc.on("close", (code) => {
        if (code !== 0) {
          const error = new Error("PyTube gagal mengambil subtitle");
          reject(error);
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    const error = new Error(err.message || "PyTube gagal mengambil subtitle");
    error.logs = [...logs, stderr].filter(Boolean).join("\n");
    throw error;
  }

  try {
    const parsed = JSON.parse(stdout || "{}");
    if (!parsed.srt) {
      throw new Error("Subtitle kosong");
    }
    return {
      srt: parsed.srt,
      lang: parsed.lang,
      safeLang: sanitizeLangKey(parsed.lang, parsed.auto),
      auto: Boolean(parsed.auto),
      logs: [...logs, stderr].filter(Boolean).join("\n").slice(-8000),
    };
  } catch (err) {
    const error = new Error(err.message || "PyTube menghasilkan data tidak valid");
    error.logs = [...logs, stderr, stdout].filter(Boolean).join("\n");
    throw error;
  }
};

const srtToPlainText = (input = "") => {
  const normalized = (input || "").replace(/\r/g, "");
  const blocks = normalized.split(/\n\n+/);
  const texts = [];
  for (const block of blocks) {
    const lines = block.split(/\n+/).map((line) => line.trim());
    if (!lines.length) continue;
    let cursor = 0;
    if (/^\d+$/.test(lines[cursor])) cursor += 1;
    if (cursor < lines.length && lines[cursor].includes("-->")) cursor += 1;
    const content = lines
      .slice(cursor)
      .map((line) => line.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (content) texts.push(content);
  }
  return texts.join("\n");
};

const buildSubtitlePreview = (text = "") =>
  (text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join("\n");

const ffmpegToMp3 = (input, output, opts = {}) => {
  const { abr = 192, id3 = {}, trim = {}, sampleRate, cover, filters = [] } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !isNaN(start);
    const hasEnd = typeof end === "number" && !isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (cover) args.push("-i", cover);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    applyAudioFilters(args, filters);
    for (const [k, v] of Object.entries(id3 || {})) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        args.push("-metadata", `${k}=${v}`);
      }
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    if (cover) {
      args.push(
        "-map","0:a","-map","1:v",
        "-id3v2_version","3",
        "-c:v","mjpeg",
        "-metadata:s:v","title=Album cover",
        "-metadata:s:v","comment=Cover (front)",
        "-disposition:v:0","attached_pic"
      );
    } else {
      args.push("-map","0:a","-vn");
    }
    args.push("-codec:a","libmp3lame","-b:a",`${abr}k`, output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegToFlac = (input, output, opts = {}) => {
  const { id3 = {}, trim = {}, sampleRate, cover, filters = [] } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !isNaN(start);
    const hasEnd   = typeof end === "number" && !isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (cover) args.push("-i", cover);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    applyAudioFilters(args, filters);
    for (const [k, v] of Object.entries(id3 || {})) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        args.push("-metadata", `${k}=${v}`);
      }
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    if (cover) {
      args.push(
        "-map","0:a","-map","1:v",
        "-c:v","mjpeg",
        "-metadata:s:v","title=Album cover",
        "-metadata:s:v","comment=Cover (front)",
        "-disposition:v:0","attached_pic"
      );
    } else {
      args.push("-map","0:a","-vn");
    }
    args.push("-codec:a","flac","-compression_level","12", output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegToM4a = (input, output, opts = {}) => {
  const { id3 = {}, trim = {}, sampleRate, cover, filters = [], abr = 192 } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !isNaN(start);
    const hasEnd = typeof end === "number" && !isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (cover) args.push("-i", cover);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    applyAudioFilters(args, filters);
    for (const [k, v] of Object.entries(id3 || {})) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        args.push("-metadata", `${k}=${v}`);
      }
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    if (cover) {
      args.push(
        "-map","0:a","-map","1:v",
        "-c:v","mjpeg",
        "-metadata:s:v","title=Album cover",
        "-metadata:s:v","comment=Cover (front)",
        "-disposition:v:0","attached_pic"
      );
    } else {
      args.push("-map","0:a","-vn");
    }
    const targetAbr = Number(abr) || 192;
    args.push("-codec:a","aac","-b:a",`${targetAbr}k`, output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegToWav = (input, output, opts = {}) => {
  const { trim = {}, sampleRate, filters = [] } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !isNaN(start);
    const hasEnd = typeof end === "number" && !isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    applyAudioFilters(args, filters);
    args.push("-map", "0:a", "-vn", "-codec:a", "pcm_s16le", output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegToOgg = (input, output, opts = {}) => {
  const { trim = {}, sampleRate, filters = [] } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !isNaN(start);
    const hasEnd = typeof end === "number" && !isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    applyAudioFilters(args, filters);
    args.push("-map", "0:a", "-vn", "-codec:a", "libvorbis", "-qscale:a", "5", output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegCreateRingtone = (input, output, opts = {}) => {
  const {
    start = 0,
    duration = 30,
    fadeIn = 0.6,
    fadeOut = 1.2,
    codecArgs = [],
  } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    if (start > 0) args.push("-ss", String(start));
    args.push("-i", input);
    if (duration > 0) args.push("-t", String(duration));
    args.push("-ac", "2", "-ar", "44100");
    const fades = [];
    if (fadeIn > 0) fades.push(`afade=t=in:st=0:d=${fadeIn.toFixed(2)}`);
    if (fadeOut > 0) {
      const fadeStart = Math.max(duration - fadeOut, 0);
      fades.push(`afade=t=out:st=${fadeStart.toFixed(2)}:d=${fadeOut.toFixed(2)}`);
    }
    if (fades.length) {
      args.push("-af", fades.join(","));
    }
    args.push(...codecArgs, output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const createRingtoneVariants = async ({ sourcePath, id, baseName, trimOpt, request = {} }) => {
  const enabled = request && (request.enabled === true || request.enabled === "true" || request.enabled === 1);
  if (!enabled || !sourcePath) return [];
  const variants = [];
  const length = clamp(Number(request.length) || 30, 5, 60);
  const fadeIn = clamp(Number(request.fadeIn) || 0.6, 0, 10);
  const fadeOut = clamp(Number(request.fadeOut) || 1.2, 0, 10);
  const start = trimOpt?.start ? Math.max(Number(trimOpt.start), 0) : 0;
  const stem = sanitizeFileName(request.fileStem || `${baseName || id}-ringtone`) || `${id}-ringtone`;

  const addVariant = async ({ ext, codecArgs, platform }) => {
    const outName = `${id}.ring.${ext}`;
    const outputPath = join(JOBS_DIR, outName);
    await ffmpegCreateRingtone(sourcePath, outputPath, {
      start,
      duration: length,
      fadeIn,
      fadeOut,
      codecArgs,
    });
    variants.push({
      format: ext,
      platform,
      downloadUrl: `/public/jobs/${outName}`,
      fileName: `${stem}.${ext}`,
      duration: length,
    });
  };

  try {
    await addVariant({
      ext: "m4r",
      platform: "iphone",
      codecArgs: ["-c:a", "aac", "-b:a", "192k"],
    });
  } catch (err) {
    console.warn("Gagal membuat ringtone m4r", err);
  }

  try {
    await addVariant({
      ext: "ogg",
      platform: "android",
      codecArgs: ["-c:a", "libvorbis", "-qscale:a", "5"],
    });
  } catch (err) {
    console.warn("Gagal membuat ringtone ogg", err);
  }

  return variants;
};

const COOKIES_PATH = "/tmp/cookies.txt"; // endpoint admin di bawah akan nulis ke sini

const runYtDlpDownload = ({ args, id }) =>
  new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    proc.stdout.on("data", (d) => (logs += d.toString()));
    proc.stderr.on("data", (d) => (logs += d.toString()));
    proc.on("error", (err) => {
      const error = new Error("yt-dlp tidak bisa dijalankan");
      error.cause = err;
      error.logs = logs;
      reject(error);
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        const error = new Error("yt-dlp gagal");
        error.logs = logs;
        return reject(error);
      }
      const files = readdirSync(JOBS_DIR).filter(
        (f) => f.startsWith(`${id}.`) && !f.endsWith(".cover.jpg")
      );
      if (!files.length) {
        const error = new Error("Output tidak ditemukan");
        error.logs = logs;
        return reject(error);
      }
      const filename = files[0];
      const fullPath = join(JOBS_DIR, filename);
      const ext = filename.split(".").pop();
      resolve({ filename, fullPath, ext, logs });
    });
  });

const runPythonDownload = ({ url, id, baseLogs = "" }) =>
  new Promise((resolve, reject) => {
    let pyLogs = "";
    let pyOut = "";
    const py = spawn("python3", [
      join(__dirname, "download_audio.py"),
      url,
      JOBS_DIR,
      id,
    ], { stdio: ["ignore", "pipe", "pipe"] });

    py.stdout.on("data", (d) => {
      const s = d.toString();
      pyLogs += s;
      pyOut += s;
    });
    py.stderr.on("data", (d) => (pyLogs += d.toString()));

    py.on("error", (err) => {
      const error = new Error("Downloader helper tidak bisa dijalankan");
      error.cause = err;
      error.logs = baseLogs + pyLogs;
      reject(error);
    });

    py.on("close", async (code) => {
      if (code !== 0) {
        const error = new Error("Downloader helper gagal");
        error.logs = baseLogs + pyLogs;
        return reject(error);
      }
      try {
        const dlPath = pyOut.trim().split("\n").pop().trim();
        let ext = dlPath.split(".").pop();
        let filename = `${id}.${ext}`;
        let fullPath = join(JOBS_DIR, filename);
        if (dlPath !== fullPath) await fsp.rename(dlPath, fullPath);
        resolve({ filename, fullPath, ext, logs: baseLogs + pyLogs });
      } catch (err) {
        const error = new Error(err.message || "Downloader helper output tidak valid");
        error.logs = baseLogs + pyLogs;
        reject(error);
      }
    });
  });

const convertSingle = async (payload = {}) => {
  const {
    format = "mp3",
    abr = 192,
    sampleRate,
    fileName,
    noPlaylist = true,
    id3 = {},
    trim,
    normalize = false,
    atmos = false,
    speedMode = "normal",
    denoise = false,
    volumeBoost = 0,
    enhancer = "none",
  } = payload;

  let coverUrl = typeof payload.coverUrl === "string" ? payload.coverUrl : undefined;
  let url = typeof payload.url === "string" ? payload.url.trim() : "";
  const keywordQuery = typeof payload.keyword === "string" ? payload.keyword.trim() : "";
  const preferredLangRaw = typeof payload.preferredLang === "string" ? payload.preferredLang.trim() : "";
  const preferredLang = normalizePreferredLang(preferredLangRaw);
  const ringtoneRequest = payload.ringtone || {};

  let metadata = null;
  if (!url || !/^https?:\/\//.test(url)) {
    if (!keywordQuery) {
      throw new Error("URL atau kata kunci tidak valid");
    }
    try {
      metadata = await fetchVideoInfo({ keyword: keywordQuery, preferLang: preferredLang });
      url = metadata?.webpageUrl || "";
    } catch (err) {
      const error = new Error(err?.message || "Tidak menemukan hasil pencarian");
      error.logs = err?.logs;
      throw error;
    }
  }

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error("URL tidak valid");
  }

  if (!metadata) {
    metadata = await fetchVideoInfo({ url, preferLang: preferredLang }).catch(() => null);
  }

  if (!coverUrl && metadata?.cover) {
    coverUrl = metadata.cover;
  }

  const fmt = String(format || "").toLowerCase();
  if (!SUPPORTED_FORMATS.has(fmt)) {
    throw new Error("Format tidak didukung");
  }
  if (!VALID_SPEED_MODES.has(speedMode || "normal")) {
    throw new Error("Mode kecepatan tidak dikenali");
  }

  const denoiseEnabled = typeof denoise === "string"
    ? ["1", "true", "yes", "on"].includes(denoise.toLowerCase())
    : !!denoise;

  let boostValue = Number(volumeBoost);
  if (Number.isNaN(boostValue)) boostValue = 0;
  boostValue = clamp(boostValue, -20, 20);

  const enhancerKey = typeof enhancer === "string" ? enhancer.trim().toLowerCase() : "none";
  const VALID_ENHANCERS = new Set(["none", "clarity", "warm", "club"]);
  const enhancerMode = VALID_ENHANCERS.has(enhancerKey) ? enhancerKey : "none";

  let sr;
  if (sampleRate !== undefined) {
    sr = Number(sampleRate);
    if (Number.isNaN(sr) || sr <= 0) {
      throw new Error("sampleRate tidak valid");
    }
  }

  const sanitizedOptions = sanitizeFormatOptions(fmt, { abr, sampleRate: sr, speedMode });
  const effectiveSpeedMode = sanitizedOptions.speedMode || "normal";
  const targetAbr = sanitizedOptions.abr != null ? sanitizedOptions.abr : (fmt === "mp3" ? Number(abr) || 192 : null);
  sr = sanitizedOptions.sampleRate !== undefined ? sanitizedOptions.sampleRate : sr;

  let trimOpt = null;
  if (trim && (trim.start !== undefined || trim.end !== undefined)) {
    const hasStart = trim.start !== undefined;
    const hasEnd = trim.end !== undefined;
    const startVal = hasStart ? Number(trim.start) : 0;
    const endVal = hasEnd ? Number(trim.end) : undefined;
    if ((hasStart && Number.isNaN(startVal)) ||
        (hasEnd && Number.isNaN(endVal)) ||
        (hasStart && hasEnd && endVal < startVal)) {
      throw new Error("trim tidak valid");
    }
    trimOpt = {};
    if (hasStart) trimOpt.start = startVal;
    if (hasEnd) trimOpt.end = endVal;
  }

  const id = nanoid(10);
  const outTpl = join(JOBS_DIR, `${id}.%(ext)s`);
  const metaBase = metadata?.cleanTitle || metadata?.title || keywordQuery || "";
  const baseName = sanitizeFileName(fileName || id3.title || metaBase || id) || id;

  let coverPath = null;
  if (coverUrl && /^https?:\/\//.test(coverUrl) && ["mp3", "m4a", "flac"].includes(fmt)) {
    try {
      const imgResp = await safeFetch(coverUrl);
      if (imgResp.ok) {
        const buf = Buffer.from(await imgResp.arrayBuffer());
        coverPath = join(JOBS_DIR, `${id}.cover.jpg`);
        await fsp.writeFile(coverPath, buf);
      }
    } catch {}
  }

  const args = ["--newline", "--no-progress"];
  if (ffmpegPath) {
    args.push("--ffmpeg-location", ffmpegPath);
  }
  if (existsSync(COOKIES_PATH)) {
    args.push("--cookies", COOKIES_PATH);
  }
  if (noPlaylist) args.push("--no-playlist");
  if (atmos) args.push("-f", "bestaudio[channels>2]/bestaudio");
  args.push("-o", outTpl);

  const sanitizedAbrForDownload = targetAbr || Number(abr) || undefined;

  if (fmt === "m4a") {
    args.push("-f", "bestaudio[ext=m4a]/bestaudio");
  } else if (fmt === "flac") {
    args.push("-x", "--audio-format", "flac");
  } else if (fmt === "mp3") {
    args.push("-x", "--audio-format", "mp3", "--audio-quality", abrToQ(sanitizedAbrForDownload));
  } else if (fmt === "wav") {
    args.push("-x", "--audio-format", "wav");
  } else if (fmt === "ogg") {
    args.push("-x", "--audio-format", "ogg");
  }
  args.push(url);

  let logs = "";
  let downloadResult;

  try {
    downloadResult = await runYtDlpDownload({ args, id });
    logs = downloadResult.logs || "";
  } catch (err) {
    const baseLogs = err.logs || "";
    try {
      downloadResult = await runPythonDownload({ url, id, baseLogs });
      logs = downloadResult.logs || baseLogs;
    } catch (pyErr) {
      if (coverPath) try { await fsp.unlink(coverPath); } catch {}
      const finalError = new Error(pyErr.message || err.message || "Gagal mengunduh");
      finalError.logs = (pyErr.logs || baseLogs || "").slice(-8000);
      throw finalError;
    }
  }

  let { filename, fullPath, ext } = downloadResult;
  logs = downloadResult.logs || logs;

  const audioProbe = await probeAudioStream(fullPath).catch(() => null);
  const detectedSampleRate = audioProbe?.sampleRate;
  const filterSampleRate = deriveFilterSampleRate(fmt, sr, detectedSampleRate);
  const filters = buildAudioFilters({
    normalize,
    speedMode: effectiveSpeedMode,
    denoise: denoiseEnabled,
    volumeBoost: boostValue,
    enhancer: enhancerMode,
    sampleRate: filterSampleRate,
    sourceSampleRate: detectedSampleRate,
  });

  const id3Clean = Object.entries(id3 || {}).reduce((acc, [k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") acc[k] = v;
    return acc;
  }, {});
  if (!id3Clean.title && metadata?.id3?.title) id3Clean.title = metadata.id3.title;
  if (!id3Clean.artist && metadata?.id3?.artist) id3Clean.artist = metadata.id3.artist;
  if (!id3Clean.album && metadata?.id3?.album) id3Clean.album = metadata.id3.album;
  if (!id3Clean.genre) {
    const autoGenre = buildAiTags({
      title: id3Clean.title || baseName,
      channel: id3Clean.artist || "",
    }).genre;
    if (autoGenre) id3Clean.genre = autoGenre;
  }
  const hasId3 = Object.keys(id3Clean).length > 0;
  const hasTrim = !!trimOpt && Object.keys(trimOpt).length > 0;
  const hasFilters = filters.length > 0;
  const hasCover = !!coverPath;
  const rule = FORMAT_RULES[fmt];
  const detectedRate = parseSampleRate(detectedSampleRate);
  const needSampleRate = sr !== undefined || (!!rule?.sampleRates?.length && !rule.sampleRates.includes(detectedRate));
  const finalSamplePreference = sr !== undefined ? sr : (needSampleRate ? filterSampleRate : undefined);

  const finalize = async (targetExt, converter, extraOpts = {}) => {
    const tmpOut = join(JOBS_DIR, `${id}.tmp.${targetExt}`);
    await converter(fullPath, tmpOut, {
      ...extraOpts,
      trim: trimOpt || {},
      sampleRate: finalSamplePreference,
      filters,
    });
    await fsp.unlink(fullPath);
    filename = `${id}.${targetExt}`;
    fullPath = join(JOBS_DIR, filename);
    await fsp.rename(tmpOut, fullPath);
    ext = targetExt;
  };

  try {
    if (fmt === "mp3") {
      const needConvert = ext !== "mp3" || hasId3 || hasTrim || hasFilters || hasCover || needSampleRate;
      if (needConvert) {
        await finalize("mp3", ffmpegToMp3, { abr: targetAbr || 192, id3: id3Clean, cover: coverPath });
      }
    } else if (fmt === "flac") {
      const needConvert = ext !== "flac" || hasId3 || hasTrim || hasFilters || hasCover || needSampleRate;
      if (needConvert) {
        await finalize("flac", ffmpegToFlac, { id3: id3Clean, cover: coverPath });
      }
    } else if (fmt === "m4a") {
      const needConvert = ext !== "m4a" || hasId3 || hasTrim || hasFilters || hasCover || needSampleRate;
      if (needConvert) {
        await finalize("m4a", ffmpegToM4a, { id3: id3Clean, cover: coverPath, abr: targetAbr || 192 });
      }
    } else if (fmt === "wav") {
      const needConvert = ext !== "wav" || hasTrim || hasFilters || needSampleRate;
      if (needConvert) {
        await finalize("wav", ffmpegToWav, {});
      }
    } else if (fmt === "ogg") {
      const needConvert = ext !== "ogg" || hasTrim || hasFilters || needSampleRate;
      if (needConvert) {
        await finalize("ogg", ffmpegToOgg, {});
      }
    }
  } catch (err) {
    if (coverPath) try { await fsp.unlink(coverPath); } catch {}
    const error = new Error(err.message || "ffmpeg gagal");
    error.logs = (logs + (err.logs || "")).slice(-8000);
    throw error;
  }

  if (coverPath) try { await fsp.unlink(coverPath); } catch {}

  const downloadUrl = `/public/jobs/${filename}`;
  const finalExt = ext;
  const downloadFileName = `${baseName}.${finalExt}`;
  const finalSampleRate = finalSamplePreference
    ? Math.round(finalSamplePreference)
    : (filters.some((f) => /^aresample=/.test(f)) ? filterSampleRate : detectedSampleRate) || null;
  const metadataResponse = metadata
    ? {
        id: metadata.id || null,
        title: metadata.title || null,
        cleanTitle: metadata.cleanTitle || null,
        author: metadata.author || null,
        artist: metadata.artist || null,
        album: metadata.album || null,
        cover: metadata.cover || null,
        duration: metadata.duration || null,
        webpageUrl: metadata.webpageUrl || null,
        keywords: metadata.keywords || [],
        languages: metadata.languages || [],
        keywordUsed: metadata.keywordUsed || false,
      }
    : null;
  const ringtoneVariants = await createRingtoneVariants({
    sourcePath: fullPath,
    id,
    baseName,
    trimOpt,
    request: ringtoneRequest,
  });

  return {
    ok: true,
    id,
    format: finalExt,
    downloadUrl,
    fileName: downloadFileName,
    logs: (logs || "").slice(-8000),
    baseName,
    fullPath,
    ext: finalExt,
    sampleRate: finalSampleRate,
    channels: audioProbe?.channels || null,
    speedMode: effectiveSpeedMode,
    metadata: metadataResponse,
    ringtones: ringtoneVariants,
  };
};

const downloadSubtitle = async (payload = {}) => {
  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL tidak valid");
  }

  const preferAuto = payload.preferAuto !== false;
  const langOpt = typeof payload.lang === "string" && payload.lang.trim() ? payload.lang.trim() : "id.*,en.*,en";
  const baseOutput = sanitizeFileName(payload.fileName || payload.title || "subtitle");
  const downloadBase = baseOutput || "subtitle";

  const id = nanoid(10);
  let logs = "";
  let finalSrtName = "";
  let finalTxtName = "";
  const errors = [];
  const appendLogs = (value) => {
    logs = [logs, value].filter(Boolean).join("\n").slice(-8000);
  };
  const attempt = async (fn) => {
    try {
      const output = await fn();
      appendLogs(output?.logs);
      return output;
    } catch (err) {
      errors.push(err);
      appendLogs(err?.logs);
      return null;
    }
  };

  let result = await attempt(() => fetchSubtitleViaYtDlp({ url, langOpt, preferAuto }));
  if (!result) {
    result = await attempt(() => fetchSubtitleViaWatch({ url, langOpt, preferAuto }));
  }
  if (!result) {
    result = await attempt(() => fetchSubtitleViaPyTube({ url, langOpt, preferAuto }));
  }
  if (!result) {
    const message =
      errors[errors.length - 1]?.message || errors[0]?.message || "Gagal mengambil subtitle";
    const error = new Error(message);
    error.logs = logs;
    throw error;
  }

  const fetchError = errors[0] || null;

  try {
    const safeLang = result.safeLang || sanitizeLangKey(result.lang, result.auto);
    const finalStem = `${id}.${safeLang}`;
    finalSrtName = `${finalStem}.srt`;
    const srtPath = join(JOBS_DIR, finalSrtName);
    await fsp.writeFile(srtPath, result.srt, "utf8");

    const plain = srtToPlainText(result.srt);
    const lines = plain
      ? plain
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
      : [];
    const words = plain
      ? plain
          .trim()
          .split(/\s+/)
          .filter(Boolean)
      : [];
    const preview = buildSubtitlePreview(plain);
    finalTxtName = `${finalStem}.txt`;
    const txtPath = join(JOBS_DIR, finalTxtName);
    await fsp.writeFile(txtPath, `${plain}\n`, "utf8");

    return {
      ok: true,
      logs,
      lang: safeLang,
      auto: Boolean(result.auto),
      srtUrl: `/public/jobs/${finalSrtName}`,
      srtFileName: `${downloadBase}.${safeLang}.srt`,
      txtUrl: `/public/jobs/${finalTxtName}`,
      txtFileName: `${downloadBase}.${safeLang}.txt`,
      preview,
      text: plain,
      lineCount: lines.length,
      wordCount: words.length,
      translated: Boolean(result.translated),
      translatedFrom: result.translatedFrom || null,
      originalLang: result.originalLang || null,
    };
  } catch (err) {
    if (finalSrtName) {
      try { await fsp.unlink(join(JOBS_DIR, finalSrtName)); } catch {}
    }
    if (finalTxtName) {
      try { await fsp.unlink(join(JOBS_DIR, finalTxtName)); } catch {}
    }
    const message = err.message || fetchError?.message || "Gagal mengambil subtitle";
    const error = new Error(message);
    error.logs = [logs, err.logs || ""].filter(Boolean).join("\n").slice(-8000);
    throw error;
  }
};

// ==== Serve static UI & hasil unduhan ====
app.get("/manifest.webmanifest", (req, res) => {
  res.setHeader("Content-Type", "application/manifest+json");
  res.sendFile(join(__dirname, "public-ui", "manifest.webmanifest"));
});

app.use("/", express.static(join(__dirname, "public-ui")));
app.use("/public", express.static(PUBLIC_DIR));

// ==== Assistant chat ====
app.post("/api/assistant-chat", (req, res) => {
  try {
    const { prompt = "" } = req.body || {};
    const trimmed = typeof prompt === "string" ? prompt.trim() : String(prompt ?? "").trim();
    if (!trimmed) {
      return res.status(400).json({ error: "Prompt wajib diisi" });
    }
    const result = buildAssistantResponse(trimmed);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Gagal memproses percakapan" });
  }
});

// ==== API convert ====
app.post("/api/convert", async (req, res) => {
  try {
    const result = await convertSingle(req.body || {});
    return res.json(result);
  } catch (e) {
    const msg = e?.message || "Gagal memproses";
    const status = /tidak valid|tidak dikenali/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg, logs: e?.logs });
  }
});

app.post("/api/video-info", async (req, res) => {
  try {
    const body = req.body || {};
    const preferLang = normalizePreferredLang(body.lang || body.preferredLang);
    const info = await fetchVideoInfo({
      url: body.url,
      keyword: body.keyword,
      preferLang,
    });
    return res.json({ ok: true, info });
  } catch (e) {
    const msg = e?.message || "Gagal mengambil info video";
    const status = /tidak valid|kata kunci/i.test(msg)
      ? 400
      : /tidak ditemukan/i.test(msg)
        ? 404
        : 500;
    return res.status(status).json({ error: msg, logs: e?.logs });
  }
});

app.post("/api/search", async (req, res) => {
  try {
    const body = req.body || {};
    const preferLang = normalizePreferredLang(body.lang || body.preferredLang);
    const results = await searchYoutubeVideos({
      query: body.query || body.keyword,
      limit: body.limit,
      preferLang,
    });
    return res.json({ ok: true, results });
  } catch (e) {
    const msg = e?.message || "Gagal mencari video";
    const status = /kosong|valid/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg, logs: e?.logs });
  }
});

app.post("/api/background", (req, res) => {
  try {
    const job = enqueueBackgroundJob(req.body || {});
    return res.json({ ok: true, job: serializeJob(job) });
  } catch (e) {
    const msg = e?.message || "Gagal membuat job";
    const status = /tidak valid|tidak dikenali|batas/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg });
  }
});

app.get("/api/background", (req, res) => {
  const jobs = Array.from(backgroundJobs.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 25)
    .map(serializeJob);
  return res.json({ ok: true, jobs });
});

app.get("/api/background/:id", (req, res) => {
  const job = backgroundJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job tidak ditemukan" });
  return res.json({ ok: true, job: serializeJob(job) });
});

app.post("/api/ai-tags", (req, res) => {
  try {
    const body = req.body || {};
    const tags = buildAiTags({
      title: body.title,
      description: body.description,
      channel: body.channel,
      duration: body.duration,
    });
    return res.json({ ok: true, tags });
  } catch (e) {
    const msg = e?.message || "Gagal membuat tag";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-caption", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiCaption({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      speedMode: body.speedMode,
      denoise: body.denoise,
      volumeBoost: body.volumeBoost,
      enhancer: body.enhancer,
      format: body.format,
    });
    return res.json({ ok: true, caption: result.caption, hashtags: result.hashtags, tags: result.tags });
  } catch (e) {
    const msg = e?.message || "Gagal membuat caption";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-pitch", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiPitch({
      title: body.title,
      description: body.description,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      mood: body.mood,
    });
    return res.json({
      ok: true,
      pitch: result.pitch,
      hook: result.hook,
      playlists: result.playlists,
      tags: result.tags,
    });
  } catch (e) {
    const msg = e?.message || "Gagal membuat pitch";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-audiophile", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiAudiophileGuide({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      mood: body.mood,
      format: body.format,
      sampleRate: body.sampleRate,
      speedMode: body.speedMode,
      enhancer: body.enhancer,
      denoise: body.denoise,
      volumeBoost: body.volumeBoost,
      normalize: body.normalize,
    });
    return res.json({ ok: true, guide: result });
  } catch (e) {
    const msg = e?.message || "Gagal membuat panduan audiophile";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-hook", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiHook({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      speedMode: body.speedMode,
      volumeBoost: body.volumeBoost,
      enhancer: body.enhancer,
      denoise: body.denoise,
      eq: body.eq,
    });
    return res.json({ ok: true, ...result });
  } catch (e) {
    const msg = e?.message || "Gagal membuat hook";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-cover", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiCoverPrompt({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      format: body.format,
      speedMode: body.speedMode,
      enhancer: body.enhancer,
      volumeBoost: body.volumeBoost,
      denoise: body.denoise,
      normalize: body.normalize,
      eq: body.eq,
    });
    return res.json({ ok: true, ...result });
  } catch (e) {
    const msg = e?.message || "Gagal membuat prompt cover";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-release", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiReleasePlan({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      format: body.format,
      speedMode: body.speedMode,
      backgroundMode: body.backgroundMode,
      autoDownload: body.autoDownload,
      queueLength: body.queueLength,
      hasPlaylist: body.hasPlaylist,
      volumeBoost: body.volumeBoost,
    });
    return res.json({ ok: true, plan: result.plan, summary: result.summary, focus: result.focus });
  } catch (e) {
    const msg = e?.message || "Gagal membuat timeline";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-presskit", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiPressKit({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      mood: body.mood,
      format: body.format,
    });
    return res.json({ ok: true, presskit: result });
  } catch (e) {
    const msg = e?.message || "Gagal membuat press kit";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-outreach", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiOutreachEmail({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      mood: body.mood,
      target: body.target,
    });
    return res.json({ ok: true, outreach: result });
  } catch (e) {
    const msg = e?.message || "Gagal membuat email";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-lyrics", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiLyricTeaser({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      mood: body.mood,
    });
    return res.json({ ok: true, teaser: result });
  } catch (e) {
    const msg = e?.message || "Gagal membuat teaser lirik";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/subtitle", async (req, res) => {
  try {
    const result = await downloadSubtitle(req.body || {});
    return res.json(result);
  } catch (e) {
    const msg = e?.message || "Gagal mengambil subtitle";
    const status = /tidak valid/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg, logs: e?.logs });
  }
});

// ==== API convert playlist (ZIP) ====
app.post("/api/convert-playlist", async (req, res) => {
  try {
    const body = req.body || {};
    const rawItems = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.urls)
        ? body.urls.map((url) => ({ url }))
        : [];
    if (!rawItems.length) {
      return res.status(400).json({ error: "Daftar URL kosong" });
    }

    const commonOpts = {
      format: body.format,
      abr: body.abr,
      sampleRate: body.sampleRate,
      noPlaylist: true,
      normalize: body.normalize,
      trim: body.trim,
      coverUrl: body.coverUrl,
      atmos: body.atmos,
      speedMode: body.speedMode,
    };

    const results = [];
    for (let i = 0; i < rawItems.length; i += 1) {
      const item = rawItems[i];
      const url = typeof item === "string" ? item : item?.url;
      if (!url || !/^https?:\/\//.test(url)) {
        return res.status(400).json({ error: `URL tidak valid pada entri ${i + 1}` });
      }
      const perId3 = (item && typeof item.id3 === "object") ? item.id3 : body.id3;
      const perFileName = sanitizeFileName(item?.fileName || item?.title || "");
      const singleResult = await convertSingle({
        ...commonOpts,
        url,
        id3: perId3,
        fileName: perFileName,
      });
      results.push({ ...singleResult, sourceUrl: url, providedName: perFileName });
    }

    const zipId = nanoid(10);
    const safeBase = sanitizeFileName(body.zipName || `playlist-${zipId}`) || `playlist-${zipId}`;
    const zipFileName = `${safeBase}.zip`;
    const zipPath = join(JOBS_DIR, zipFileName);

    const width = String(results.length).length;
    const tempDir = join(JOBS_DIR, `${zipId}_tmp`);
    await fsp.mkdir(tempDir, { recursive: true });

    const entryNames = [];
    for (let idx = 0; idx < results.length; idx += 1) {
      const item = results[idx];
      const trackNo = String(idx + 1).padStart(width, "0");
      const base = sanitizeFileName(item.baseName) || item.providedName || `Track ${idx + 1}`;
      const entryName = `${trackNo} - ${base}.${item.ext}`;
      entryNames.push(entryName);
      await fsp.copyFile(item.fullPath, join(tempDir, entryName));
    }

    try {
      await new Promise((resolve, reject) => {
        const zipProc = spawn("zip", ["-q", "-j", zipPath, ...entryNames], { cwd: tempDir });
        let zipLogs = "";
        zipProc.stdout.on("data", (d) => (zipLogs += d.toString()));
        zipProc.stderr.on("data", (d) => (zipLogs += d.toString()));
        zipProc.on("error", (err) => {
          const error = new Error("zip command gagal dijalankan");
          error.logs = zipLogs;
          reject(error);
        });
        zipProc.on("close", (code) => {
          if (code === 0) resolve();
          else {
            const error = new Error(`zip keluar dengan kode ${code}`);
            error.logs = zipLogs;
            reject(error);
          }
        });
      });
    } finally {
      try { await fsp.rm(tempDir, { recursive: true, force: true }); } catch {}
    }

    return res.json({
      ok: true,
      id: zipId,
      count: results.length,
      downloadUrl: `/public/jobs/${zipFileName}`,
      fileName: zipFileName,
      entries: results.map((item, idx) => ({
        url: item.sourceUrl,
        fileName: `${String(idx + 1).padStart(width, "0")} - ${(sanitizeFileName(item.baseName) || item.providedName || `Track ${idx + 1}`)}.${item.ext}`,
        format: item.format,
      })),
    });
  } catch (e) {
    const msg = e?.message || "Gagal memproses playlist";
    return res.status(500).json({ error: msg });
  }
});

// ==== Admin: upload cookies.txt (Authorization: Bearer <token>) ====
const BEARER = process.env.ADMIN_BEARER || "dhika_sayang123!";
const ADMIN_USER_HASH = process.env.ADMIN_USER_HASH || "03be2f61c7e05a997da38f9d365a0d948df08b44fcd7acb5c3d94ba31cef78f2";
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH || "d5a500a4b29869a056a0b5a5e7b26bd295a4b264560b66a16a9dccf9bad7ef45";

const hashText = (value) => createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");

const safeCompare = (left, right) => {
  const a = Buffer.from(String(left ?? ""), "utf8");
  const b = Buffer.from(String(right ?? ""), "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

app.post("/admin/login", (req, res) => {
  try {
    const { username = "", password = "" } = req.body || {};
    const validUser = safeCompare(hashText(username), ADMIN_USER_HASH);
    const validPass = safeCompare(hashText(password), ADMIN_PASS_HASH);
    if (!validUser || !validPass) {
      return res.status(401).json({ error: "invalid credentials" });
    }
    return res.json({ ok: true, token: BEARER });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/admin/upload-cookies", express.text({ type: "*/*", limit: "2mb" }), async (req, res) => {
  try {
    const auth = req.get("Authorization") || "";
    if (auth !== `Bearer ${BEARER}`) return res.status(401).json({ error: "unauthorized" });

    await fsp.writeFile(COOKIES_PATH, req.body, "utf8");
    const stat = await fsp.stat(COOKIES_PATH);
    return res.json({ ok: true, path: COOKIES_PATH, bytes: stat.size, mtime: stat.mtime });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Status cookies — ESM-friendly (tanpa require)
app.get("/admin/cookies-status", (req, res) => {
  try {
    if (!existsSync(COOKIES_PATH)) return res.json({ exists: false });
    const size = statSync(COOKIES_PATH).size;
    return res.json({ exists: true, path: COOKIES_PATH, bytes: size });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => console.log(`Server jalan di :${PORT}`));

export { app, server, buildAssistantResponse };
