// index.js — fixed for Render + Docker (yt-dlp & ffmpeg binary)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { nanoid } from 'nanoid';
import express from 'express';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// ====== CONFIG ======
const UI_DIR = join(__dirname, 'public-ui');
const PUBLIC_DIR = join(__dirname, 'public');
const JOBS_DIR = join(PUBLIC_DIR, 'jobs');

// Jalur binary (biar eksplisit di container). Bisa di-override via ENV kalau perlu.
const YTDLP = process.env.YTDLP_PATH || '/usr/local/bin/yt-dlp';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

// ====== STATIC ======
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });
if (!existsSync(JOBS_DIR)) mkdirSync(JOBS_DIR, { recursive: true });

app.use(express.static(UI_DIR));
app.use('/jobs', express.static(JOBS_DIR, { fallthrough: false }));

// ====== HELPERS ======
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '', err = '';
    p.stdout.on('data', d => (out += d.toString()));
    p.stderr.on('data', d => (err += d.toString()));
    p.on('error', reject);
    p.on('close', code => {
      if (code === 0) return resolve(out.trim());
      reject(new Error(err || `Process ${cmd} exited with ${code}`));
    });
  });
}

async function have(cmd, vflag = '-version') {
  try { await run(cmd, [vflag]); return true; } catch { return false; }
}

// ====== API ======
app.post('/api/convert', async (req, res) => {
  try {
    const { url, quality = 128, id3, trim, normalize } = req.body || {};
    if (!url || !/^https?:\/\//.test(url)) {
      return res.status(400).json({ error: 'URL tidak valid' });
    }

    const [hasYtDlp, hasFfmpeg] = await Promise.all([have(YTDLP), have(FFMPEG)]);
    if (!hasYtDlp || !hasFfmpeg) {
      return res.status(500).json({ error: 'yt-dlp/ffmpeg tidak ditemukan di server' });
    }

    const id = nanoid(10);
    const jobDir = join(JOBS_DIR, id);
    mkdirSync(jobDir, { recursive: true });

    // 1) Download bestaudio → simpan sebagai audio.<ext>
    const ytdlpArgs = [
      '--no-warnings',
      '--no-playlist',
      '--geo-bypass',
      '-N', '2',
      '-f', 'bestaudio/best',
      '-o', join(jobDir, 'audio.%(ext)s'),
      url
    ];

    let dlErr = '';
    try {
      await run(YTDLP, ytdlpArgs, { env: { ...process.env, PYTHONNOUSERSITE: '1' } });
    } catch (e) {
      dlErr = String(e.message || '');
      // Ambil 15 baris terakhir supaya jelas di UI
      const tail = dlErr.split('\n').slice(-15).join('\n');
      throw new Error(`yt-dlp gagal.\n${tail}`);
    }

    const inputs = readdirSync(jobDir)
      .filter(f => f.startsWith('audio.') && f !== 'audio.m3u8')
      .map(f => join(jobDir, f))
      .sort((a, b) => b.localeCompare(a)); // deterministik
    if (inputs.length === 0) {
      return res.status(500).json({ error: 'File audio tidak ditemukan setelah download' });
    }
    const bestAudio = inputs[0];

    // 2) Konversi ke MP3 (bitrate konsisten)
    const outFile = join(jobDir, 'output.mp3');
    const ffArgs = ['-hide_banner', '-y'];

    if (trim?.start && !trim?.end) ffArgs.push('-ss', trim.start);
    ffArgs.push('-i', bestAudio);
    if (trim?.end) ffArgs.push('-to', trim.end);
    if (normalize) ffArgs.push('-af', 'dynaudnorm');

    ffArgs.push('-vn', '-codec:a', 'libmp3lame', '-b:a', `${quality}k`, outFile);

    try {
      await run(FFMPEG, ffArgs);
    } catch (e) {
      const tail = String(e.message || '').split('\n').slice(-20).join('\n');
      throw new Error(`ffmpeg gagal.\n${tail}`);
    }

    // 3) ID3 opsional
    if (id3?.title || id3?.artist) {
      const tagged = join(jobDir, 'output.tagged.mp3');
      const meta = [];
      if (id3.title)  meta.push('-metadata', `title=${id3.title}`);
      if (id3.artist) meta.push('-metadata', `artist=${id3.artist}`);
      await run(FFMPEG, ['-y', '-i', outFile, ...meta, '-codec:a', 'copy', tagged]);
      renameSync(tagged, outFile);
    }

    const safeTitle = (id3?.title || 'audio').replace(/[^\w\- ]+/g, '').trim() || 'audio';
    const filename = `${safeTitle}-${quality}kbps.mp3`;
    const downloadUrl = `/jobs/${id}/output.mp3`;

    res.json({ filename, downloadUrl });
  } catch (e) {
    console.error('[convert:error]', e?.message);
    res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// ====== HEALTH & UI ======
app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/', (_req, res) => {
  res.sendFile(join(UI_DIR, 'index.html'), err => {
    if (err) res.send('ytmp3 backend OK — taruh UI di /public-ui/index.html atau pakai POST /api/convert');
  });
});

// ====== START ======
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Backend listening on :' + port));
