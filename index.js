// index.js — Node memanggil yt-dlp via Python module
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, readdirSync, renameSync } from 'node:fs';
import { nanoid } from 'nanoid';
import express from 'express';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// ==== Direktori publik ====
const UI_DIR     = join(__dirname, 'public-ui');
const PUBLIC_DIR = join(__dirname, 'public');
const JOBS_DIR   = join(PUBLIC_DIR, 'jobs');
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });
if (!existsSync(JOBS_DIR))   mkdirSync(JOBS_DIR,   { recursive: true });
app.use(express.static(UI_DIR));
app.use('/jobs', express.static(JOBS_DIR, { fallthrough: false }));

// ==== Util proses ====
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '', err = '';
    p.stdout.on('data', d => (out += d.toString()));
    p.stderr.on('data', d => (err += d.toString()));
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err || `exit ${code}`)));
  });
}

async function check(cmd, flags) {
  try { await run(cmd, flags); return true; } catch { return false; }
}

// Cari Python yang bisa jalan di container/Windows
const PY_CANDIDATES = process.platform === 'win32'
  ? ['py', 'python', 'python3']
  : ['python3', 'python'];

async function pickPython() {
  for (const cand of PY_CANDIDATES) {
    if (await check(cand, ['--version'])) return cand;
    if (await check(cand, ['-V']))       return cand;
  }
  throw new Error('Python tidak ditemukan');
}

// Cek ffmpeg (optional)
async function haveFfmpeg() {
  return (await check('ffmpeg', ['-version'])) || (await check('/usr/bin/ffmpeg', ['-version'])) || (await check('/usr/local/bin/ffmpeg', ['-version']));
}

// ============ API ============
app.post('/api/convert', async (req, res) => {
  try {
    const { url, quality = 128, id3, trim, normalize } = req.body || {};
    if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'URL tidak valid' });

    const PY = await pickPython();                 // ← Python launcher
    const hasFfmpeg = await haveFfmpeg();          // ← opsional

    const id = nanoid(10);
    const jobDir = join(JOBS_DIR, id);
    mkdirSync(jobDir, { recursive: true });

    // Helper download via Python module yt_dlp
    async function ytdlp(args) {
      // tambahkan -m yt_dlp
      return run(PY, ['-m', 'yt_dlp', ...args], { env: { ...process.env, PYTHONNOUSERSITE: '1' }});
    }

    if (hasFfmpeg) {
      // MODE A — ffmpeg tersedia → hasil MP3 CBR
      const tmpOut  = join(jobDir, 'audio.%(ext)s');
      const outFile = join(jobDir, 'output.mp3');

      await ytdlp(['--no-warnings','--no-playlist','--geo-bypass','-N','2','-f','bestaudio/best','-o', tmpOut, url]);

      const inputs = readdirSync(jobDir).filter(f => f.startsWith('audio.'));
      if (!inputs.length) return res.status(500).json({ error: 'Audio tidak ditemukan' });
      const bestAudio = join(jobDir, inputs[0]);

      const ffArgs = ['-hide_banner','-y'];
      if (trim?.start && !trim?.end) ffArgs.push('-ss', trim.start);
      ffArgs.push('-i', bestAudio);
      if (trim?.end) ffArgs.push('-to', trim.end);
      if (normalize) ffArgs.push('-af', 'dynaudnorm');
      ffArgs.push('-vn','-codec:a','libmp3lame','-b:a', `${quality}k`, outFile);
      await run('ffmpeg', ffArgs);

      if (id3?.title || id3?.artist) {
        const tagged = join(jobDir, 'output.tagged.mp3');
        const meta = [];
        if (id3.title)  meta.push('-metadata', `title=${id3.title}`);
        if (id3.artist) meta.push('-metadata', `artist=${id3.artist}`);
        await run('ffmpeg', ['-y','-i', outFile, ...meta, '-codec:a','copy', tagged]);
        renameSync(tagged, outFile);
      }

      const safeTitle = (id3?.title || 'audio').replace(/[^\w\- ]+/g, '').trim() || 'audio';
      return res.json({ mode:'mp3', filename: `${safeTitle}-${quality}kbps.mp3`, downloadUrl: `/jobs/${id}/output.mp3` });
    }

    // MODE B — ffmpeg TIDAK ada → kirim audio asli (m4a/webm)
    const outPattern = join(jobDir, 'audio.%(ext)s');
    await ytdlp(['--no-warnings','--no-playlist','--geo-bypass','-N','2',
                 '-f','bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
                 '-o', outPattern, url]);

    const files = readdirSync(jobDir).filter(f => f.startsWith('audio.'));
    if (!files.length) return res.status(500).json({ error: 'Audio tidak ditemukan' });

    const downloaded = files[0];
    const ext = downloaded.split('.').pop();
    const finalPath = join(jobDir, `output.${ext}`);
    renameSync(join(jobDir, downloaded), finalPath);

    return res.json({
      mode: 'original',
      filename: `audio (ORIGINAL).${ext}`,
      downloadUrl: `/jobs/${id}/output.${ext}`,
      note: 'ffmpeg tidak tersedia: dikirim audio asli tanpa konversi'
    });

  } catch (e) {
    console.error('[convert:error]', e?.message);
    res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// Diagnostik
app.get('/diag', async (_req, res) => {
  let py = null, ytVer = null, ffVer = null, hasFfmpeg = false;
  try {
    py = await pickPython();
    ytVer = await run(py, ['-m','yt_dlp','--version']);
  } catch {}
  hasFfmpeg = await haveFfmpeg();
  if (hasFfmpeg) { try { ffVer = (await run('ffmpeg',['-version'])).split('\n')[0]; } catch {} }
  res.json({ python: py, yt_dlp_version: ytVer, ffmpeg: hasFfmpeg ? ffVer : null });
});

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/', (_req, res) => {
  res.sendFile(join(UI_DIR, 'index.html'), err => {
    if (err) res.send('UI OK — taruh file di /public-ui/index.html, atau POST /api/convert');
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Backend listening on :' + port));
