// index.js — Backend: annie (download) + ffmpeg (convert) + job store
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, basename } from 'node:path';
import {
  existsSync, mkdirSync, readdirSync, statSync, writeFileSync
} from 'node:fs';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import { nanoid } from 'nanoid';
import express from 'express';
import cors from 'cors';
import adminRouter from './admin.js'; // tetap dipakai (cookies/status)

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// ==== Direktori publik (kompatibel dgn project lama) ====
const UI_DIR     = join(__dirname, 'public-ui');
const PUBLIC_DIR = join(__dirname, 'public');
const JOBS_DIR   = join(PUBLIC_DIR, 'jobs');
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });
if (!existsSync(JOBS_DIR))   mkdirSync(JOBS_DIR,   { recursive: true });
if (existsSync(UI_DIR)) app.use(express.static(UI_DIR));
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

async function have(cmd, flags = ['--version']) {
  try { await run(cmd, flags); return true; } catch { return false; }
}

async function ensureDeps() {
  const okAnnie  = await have('annie', ['-v']);
  const okFfmpeg = await have('ffmpeg', ['-version']);
  if (!okAnnie)  throw new Error('annie tidak ditemukan pada PATH');
  if (!okFfmpeg) throw new Error('ffmpeg tidak ditemukan pada PATH');
}

// ==== Helper path job ====
function jobDir(jobId) {
  const dir = join(JOBS_DIR, jobId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// ==== Ekstrak informasi cepat (annie -j) ====
async function fetchInfo(url) {
  // annie -j akan keluarkan JSON metadata
  const raw = await run('annie', ['-j', url]);
  // Bisa berisi multiple JSON lines; ambil line pertama valid
  const lines = raw.split(/\r?\n/).filter(Boolean);
  let data = null;
  for (const line of lines) {
    try { data = JSON.parse(line); break; } catch {}
  }
  if (!data) throw new Error('Gagal parsing metadata dari annie');

  // Normalisasi properti
  const title  = data.title || data.Title || 'Unknown Title';
  const author = data.author || data.Uploader || data.site || 'Unknown';
  // Thumbnail: annie biasanya nyimpan di data.streams?.default?.parts?.[0]?.thumb atau data.cover
  const thumb  = data.cover || data.pic || data.thumbnail || '';
  return { title, author, thumb, site: data.site || 'YouTube', raw: data };
}

// ==== Unduh via annie ====
async function downloadWithAnnie(url, outDir, outBasename) {
  // -o dir, -O name, tanpa ekstensi (annie tambah otomatis)
  // --threads 8 untuk percepat (jika didukung)
  await run('annie', ['-o', outDir, '-O', outBasename, '--threads', '8', url]);

  // Cari file hasil download
  const files = readdirSync(outDir).map(f => join(outDir, f));
  // Ambil file terbaru di folder yang matches outBasename
  const cand = files
    .filter(f => basename(f).startsWith(outBasename))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!cand.length) throw new Error('Unduhan annie tidak ditemukan');
  return cand[0];
}

// ==== Konversi ke MP3 via ffmpeg ====
async function convertToMp3(inputFile, outputFile, kbps = 320, id3 = {}) {
  const {
    title = '', artist = '', album = '', comment = ''
  } = id3;

  const args = [
    '-y',
    '-i', inputFile,
    '-vn',
    '-map', 'a:0',
    '-c:a', 'libmp3lame',
    '-b:a', `${kbps}k`,
    '-metadata', `title=${title}`,
    '-metadata', `artist=${artist}`,
    '-metadata', `album=${album}`,
    '-metadata', `comment=${comment}`,
    outputFile,
  ];
  await run('ffmpeg', args);
}

// ==== API ====
app.post('/api/fetch', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'URL tidak valid' });
    }
    await ensureDeps();
    const meta = await fetchInfo(url);
    return res.json({ ok: true, meta });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/convert', async (req, res) => {
  const startedAt = Date.now();
  try {
    const {
      url,
      kbps = 320,
      id3 = {},               // { title, artist, album, comment }
      jobId = nanoid(10)
    } = req.body || {};

    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'URL tidak valid' });
    }
    if (![64, 96, 128, 160, 192, 256, 320].includes(Number(kbps))) {
      return res.status(400).json({ error: 'kbps harus salah satu dari 64,96,128,160,192,256,320' });
    }

    await ensureDeps();

    const dir = jobDir(jobId);
    const base = 'source'; // nama dasar file unduhan
    const srcPath = await downloadWithAnnie(url, dir, base);

    const outName = 'audio.mp3';
    const outPath = join(dir, outName);

    // Gabung ID3 — fallback ke judul jika kosong
    let meta = {};
    try {
      const fetched = await fetchInfo(url);
      meta.title  = id3.title  || fetched.title;
      meta.artist = id3.artist || fetched.author;
      meta.album  = id3.album  || fetched.site || 'Downloaded';
      meta.comment= id3.comment|| 'Converted by annie+ffmpeg';
    } catch {
      meta = { ...id3 };
    }

    await convertToMp3(srcPath, outPath, Number(kbps), meta);

    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    return res.json({
      ok: true,
      jobId,
      files: {
        source: `/jobs/${jobId}/${basename(srcPath)}`,
        mp3:    `/jobs/${jobId}/${outName}`
      },
      elapsed_s: elapsed
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// === Health & admin ===
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/admin', adminRouter);

// === Start ===
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log('server listening on', PORT);
});
