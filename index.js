import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { promises as fsp } from "node:fs";
import { join, dirname, basename, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
// Tambahan untuk ffmpeg portable (opsional)
let ffmpegPath = null;
try {
  ffmpegPath = (await import("ffmpeg-static")).default;
} catch {
  ffmpegPath = null;
}

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
const THUMB_DIR = join(PUBLIC_ROOT, "thumbnails");
const CLOUD_DIR = join(PUBLIC_ROOT, "cloud");
const CLOUD_TARGETS = {
  drive: { label: "Google Drive", dir: join(CLOUD_DIR, "drive") },
  dropbox: { label: "Dropbox", dir: join(CLOUD_DIR, "dropbox") },
  onedrive: { label: "OneDrive", dir: join(CLOUD_DIR, "onedrive") },
};

for (const dir of [THUMB_DIR, CLOUD_DIR, ...Object.values(CLOUD_TARGETS).map((t) => t.dir)]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

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

const escapeDrawText = (input = "") =>
  (input || "")
    .replace(/[\\:'\[\]]/g, (match) => `\\${match}`)
    .replace(/\n/g, "\\n");

const normalizeHex = (hex, fallback = "#0d6efd") => {
  if (typeof hex !== "string") return fallback;
  const clean = hex.trim();
  return /^#?[0-9a-fA-F]{6}$/.test(clean)
    ? (clean.startsWith("#") ? clean : `#${clean}`)
    : fallback;
};

const hexToFfmpegColor = (hex) => `0x${hex.replace(/^#/, "").toUpperCase()}`;

const findFontPath = () => {
  const candidates = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
  ];
  for (const font of candidates) {
    if (existsSync(font)) return font;
  }
  return null;
};

const DEFAULT_FONT = findFontPath();

const resolvePublicPath = (urlPath = "") => {
  if (typeof urlPath !== "string") return null;
  const cleaned = urlPath.replace(/\\/g, "/").trim();
  if (!cleaned.startsWith("/public/")) return null;
  const relative = cleaned.slice("/public/".length);
  const fullPath = pathResolve(PUBLIC_ROOT, relative);
  if (!fullPath.startsWith(PUBLIC_ROOT)) return null;
  return fullPath;
};

const ensureUniqueFileName = (dir, fileName) => {
  const clean = fileName || "file";
  const dot = clean.lastIndexOf(".");
  const base = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : "";
  let candidate = clean;
  let counter = 1;
  while (existsSync(join(dir, candidate))) {
    candidate = `${base} (${counter})${ext}`;
    counter += 1;
  }
  return candidate;
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

const createStemsForSource = async (inputPath, baseName = "Audio") => {
  if (!inputPath) throw new Error("Sumber audio tidak ditemukan");
  const safeBase = sanitizeFileName(baseName) || "Audio";
  const stemId = nanoid(10);
  const vocalsFile = `${stemId}.vocals.mp3`;
  const instrumentalFile = `${stemId}.instrumental.mp3`;
  const zipFile = `${stemId}.stems.zip`;
  const vocalsPath = join(JOBS_DIR, vocalsFile);
  const instrumentalPath = join(JOBS_DIR, instrumentalFile);
  const zipPath = join(JOBS_DIR, zipFile);

  let vocalsLogs = "";
  let instrumentalLogs = "";
  try {
    vocalsLogs = await runFfmpeg([
      "-y",
      "-i", inputPath,
      "-filter:a", "pan=stereo|c0=c0+c1|c1=c0+c1,alimiter=limit=0.9",
      "-codec:a", "libmp3lame",
      "-qscale:a", "2",
      vocalsPath,
    ]);
    instrumentalLogs = await runFfmpeg([
      "-y",
      "-i", inputPath,
      "-filter:a", "pan=stereo|c0=c0-c1|c1=c1-c0,alimiter=limit=0.9",
      "-codec:a", "libmp3lame",
      "-qscale:a", "2",
      instrumentalPath,
    ]);

    await new Promise((resolve, reject) => {
      const zipProc = spawn("zip", ["-q", zipFile, vocalsFile, instrumentalFile], { cwd: JOBS_DIR });
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
  } catch (err) {
    try { await fsp.unlink(vocalsPath); } catch {}
    try { await fsp.unlink(instrumentalPath); } catch {}
    try { await fsp.unlink(zipPath); } catch {}
    throw err;
  }

  const response = {
    ok: true,
    id: stemId,
    baseName: safeBase,
    vocals: {
      downloadUrl: `/public/jobs/${vocalsFile}`,
      fileName: `${safeBase} - Vocals.mp3`,
      logs: vocalsLogs.slice(-6000),
    },
    instrumental: {
      downloadUrl: `/public/jobs/${instrumentalFile}`,
      fileName: `${safeBase} - Instrumental.mp3`,
      logs: instrumentalLogs.slice(-6000),
    },
    zip: {
      downloadUrl: `/public/jobs/${zipFile}`,
      fileName: `${safeBase} - STEMS.zip`,
    },
  };
  return response;
};

const generateThumbnailArt = async ({
  imageUrl,
  title,
  subtitle,
  accent = "#0d6efd",
  style = "modern",
}) => {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    throw new Error("URL gambar tidak valid");
  }
  if (!DEFAULT_FONT) {
    throw new Error("Font default tidak ditemukan untuk drawtext");
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Gagal mengambil gambar (${response.status})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const thumbId = nanoid(10);
  const inputPath = join(THUMB_DIR, `${thumbId}.src`);
  const outputName = `${thumbId}.jpg`;
  const outputPath = join(THUMB_DIR, outputName);

  await fsp.writeFile(inputPath, buffer);

  const accentHex = normalizeHex(accent);
  const baseFilter = [
    "scale=1280:720:force_original_aspect_ratio=decrease",
    `pad=1280:720:(ow-iw)/2:(oh-ih)/2:${hexToFfmpegColor("#10121a")}`,
    "format=rgba",
  ];

  if (style === "vibrant") {
    baseFilter.push("eq=saturation=1.35:contrast=1.05");
  } else if (style === "mono") {
    baseFilter.push("hue=s=0");
  }

  baseFilter.push(`drawbox=x=0:y=h-220:w=iw:h=220:color=${accentHex}@0.75:t=fill`);

  const titleText = escapeDrawText(title || "AI Generated Cover");
  baseFilter.push(
    `drawtext=fontfile='${DEFAULT_FONT}':text='${titleText}':fontsize=58:fontcolor=white:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-150`
  );

  if (subtitle && subtitle.trim()) {
    const subText = escapeDrawText(subtitle.trim());
    baseFilter.push(
      `drawtext=fontfile='${DEFAULT_FONT}':text='${subText}':fontsize=34:fontcolor=white@0.9:shadowx=1:shadowy=1:x=(w-text_w)/2:y=h-80`
    );
  }

  const filter = baseFilter.join(",");

  try {
    await runFfmpeg([
      "-y",
      "-i", inputPath,
      "-vf", filter,
      "-q:v", "2",
      outputPath,
    ]);
  } finally {
    try { await fsp.unlink(inputPath); } catch {}
  }

  return {
    ok: true,
    url: `/public/thumbnails/${outputName}`,
    fileName: `${sanitizeFileName(title || "cover") || "cover"}.jpg`,
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

const buildAudioFilters = ({
  normalize = false,
  speedMode = "normal",
  denoise = false,
  volumeBoost = 0,
  enhancer = "none",
} = {}) => {
  const filters = [];
  if (speedMode && speedMode !== "normal") {
    if (speedMode === "nightcore") {
      filters.push("asetrate=sample_rate*1.25", "aresample=sample_rate");
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
  const { id3 = {}, trim = {}, sampleRate, cover, filters = [] } = opts;
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
    args.push("-codec:a","aac","-b:a","192k", output);
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

const runPyTubeDownload = ({ url, id, baseLogs = "" }) =>
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
      const error = new Error("PyTube tidak bisa dijalankan");
      error.cause = err;
      error.logs = baseLogs + pyLogs;
      reject(error);
    });

    py.on("close", async (code) => {
      if (code !== 0) {
        const error = new Error("PyTube gagal");
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
        const error = new Error(err.message || "PyTube output tidak valid");
        error.logs = baseLogs + pyLogs;
        reject(error);
      }
    });
  });

const convertSingle = async (payload = {}) => {
  const {
    url,
    format = "mp3",
    abr = 192,
    sampleRate,
    fileName,
    noPlaylist = true,
    id3 = {},
    trim,
    normalize = false,
    coverUrl,
    atmos = false,
    speedMode = "normal",
    denoise = false,
    volumeBoost = 0,
    enhancer = "none",
  } = payload;

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error("URL tidak valid");
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

  let trimOpt = null;
  if (trim && (trim.start !== undefined || trim.end !== undefined)) {
    const hasStart = trim.start !== undefined;
    const hasEnd = trim.end !== undefined;
    const start = hasStart ? Number(trim.start) : 0;
    const end = hasEnd ? Number(trim.end) : undefined;
    if ((hasStart && Number.isNaN(start)) ||
        (hasEnd && Number.isNaN(end)) ||
        (hasStart && hasEnd && end < start)) {
      throw new Error("trim tidak valid");
    }
    trimOpt = {};
    if (hasStart) trimOpt.start = start;
    if (hasEnd) trimOpt.end = end;
  }

  const id = nanoid(10);
  const outTpl = join(JOBS_DIR, `${id}.%(ext)s`);
  const baseName = sanitizeFileName(fileName || id3.title || id) || id;

  let coverPath = null;
  if (coverUrl && /^https?:\/\//.test(coverUrl) && ["mp3", "m4a", "flac"].includes(fmt)) {
    try {
      const imgResp = await fetch(coverUrl);
      if (imgResp.ok) {
        const buf = Buffer.from(await imgResp.arrayBuffer());
        coverPath = join(JOBS_DIR, `${id}.cover.jpg`);
        await fsp.writeFile(coverPath, buf);
      }
    } catch {}
  }

  const filters = buildAudioFilters({
    normalize,
    speedMode,
    denoise: denoiseEnabled,
    volumeBoost: boostValue,
    enhancer: enhancerMode,
  });

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

  if (fmt === "m4a") {
    args.push("-f", "bestaudio[ext=m4a]/bestaudio");
  } else if (fmt === "flac") {
    args.push("-x", "--audio-format", "flac");
  } else if (fmt === "mp3") {
    args.push("-x", "--audio-format", "mp3", "--audio-quality", abrToQ(abr));
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
      downloadResult = await runPyTubeDownload({ url, id, baseLogs });
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

  const id3Clean = Object.entries(id3 || {}).reduce((acc, [k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== "") acc[k] = v;
    return acc;
  }, {});
  const hasId3 = Object.keys(id3Clean).length > 0;
  const hasTrim = !!trimOpt && Object.keys(trimOpt).length > 0;
  const hasFilters = filters.length > 0;
  const hasCover = !!coverPath;
  const needSampleRate = sr !== undefined;

  const finalize = async (targetExt, converter, extraOpts = {}) => {
    const tmpOut = join(JOBS_DIR, `${id}.tmp.${targetExt}`);
    await converter(fullPath, tmpOut, { ...extraOpts, trim: trimOpt || {}, sampleRate: sr, filters });
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
        await finalize("mp3", ffmpegToMp3, { abr, id3: id3Clean, cover: coverPath });
      }
    } else if (fmt === "flac") {
      const needConvert = ext !== "flac" || hasId3 || hasTrim || hasFilters || hasCover || needSampleRate;
      if (needConvert) {
        await finalize("flac", ffmpegToFlac, { id3: id3Clean, cover: coverPath });
      }
    } else if (fmt === "m4a") {
      const needConvert = ext !== "m4a" || hasId3 || hasTrim || hasFilters || hasCover || needSampleRate;
      if (needConvert) {
        await finalize("m4a", ffmpegToM4a, { id3: id3Clean, cover: coverPath });
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
  const outputTpl = join(JOBS_DIR, `${id}.%(ext)s`);

  const args = ["--skip-download", "--no-progress", "--newline"];
  if (ffmpegPath) args.push("--ffmpeg-location", ffmpegPath);
  if (existsSync(COOKIES_PATH)) args.push("--cookies", COOKIES_PATH);
  args.push("--write-sub");
  if (preferAuto) args.push("--write-auto-sub");
  args.push("--sub-format", "srt/best");
  args.push("--convert-subs", "srt");
  args.push("--sub-langs", langOpt);
  args.push("-o", outputTpl);
  args.push(url);

  let logs = "";
  try {
    await new Promise((resolve, reject) => {
      const proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
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
          const error = new Error("yt-dlp gagal mengambil subtitle");
          error.logs = logs;
          reject(error);
        } else {
          resolve();
        }
      });
    });

    const files = readdirSync(JOBS_DIR).filter((f) => f.startsWith(`${id}.`));
    const candidates = files.filter((f) => f.endsWith(".srt") || f.endsWith(".vtt"));
    if (!candidates.length) {
      const error = new Error("Subtitle tidak ditemukan");
      error.logs = logs;
      throw error;
    }

    const autoCandidate = candidates.find((f) => /\.auto\./i.test(f));
    const manualCandidate = candidates.find((f) => !/\.auto\./i.test(f));
    let chosen = manualCandidate || candidates[0];
    if (preferAuto && autoCandidate) chosen = autoCandidate;

    const suffix = chosen.replace(`${id}.`, "");
    const parts = suffix.split(".");
    const ext = parts.pop();
    let langKey = parts.join(".");
    let autoDetected = /\.auto$/i.test(langKey) || /-auto$/i.test(langKey) || /\.auto\./i.test(chosen);
    langKey = langKey.replace(/\.auto/gi, "-auto");
    if (!langKey) langKey = autoDetected ? "auto" : "subtitle";
    const safeLang = langKey.replace(/[^a-z0-9_-]+/gi, "-");
    autoDetected = autoDetected || /-auto$/i.test(safeLang);

    const chosenPath = join(JOBS_DIR, chosen);
    const finalStem = `${id}.${safeLang}`;
    const finalSrtName = `${finalStem}.srt`;
    let srtPath = join(JOBS_DIR, finalSrtName);

    if (ext === "vtt") {
      const vttContent = await fsp.readFile(chosenPath, "utf8");
      const srtContent = vttToSrt(vttContent);
      if (!srtContent) {
        const error = new Error("Subtitle VTT tidak bisa dikonversi");
        error.logs = logs;
        throw error;
      }
      await fsp.writeFile(srtPath, `${srtContent}\n`, "utf8");
      try { await fsp.unlink(chosenPath); } catch {}
    } else {
      if (basename(chosenPath) !== finalSrtName) {
        await fsp.rename(chosenPath, srtPath);
      }
    }

    const srtContent = await fsp.readFile(srtPath, "utf8");
    const plain = srtToPlainText(srtContent);
    const preview = buildSubtitlePreview(plain);
    const finalTxtName = `${finalStem}.txt`;
    const txtPath = join(JOBS_DIR, finalTxtName);
    await fsp.writeFile(txtPath, `${plain}\n`, "utf8");

    for (const file of files) {
      if (file === finalSrtName || file === finalTxtName) continue;
      try { await fsp.unlink(join(JOBS_DIR, file)); } catch {}
    }

    return {
      ok: true,
      logs: (logs || "").slice(-8000),
      lang: safeLang,
      auto: autoDetected,
      srtUrl: `/public/jobs/${finalSrtName}`,
      srtFileName: `${downloadBase}.${safeLang}.srt`,
      txtUrl: `/public/jobs/${finalTxtName}`,
      txtFileName: `${downloadBase}.${safeLang}.txt`,
      preview,
    };
  } catch (err) {
    try {
      const leftovers = readdirSync(JOBS_DIR).filter((f) => f.startsWith(`${id}.`));
      for (const file of leftovers) {
        try { await fsp.unlink(join(JOBS_DIR, file)); } catch {}
      }
    } catch {}
    const error = new Error(err.message || "Gagal mengambil subtitle");
    error.logs = (logs + (err.logs || "")).slice(-8000);
    throw error;
  }
};

// ==== Serve static UI & hasil unduhan ====
app.use("/", express.static(join(__dirname, "public-ui")));
app.use("/public", express.static(PUBLIC_DIR));

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

app.post("/api/thumbnail", async (req, res) => {
  try {
    const result = await generateThumbnailArt(req.body || {});
    return res.json(result);
  } catch (e) {
    const msg = e?.message || "Gagal membuat thumbnail";
    const status = /tidak valid|tidak ditemukan/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg, logs: e?.logs });
  }
});

app.post("/api/stems", async (req, res) => {
  try {
    const body = req.body || {};
    let sourcePath = null;
    let baseName = body.baseName;
    if (body.downloadUrl) {
      sourcePath = resolvePublicPath(body.downloadUrl);
      if (!sourcePath) throw new Error("downloadUrl tidak valid");
      baseName = baseName || basename(sourcePath).replace(/\.[^.]+$/, "");
    } else if (body.jobId) {
      const job = backgroundJobs.get(body.jobId);
      if (!job || job.status !== "done") throw new Error("Job belum selesai");
      sourcePath = resolveJobFilePath(job);
      if (!sourcePath) throw new Error("File job tidak ditemukan");
      baseName = baseName || job.result?.baseName || job.result?.fileName;
    } else if (body.url) {
      const convertPayload = { ...body };
      delete convertPayload.jobId;
      delete convertPayload.downloadUrl;
      delete convertPayload.baseName;
      const convertResult = await convertSingle({ ...convertPayload, format: body.format || "wav", noPlaylist: true });
      sourcePath = convertResult.fullPath;
      baseName = baseName || convertResult.baseName || convertResult.fileName;
    } else {
      return res.status(400).json({ error: "Perlu url, jobId, atau downloadUrl" });
    }
    if (!sourcePath) throw new Error("Sumber audio tidak ditemukan");
    const result = await createStemsForSource(sourcePath, baseName);
    if (!result.source && sourcePath.startsWith(JOBS_DIR)) {
      const diskName = basename(sourcePath);
      result.source = {
        downloadUrl: `/public/jobs/${diskName}`,
        fileName: `${sanitizeFileName(baseName || "Audio") || "Audio"}.${diskName.split(".").pop()}`,
      };
    }
    return res.json(result);
  } catch (e) {
    const msg = e?.message || "Gagal membuat stems";
    const status = /tidak valid|belum|perlu|tidak ditemukan/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg, logs: e?.logs });
  }
});

app.post("/api/cloud/save", async (req, res) => {
  try {
    const body = req.body || {};
    const targetKey = typeof body.target === "string" ? body.target.toLowerCase() : "drive";
    const target = CLOUD_TARGETS[targetKey];
    if (!target) return res.status(400).json({ error: "Target cloud tidak dikenali" });

    let sourcePath = null;
    let fileName = typeof body.fileName === "string" && body.fileName.trim()
      ? sanitizeFileName(body.fileName.trim())
      : null;

    if (body.jobId) {
      const job = backgroundJobs.get(body.jobId);
      if (!job || job.status !== "done") throw new Error("Job belum selesai");
      sourcePath = resolveJobFilePath(job);
      if (!sourcePath) throw new Error("File job tidak ditemukan");
      if (!fileName) fileName = job.result?.fileName || job.result?.baseName;
    } else if (body.downloadUrl) {
      sourcePath = resolvePublicPath(body.downloadUrl);
      if (!sourcePath) throw new Error("downloadUrl tidak valid");
      if (!fileName) fileName = basename(sourcePath);
    } else {
      return res.status(400).json({ error: "Perlu jobId atau downloadUrl" });
    }

    if (!sourcePath) throw new Error("Sumber file tidak ditemukan");

    const finalName = ensureUniqueFileName(target.dir, sanitizeFileName(fileName) || basename(sourcePath));
    const destPath = join(target.dir, finalName);
    await fsp.copyFile(sourcePath, destPath);

    return res.json({
      ok: true,
      target: targetKey,
      label: target.label,
      downloadUrl: `/public/cloud/${targetKey}/${finalName}`,
      fileName: finalName,
    });
  } catch (e) {
    const msg = e?.message || "Gagal menyimpan ke cloud";
    const status = /tidak valid|perlu|belum|tidak ditemukan/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg, logs: e?.logs });
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
app.listen(PORT, () => console.log(`Server jalan di :${PORT}`));
