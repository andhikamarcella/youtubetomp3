import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { promises as fsp } from "node:fs";
import { join, dirname, basename } from "node:path";
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

const SUPPORTED_FORMATS = new Set(["mp3", "m4a", "flac", "wav", "ogg"]);
const VALID_SPEED_MODES = new Set(["normal", "nightcore", "slow_reverb"]);

const buildAudioFilters = ({ normalize = false, speedMode = "normal" } = {}) => {
  const filters = [];
  if (speedMode && speedMode !== "normal") {
    if (speedMode === "nightcore") {
      filters.push("asetrate=sample_rate*1.25", "aresample=sample_rate");
    } else if (speedMode === "slow_reverb") {
      filters.push("atempo=0.85", "aecho=0.6:0.6:1000:0.25");
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

  const filters = buildAudioFilters({ normalize, speedMode });

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
