// index.js — Node memanggil yt-dlp via Python module + no-cookie-first (ios→android→web) + fallback cookies runtime + STRICT_NO_COOKIE
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  existsSync, mkdirSync, readdirSync, renameSync, writeFileSync, statSync
} from 'node:fs';
import { promises as fsp } from 'node:fs';
import os from 'node:os';
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

// Pilih Python (utamakan dari ENV YT_PY — diset di Dockerfile venv)
const PY_CANDIDATES = process.platform === 'win32'
  ? ['py', 'python', 'python3']
  : ['python3', 'python'];

async function pickPython() {
  if (process.env.YT_PY) return process.env.YT_PY;
  for (const cand of PY_CANDIDATES) {
    if (await check(cand, ['--version'])) return cand;
    if (await check(cand, ['-V'])) return cand;
  }
  throw new Error('Python tidak ditemukan');
}

// Cek ffmpeg (opsional)
async function haveFfmpeg() {
  return (await check('ffmpeg', ['-version'])) ||
         (await check('/usr/bin/ffmpeg', ['-version'])) ||
         (await check('/usr/local/bin/ffmpeg', ['-version']));
}

// ==== Cookies runtime (/tmp) + fallback ENV ====
const RUNTIME_COOKIE_PATH = join(os.tmpdir(), 'cookies.txt');

// Inisialisasi: kalau ada YT_COOKIES (ENV) dan file runtime belum dibuat, tulis sekali
if (process.env.YT_COOKIES && !existsSync(RUNTIME_COOKIE_PATH)) {
  try { writeFileSync(RUNTIME_COOKIE_PATH, process.env.YT_COOKIES, 'utf8'); } catch {}
}

// Helper untuk mengetahui apakah file cookies runtime ada
function haveRuntimeCookies() {
  try { return statSync(RUNTIME_COOKIE_PATH).size > 0; } catch { return false; }
}

// ==== Helper yt-dlp: coba no-cookie dulu (ios→android→web), kalau gagal & cookies ada → fallback ====
// STRICT_NO_COOKIE=1 → TIDAK akan fallback cookies walaupun tersedia
const STRICT_NO_COOKIE = process.env.STRICT_NO_COOKIE === '1';

function ytCommonFlags(client = 'ios') {
  return [
    '--no-warnings',
    '--no-check-certificates',
    '--no-playlist',
    '--geo-bypass',
    '--force-ipv4',
    '--retries', '6',
    '--retry-sleep', '2',
    '--extractor-args', `youtube:player_client=${client}`,
  ];
}

async function runOnce(PY, args, client) {
  return run(
    PY,
    ['-m', 'yt_dlp', ...ytCommonFlags(client), ...args],
    { env: { ...process.env, PYTHONNOUSERSITE: '1' } }
  );
}

/**
 * Strategi:
 * 1) tanpa cookies dgn klien berurutan: ios → android → web
 * 2) jika tetap gagal dan !STRICT_NO_COOKIE serta cookies runtime ada → ulangi dgn --cookies
 */
async function runYtDlpNoCookieFirst(PY, args, opts = {}) {
  const clients = ['ios', 'android', 'web'];
  let lastErr = null;

  for (const c of clients) {
    try { return await runOnce(PY, args, c); }
    catch (e) { lastErr = e; }
  }

  if (!STRICT_NO_COOKIE && haveRuntimeCookies()) {
    const withCookies = ['-m', 'yt_dlp', '--cookies', RUNTIME_COOKIE_PATH, ...ytCommonFlags('ios'), ...args];
    return await run(PY, withCookies, { env: { ...process.env, PYTHONNOUSERSITE: '1' } });
  }
  throw lastErr;
}

// ============ ADMIN (upload cookies tanpa redeploy) ============
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

app.use('/admin', (req, res, next) => {
  // Bearer <token>
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!ADMIN_TOKEN || token === ADMIN_TOKEN) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

// accept text/plain OR any (form-data raw). Limit 1MB
app.post('/admin/upload-cookies', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const body = req.body || '';
  if (!body.trim()) return res.status(400).json({ error: 'empty body' });
  await fsp.writeFile(RUNTIME_COOKIE_PATH, body, 'utf8');
  const st = await fsp.stat(RUNTIME_COOKIE_PATH);
  res.json({ ok: true, path: RUNTIME_COOKIE_PATH, bytes: st.size, mtime: st.mtime });
});

app.get('/admin/cookies-status', async (_req, res) => {
  try {
    const st = await fsp.stat(RUNTIME_COOKIE_PATH);
    return res.json({ exists: true, bytes: st.size, mtime: st.mtime });
  } catch {
    return res.json({ exists: false });
  }
});

// ============ API ============
app.post('/api/convert', async (req, res) => {
  try {
    const { url, quality = 128, id3, trim, normalize } = req.body || {};
    if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'URL tidak valid' });

    const PY = await pickPython();
    const hasFfmpeg = await haveFfmpeg();

    const id = nanoid(10);
    const jobDir = join(JOBS_DIR, id);
    mkdirSync(jobDir, { recursive: true });

    if (hasFfmpeg) {
      // MODE A — ffmpeg tersedia → download bestaudio, lalu konversi ke MP3 CBR
      const tmpOut  = join(jobDir, 'audio.%(ext)s');
      const outFile = join(jobDir, 'output.mp3');

      await runYtDlpNoCookieFirst(PY, [
        '-f','bestaudio/best',
        '-o', tmpOut,
        url
      ]);

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

    await runYtDlpNoCookieFirst(PY, [
      '-f','bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
      '-o', outPattern,
      url
    ]);

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
  let py = null, ytVer = null, ffVer = null, hasF = false;
  try { py = await pickPython(); ytVer = await run(py, ['-m','yt_dlp','--version']); } catch {}
  hasF = await haveFfmpeg();
  if (hasF) { try { ffVer = (await run('ffmpeg',['-version'])).split('\n')[0]; } catch {} }
  res.json({
    python: py,
    yt_dlp_version: ytVer,
    ffmpeg: hasF ? ffVer : null,
    cookies: { runtime: haveRuntimeCookies(), from_env_on_boot: !!process.env.YT_COOKIES },
    strict_no_cookie: STRICT_NO_COOKIE
  });
});

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/', (_req, res) => {
  res.sendFile(join(UI_DIR, 'index.html'), err => {
    if (err) res.send('UI OK — taruh file di /public-ui/index.html, atau POST /api/convert');
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Backend listening on :' + port));
