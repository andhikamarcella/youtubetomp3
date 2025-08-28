// index.js — annie (lux) + ffmpeg, oEmbed-first metadata, better errors
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import {
  existsSync, mkdirSync, readdirSync, statSync
} from 'node:fs';
import { promises as fsp } from 'node:fs';
import { nanoid } from 'nanoid';
import express from 'express';
import cors from 'cors';
import adminRouter from './admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// ==== Static dirs (kompatibel project kamu) ====
const UI_DIR     = join(__dirname, 'public-ui');
const PUBLIC_DIR = join(__dirname, 'public');
const JOBS_DIR   = join(PUBLIC_DIR, 'jobs');
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });
if (!existsSync(JOBS_DIR))   mkdirSync(JOBS_DIR,   { recursive: true });
if (existsSync(UI_DIR)) app.use(express.static(UI_DIR));
app.use('/jobs', express.static(JOBS_DIR, { fallthrough: false })); // :contentReference[oaicite:3]{index=3}

// ==== Util proses dengan error yang jelas ====
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '', err = '';
    p.stdout.on('data', d => (out += d.toString()));
    p.stderr.on('data', d => (err += d.toString()));
    p.on('error', reject);
    p.on('close', code => {
      if (code === 0) return resolve(out.trim());
      const msg = (err + '\n' + out).trim() || `exit ${code}`;
      reject(new Error(msg));
    });
  });
}

async function have(cmd, flags = ['--version']) {
  try { await run(cmd, flags); return true; } catch { return false; }
}
async function ensureDeps() {
  const okAnnie  = await have('annie', ['-v']);       // lux yang di-rename jadi "annie" di Dockerfile
  const okFfmpeg = await have('ffmpeg', ['-version']);
  if (!okAnnie)  throw new Error('annie (lux) tidak ditemukan');
  if (!okFfmpeg) throw new Error('ffmpeg tidak ditemukan');
}

// ==== Helper path job ====
function jobDir(jobId) {
  const dir = join(JOBS_DIR, jobId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// ==== Metadata: pakai oEmbed dulu, fallback ke annie -j ====
async function fetchInfoOEmbed(url) {
  // Node 20 sudah ada global fetch
  const o = new URL('https://www.youtube.com/oembed');
  o.searchParams.set('url', url);
  o.searchParams.set('format', 'json');
  const r = await fetch(o, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`oEmbed HTTP ${r.status}`);
  const j = await r.json();
  // oEmbed returns: title, author_name, thumbnail_url
  return {
    title: j.title || 'Unknown Title',
    author: j.author_name || 'Unknown',
    thumb: j.thumbnail_url || '',
    site: 'YouTube',
    raw: j
  };
}

async function fetchInfoAnnie(url) {
  const raw = await run('annie', ['-j', url]); // ini lux (binary renamed)
  const lines = raw.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const d = JSON.parse(line);
      return {
        title: d.title || d.Title || 'Unknown Title',
        author: d.author || d.Uploader || d.site || 'Unknown',
        thumb: d.cover || d.pic || d.thumbnail || '',
        site: d.site || 'YouTube',
        raw: d
      };
    } catch {}
  }
  throw new Error('Gagal parsing metadata dari annie');
}

async function fetchInfo(url) {
  try {
    return await fetchInfoOEmbed(url); // cepat & stabil
  } catch (_e) {
    // fallback ke annie
    return await fetchInfoAnnie(url);
  }
}

// ==== Unduh via annie ====
async function downloadWithAnnie(url, outDir, outBasename) {
  // threads biar cepat; no-caption menghindari subtitle
  await run('annie', [
  '-o', outDir,
  '-O', outBasename,
  '--audio-only',      // download audio only
  '--multi-thread',    // aktifkan multi-thread
  '-n', '8',           // jumlah thread
  url
]);


  // Cari file hasil download yang paling baru & match prefix
  const files = readdirSync(outDir).map(f => join(outDir, f));
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
    // kirim pesan error yang jelas
    return res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/convert', async (req, res) => {
  const startedAt = Date.now();
  try {
    const {
      url,
      kbps = 320,
      id3 = {},
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
    const base = 'source';
    const srcPath = await downloadWithAnnie(url, dir, base);

    // Ambil meta (toleran error)
    let meta = {};
    try {
      const m = await fetchInfo(url);
      meta.title   = id3.title  ?? m.title;
      meta.artist  = id3.artist ?? m.author;
      meta.album   = id3.album  ?? m.site ?? 'Downloaded';
      meta.comment = id3.comment?? 'Converted by annie+ffmpeg';
    } catch {
      meta = { ...id3 };
    }

    const outName = 'audio.mp3';
    const outPath = join(dir, outName);
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
    return res.status(500).json({ error: String(e.message || e) });
  }
});

// Health & Admin
app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/admin', adminRouter); // :contentReference[oaicite:4]{index=4}

// Start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log('server listening on', PORT);
});
