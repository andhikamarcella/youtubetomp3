import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { promises as fsp } from "node:fs";
import { join, dirname } from "node:path";
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

const ffmpegToMp3 = (input, output, opts = {}) => {
  const { abr = 192, id3 = {}, trim = {}, normalize = false } = opts;
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
    if (normalize) args.push("-af", "loudnorm");
    for (const [k, v] of Object.entries(id3 || {})) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        args.push("-metadata", `${k}=${v}`);
      }
    }
    args.push("-vn", "-codec:a", "libmp3lame", "-b:a", `${abr}k`, output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => reject(err));
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const COOKIES_PATH = "/tmp/cookies.txt"; // endpoint admin di bawah akan nulis ke sini

// ==== Serve static UI & hasil unduhan ====
app.use("/", express.static(join(__dirname, "public-ui")));
app.use("/public", express.static(PUBLIC_DIR));

// ==== API convert ====
app.post("/api/convert", async (req, res) => {
  try {
    const { url, format = "mp3", abr = 192, noPlaylist = true, id3 = {}, trim, normalize = false } = req.body || {};
    if (!url || !/^https?:\/\//.test(url)) {
      return res.status(400).json({ error: "URL tidak valid" });
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
        return res.status(400).json({ error: "trim tidak valid" });
      }
      trimOpt = {};
      if (hasStart) trimOpt.start = start;
      if (hasEnd) trimOpt.end = end;
    }

    const id = nanoid(10);
    const outTpl = join(JOBS_DIR, `${id}.%(ext)s`);

    // Argumen dasar yt-dlp
    const args = ["--newline", "--no-progress"];

    // Pakai ffmpeg portable kalau ada
    if (ffmpegPath) {
      args.push("--ffmpeg-location", ffmpegPath);
    }

    // Cookies kalau ada (buat age gate / bot check)
    if (existsSync(COOKIES_PATH)) {
      args.push("--cookies", COOKIES_PATH);
    }

    if (noPlaylist) args.push("--no-playlist");

    // Mode cepat: m4a tanpa re-encode (paling ngebut)
    if (format === "m4a") {
      args.push("-f", "bestaudio[ext=m4a]/bestaudio");
      args.push("-o", outTpl);
      args.push(url);
    } else {
      // MP3 (re-encode, sedikit lebih lama)
      args.push("-x", "--audio-format", "mp3", "--audio-quality", abrToQ(abr));
      args.push("-o", outTpl);
      args.push(url);
    }

    const proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });

    let logs = "";
    proc.stdout.on("data", (d) => (logs += d.toString()));
    proc.stderr.on("data", (d) => (logs += d.toString()));

    const runPyTubeFallback = (errMsg, baseLogs = "") => {
      let pyLogs = "";
      let pyOut  = "";
      try {
        const py = spawn("python3", [
          join(__dirname, "download_audio.py"),
          url,
          JOBS_DIR,
          id,
        ], { stdio: ["ignore", "pipe", "pipe"] });

        py.stdout.on("data", (d) => {
          const s = d.toString();
          pyLogs += s;
          pyOut  += s;
        });
        py.stderr.on("data", (d) => (pyLogs += d.toString()));

        py.on("error", (err) => {
          if (!res.headersSent) {
            res.status(500).json({ error: errMsg, logs: baseLogs + pyLogs, detail: err.message });
          }
        });

        py.on("close", async (code) => {
          if (code !== 0) {
            if (!res.headersSent) {
              res.status(500).json({ error: errMsg, logs: baseLogs + pyLogs });
            }
            return;
          }
          try {
            const dlPath = pyOut.trim().split("\n").pop().trim();
            const ext = dlPath.split(".").pop();
            const filename = `${id}.${ext}`;
            const fullPath = join(JOBS_DIR, filename);
            if (dlPath !== fullPath) await fsp.rename(dlPath, fullPath);

            if (format === "mp3") {
              if (normalize || trimOpt || Object.keys(id3).length || ext !== "mp3") {
                const tmpOut = join(JOBS_DIR, `${id}.tmp.mp3`);
                await ffmpegToMp3(fullPath, tmpOut, { abr, id3, trim: trimOpt || {}, normalize });
                await fsp.unlink(fullPath);
                await fsp.rename(tmpOut, fullPath);
              }
            }

            const downloadUrl = `/public/jobs/${filename}`;
            if (!res.headersSent) {
              res.json({ ok: true, id, format: format === "mp3" ? "mp3" : ext, downloadUrl, logs: (baseLogs + pyLogs).slice(-8000) });
            }
          } catch (err) {
            if (!res.headersSent) {
              res.status(500).json({ error: "ffmpeg gagal", logs: baseLogs + pyLogs + err.message });
            }
          }
        });
      } catch (e) {
        if (!res.headersSent) {
          res.status(500).json({ error: errMsg, logs: baseLogs, detail: e.message });
        }
      }
    };

    proc.on("error", () => runPyTubeFallback("yt-dlp tidak bisa dijalankan", logs));

    proc.on("close", async (code) => {
      if (code !== 0) {
        return runPyTubeFallback("yt-dlp gagal", logs);
      }
      // Cari file hasil (id.*)
      const files = readdirSync(JOBS_DIR).filter(f => f.startsWith(id + "."));
      if (!files.length) return res.status(500).json({ error: "Output tidak ditemukan", logs });

      const filename   = files[0];
      const fullPath   = join(JOBS_DIR, filename);

      if (format === "mp3" && (normalize || trimOpt || Object.keys(id3).length)) {
        try {
          const tmpOut = join(JOBS_DIR, `${id}.tmp.mp3`);
          await ffmpegToMp3(fullPath, tmpOut, { abr, id3, trim: trimOpt || {}, normalize });
          await fsp.unlink(fullPath);
          await fsp.rename(tmpOut, fullPath);
        } catch (e) {
          return res.status(500).json({ error: "ffmpeg gagal", logs: logs + e.message });
        }
      }

      const downloadUrl = `/public/jobs/${filename}`;
      return res.json({ ok: true, id, format, downloadUrl, logs: logs.slice(-8000) });
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
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
