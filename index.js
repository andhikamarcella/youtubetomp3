// index.js — PyTube + ffmpeg backend (oEmbed-first metadata), better errors
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { resolve } from 'node:path';
import {
  existsSync, mkdirSync, readdirSync, statSync, createReadStream
} from 'node:fs';
import { promises as fsp } from 'node:fs';
import { nanoid } from 'nanoid';
import express from 'express';
import cors from 'cors';
import adminRouter from './admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ==== small utils ====
function run(cmd, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '', err = '';
    p.stdout.on('data', d => out += d.toString());
    p.stderr.on('data', d => err += d.toString());
    p.on('error', reject);
    p.on('close', code => {
      if (code === 0) return resolve(out.trim());
      const msg = (err + '\\n' + out).trim() || `exit ${code}`;
      reject(new Error(msg));
    });
  });
}

async function have(cmd, flags = ['--version']) {
  try { await run(cmd, flags); return true; } catch { return false; }
}

async function ensureDeps() {
  const okPy     = await have('python3', ['--version']);
  const okFfmpeg = await have('ffmpeg',  ['-version']);
  if (!okPy)     throw new Error('python3 tidak ditemukan');
  if (!okFfmpeg) throw new Error('ffmpeg tidak ditemukan');
}

// ==== metadata (oEmbed-first) ====
async function fetchOEmbed(url) {
  // try noembed first (works for many sites incl. YouTube)
  const targets = [
    `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
  ];
  for (const t of targets) {
    try {
      const r = await fetch(t, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!r.ok) continue;
      const j = await r.json();
      // normalize keys we care about
      return {
        title: j.title || null,
        author: j.author_name || j.author || null,
        thumbnail: j.thumbnail_url || null,
        provider: j.provider_name || null
      };
    } catch {}
  }
  return { title: null, author: null, thumbnail: null, provider: null };
}

// ==== PyTube downloader (calls helper python) ====
async function downloadWithPyTube(url, outDir, outBasename) {
  const py = 'python3';
  const helper = join(__dirname, 'download_audio.py');
  const stdout = await run(py, [helper, url, outDir, outBasename], { cwd: __dirname });
  const p = stdout.trim();
  try { statSync(p); } catch { throw new Error('File hasil PyTube tidak ditemukan'); }
  return p;
}

// ==== ffmpeg transcode to mp3 ====
async function toMp3(inputPath, outPath, kbps = 192) {
  // ensure parent dir
  mkdirSync(dirname(outPath), { recursive: true });
  const args = [
    '-y', '-i', inputPath,
    '-vn',
    '-ac', '2',
    '-ar', '44100',
    '-b:a', `${kbps}k`,
    outPath
  ];
  await run('ffmpeg', args);
  return outPath;
}

// ==== express app ====
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors());

// static hosting for jobs
const PUBLIC_DIR = join(__dirname, 'public');
const JOBS_DIR   = join(PUBLIC_DIR, 'jobs');
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });
if (!existsSync(JOBS_DIR))   mkdirSync(JOBS_DIR,   { recursive: true });
app.use('/', express.static(__dirname, { maxAge: '1h', fallthrough: true }));
app.use('/jobs', express.static(JOBS_DIR, { maxAge: '7d', fallthrough: true }));

// serve UI at root
const UI_INDEX = resolve(__dirname, 'index.html');
app.get('/', (_req, res) => res.sendFile(UI_INDEX));

app.get('/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// metadata endpoint (optional, used by your frontend)
app.get('/api/oembed', async (req, res) => {
  const url = String(req.query.url || '');
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const meta = await fetchOEmbed(url);
    res.json({ ok: true, meta });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// convert endpoint
app.post('/api/convert', async (req, res) => {
  const url  = String(req.body?.url || '');
  const kbps = Math.max(64, Math.min(320, Number(req.body?.kbps || 192)));
  if (!url) return res.status(400).json({ error: 'url required' });

  const jobId = nanoid(10);
  const dir   = join(JOBS_DIR, jobId);
  const base  = 'audio';
  mkdirSync(dir, { recursive: true });

  try {
    await ensureDeps();

    // 1) metadata (non-blocking for pipeline, but we await to return together)
    const metaPromise = fetchOEmbed(url);

    // 2) download via pytube → returns actual file path (e.g., audio.webm/m4a)
    const inputPath = await downloadWithPyTube(url, dir, base);

    // 3) transcode → MP3
    const mp3Path = join(dir, `${base}.mp3`);
    await toMp3(inputPath, mp3Path, kbps);

    // 4) prepare response
    const meta = await metaPromise;
    const publicUrl = `/jobs/${jobId}/${basename(mp3Path)}`;

    return res.json({
      ok: true,
      id: jobId,
      mp3: publicUrl,
      meta,
      kbps
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

// admin router (cookies upload/status still available, though pytube normally doesn't need it)
app.use('/admin', adminRouter);

// start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log('server listening on', PORT);
});
