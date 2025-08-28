// index.js — lengkap

import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, renameSync } from 'fs';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors()); // izinkan CORS (UI beda domain pun aman)

// ====== Serve UI statis (satu domain) ======
const UI_DIR = join(__dirname, 'public-ui');
app.use(express.static(UI_DIR)); // jika ada public-ui/index.html, akan jadi homepage

// ====== Folder publik untuk hasil unduhan ======
const PUBLIC_DIR = join(__dirname, 'public');
const JOBS_DIR = join(PUBLIC_DIR, 'jobs');
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR);
if (!existsSync(JOBS_DIR)) mkdirSync(JOBS_DIR);
app.use('/jobs', express.static(JOBS_DIR, { fallthrough: false }));

// ====== Util: cek tool di PATH ======
function checkTool(cmd) {
  return new Promise(resolve => {
    const p = spawn(cmd, ['-version']);
    p.on('error', () => resolve(false));
    p.on('close', code => resolve(code === 0));
  });
}

// ====== POST /api/convert ======
// Body:
// {
//   "url": "https://www.youtube.com/watch?v=...",
//   "quality": 128,                          // kbps (default 128)
//   "trim": { "start": "00:00:10", "end": "00:01:23" }, // opsional
//   "normalize": true,                       // opsional (dynaudnorm)
//   "id3": { "title": "Judul", "artist": "Artis" }      // opsional
// }
app.post('/api/convert', async (req, res) => {
  try {
    const { url, quality = 128, id3, trim, normalize } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Missing url' });

    const [hasYtDlp, hasFfmpeg] = await Promise.all([
      checkTool('yt-dlp'),
      checkTool('ffmpeg'),
    ]);
    if (!hasYtDlp || !hasFfmpeg) {
      return res.status(500).json({ error: 'yt-dlp/ffmpeg tidak ditemukan di server' });
    }

    // Buat job folder
    const id = nanoid(10);
    const jobDir = join(JOBS_DIR, id);
    mkdirSync(jobDir, { recursive: true });

    // 1) Download bestaudio (m4a/webm) via yt-dlp
    const bestAudio = join(jobDir, 'audio.m4a'); // yt-dlp akan menimpa sesuai format
    const ytdlpArgs = ['-f', 'bestaudio/best', '-o', bestAudio, url];

    await new Promise((resolve, reject) => {
      const y = spawn('yt-dlp', ytdlpArgs);
      y.on('error', reject);
      y.stderr.on('data', d => process.stderr.write(d));
      y.stdout.on('data', d => process.stdout.write(d));
      y.on('close', code => (code === 0 ? resolve() : reject(new Error('yt-dlp gagal'))));
    });

    // 2) Convert ke MP3 (quality kbps) + optional trim/normalize
    const outFile = join(jobDir, 'output.mp3');
    const ffArgs = ['-y'];

    // trim start lebih baik sebelum -i: gunakan -ss sebelum input jika hanya start
    if (trim?.start && !trim?.end) {
      ffArgs.push('-ss', trim.start);
    }

    ffArgs.push('-i', bestAudio);

    if (trim?.end) ffArgs.push('-to', trim.end);
    if (normalize) ffArgs.push('-af', 'dynaudnorm');

    ffArgs.push('-vn', '-codec:a', 'libmp3lame', '-b:a', `${quality}k`, outFile);

    await new Promise((resolve, reject) => {
      const f = spawn('ffmpeg', ffArgs);
      f.on('error', reject);
      f.stderr.on('data', d => process.stderr.write(d));
      f.stdout.on('data', d => process.stdout.write(d));
      f.on('close', code => (code === 0 ? resolve() : reject(new Error('ffmpeg gagal'))));
    });

    // 3) (Opsional) Tulis ID3 (title/artist) tanpa re-encode
    if (id3?.title || id3?.artist) {
      const tagged = join(jobDir, 'output.tagged.mp3');
      const meta = [];
      if (id3.title) meta.push('-metadata', `title=${id3.title}`);
      if (id3.artist) meta.push('-metadata', `artist=${id3.artist}`);

      await new Promise((resolve, reject) => {
        const f2 = spawn('ffmpeg', ['-y', '-i', outFile, ...meta, '-codec:a', 'copy', tagged]);
        f2.on('error', reject);
        f2.stderr.on('data', d => process.stderr.write(d));
        f2.on('close', code => (code === 0 ? resolve() : reject(new Error('penulisan ID3 gagal'))));
      });

      // replace file
      renameSync(tagged, outFile);
    }

    const safeTitle = (id3?.title || 'audio').replace(/[^\w\- ]+/g, '').trim() || 'audio';
    const filename = `${safeTitle}-${quality}kbps.mp3`;
    const downloadUrl = `/jobs/${id}/output.mp3`;

    res.json({ filename, downloadUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// ====== Healthcheck & fallback root ======
app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/', (_req, res) => {
  // kalau tidak ada index.html di public-ui, tampilkan info text
  res.sendFile(join(UI_DIR, 'index.html'), err => {
    if (err) res.send('ytmp3 backend OK — gunakan POST /api/convert atau taruh UI di /public-ui/index.html');
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Backend listening on :' + port));
