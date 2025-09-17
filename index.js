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

let ffprobePath = null;
try {
  ffprobePath = (await import("ffprobe-static")).path;
} catch {
  ffprobePath = null;
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

  const sanitizedOptions = sanitizeFormatOptions(fmt, { abr, sampleRate: sr, speedMode });
  const effectiveSpeedMode = sanitizedOptions.speedMode || "normal";
  const targetAbr = sanitizedOptions.abr != null ? sanitizedOptions.abr : (fmt === "mp3" ? Number(abr) || 192 : null);
  sr = sanitizedOptions.sampleRate !== undefined ? sanitizedOptions.sampleRate : sr;

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
