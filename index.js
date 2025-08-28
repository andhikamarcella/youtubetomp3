// index.js – fixed for Render + Docker (yt-dlp + ffmpeg)
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

// ====== PATH BINARY (coba beberapa lokasi) ======
const POSSIBLE_YTDLP_PATHS = [
  process.env.YTDLP_PATH,
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
  'yt-dlp'
];

const POSSIBLE_FFMPEG_PATHS = [
  process.env.FFMPEG_PATH,
  '/usr/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  'ffmpeg'
];

let YTDLP = null;
let FFMPEG = null;

// ====== DIRS ======
const UI_DIR     = join(__dirname, 'public-ui');
const PUBLIC_DIR = join(__dirname, 'public');
const JOBS_DIR   = join(PUBLIC_DIR, 'jobs');

if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });
if (!existsSync(JOBS_DIR))   mkdirSync(JOBS_DIR,   { recursive: true });

app.use(express.static(UI_DIR));
app.use('/jobs', express.static(JOBS_DIR, { fallthrough: false }));

// ====== HELPERS ======
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    console.log(`[run] ${cmd} ${args.join(' ')}`);
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '', err = '';
    p.stdout.on('data', d => (out += d.toString()));
    p.stderr.on('data', d => (err += d.toString()));
    p.on('error', reject);
    p.on('close', code => {
      console.log(`[run] exit code: ${code}`);
      if (code === 0) {
        resolve(out.trim());
      } else {
        console.error(`[run] stderr: ${err}`);
        reject(new Error(err || `exit ${code}`));
      }
    });
  });
}

async function findWorkingPath(paths) {
  for (const path of paths) {
    if (!path) continue;
    try {
      await run(path, ['--version']);
      console.log(`[findWorkingPath] Found working path: ${path}`);
      return path;
    } catch {
      try {
        await run(path, ['-version']);
        console.log(`[findWorkingPath] Found working path: ${path}`);
        return path;
      } catch {
        console.log(`[findWorkingPath] Path not working: ${path}`);
        continue;
      }
    }
  }
  return null;
}

async function initializePaths() {
  console.log('[init] Finding yt-dlp...');
  YTDLP = await findWorkingPath(POSSIBLE_YTDLP_PATHS);
  console.log(`[init] yt-dlp path: ${YTDLP}`);
  
  console.log('[init] Finding ffmpeg...');
  FFMPEG = await findWorkingPath(POSSIBLE_FFMPEG_PATHS);
  console.log(`[init] ffmpeg path: ${FFMPEG}`);
}

async function checkTool(cmd) {
  if (!cmd) return false;
  try { 
    await run(cmd, ['--version']); 
    return true; 
  } catch {
    try { 
      await run(cmd, ['-version']);  
      return true; 
    } catch {
      return false;
    }
  }
}

// ====== API ======
app.post('/api/convert', async (req, res) => {
  try {
    const { url, quality = 128, id3, trim, normalize } = req.body || {};
    if (!url || !/^https?:\/\//.test(url)) {
      return res.status(400).json({ error: 'URL tidak valid' });
    }

    if (!YTDLP) {
      return res.status(500).json({ error: 'yt-dlp tidak ditemukan di server. Cek instalasi.' });
    }

    const hasYtDlp = await checkTool(YTDLP);
    const hasFfmpeg = await checkTool(FFMPEG);
    
    if (!hasYtDlp) {
      return res.status(500).json({ error: `yt-dlp tidak dapat dijalankan: ${YTDLP}` });
    }

    const id = nanoid(10);
    const jobDir = join(JOBS_DIR, id);
    mkdirSync(jobDir, { recursive: true });

    // ===== MODE A: ffmpeg ADA → hasil MP3 CBR (64–320 kbps)
    if (hasFfmpeg) {
      console.log('[convert] Using ffmpeg mode');
      const tmpOut = join(jobDir, 'audio.%(ext)s');
      const outFile = join(jobDir, 'output.mp3');

      // 1) Ambil bestaudio
      console.log('[convert] Downloading audio...');
      await run(YTDLP, [
        '--no-warnings','--no-playlist','--geo-bypass','-N','2',
        '-f','bestaudio/best','-o', tmpOut, url
      ]);

      // 2) Re-encode ke MP3 CBR target
      const inputs = readdirSync(jobDir).filter(f => f.startsWith('audio.'));
      if (inputs.length === 0) return res.status(500).json({ error: 'Audio tidak ditemukan' });
      const bestAudio = join(jobDir, inputs[0]);

      console.log('[convert] Converting to MP3...');
      const ffArgs = ['-hide_banner','-y'];
      if (trim?.start && !trim?.end) ffArgs.push('-ss', trim.start);
      ffArgs.push('-i', bestAudio);
      if (trim?.end) ffArgs.push('-to', trim.end);
      if (normalize) ffArgs.push('-af', 'dynaudnorm');
      ffArgs.push('-vn','-codec:a','libmp3lame','-b:a', `${quality}k`, outFile);
      await run(FFMPEG, ffArgs);

      // 3) ID3 opsional
      if (id3?.title || id3?.artist) {
        console.log('[convert] Adding ID3 tags...');
        const tagged = join(jobDir, 'output.tagged.mp3');
        const meta = [];
        if (id3.title)  meta.push('-metadata', `title=${id3.title}`);
        if (id3.artist) meta.push('-metadata', `artist=${id3.artist}`);
        await run(FFMPEG, ['-y','-i', outFile, ...meta, '-codec:a','copy', tagged]);
        renameSync(tagged, outFile);
      }

      const safeTitle = (id3?.title || 'audio').replace(/[^\w\- ]+/g, '').trim() || 'audio';
      return res.json({
        mode: 'mp3',
        filename: `${safeTitle}-${quality}kbps.mp3`,
        downloadUrl: `/jobs/${id}/output.mp3`
      });
    }

    // ===== MODE B: ffmpeg TIDAK ADA → unduh audio ASLI (tanpa konversi)
    console.log('[convert] Using original audio mode (no ffmpeg)');
    const outPattern = join(jobDir, 'audio.%(ext)s');
    await run(YTDLP, [
      '--no-warnings','--no-playlist','--geo-bypass','-N','2',
      '-f','bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
      '-o', outPattern, url
    ]);

    const files = readdirSync(jobDir).filter(f => f.startsWith('audio.'));
    if (files.length === 0) return res.status(500).json({ error: 'Audio tidak ditemukan' });

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
    console.error('[convert:error]', e);
    res.status(500).json({ error: e?.message || 'Server error' });
  }
});

// Diagnostik yang lebih lengkap
app.get('/diag', async (_req, res) => {
  const hasY = YTDLP ? await checkTool(YTDLP) : false;
  const hasF = FFMPEG ? await checkTool(FFMPEG) : false;
  
  let ytdlpVersion = null;
  let ffmpegVersion = null;
  
  if (hasY) {
    try {
      ytdlpVersion = await run(YTDLP, ['--version']);
    } catch {}
  }
  
  if (hasF) {
    try {
      const output = await run(FFMPEG, ['-version']);
      ffmpegVersion = output.split('\n')[0];
    } catch {}
  }
  
  res.json({ 
    yt_dlp_path: YTDLP, 
    ffmpeg_path: FFMPEG, 
    has_yt_dlp: hasY, 
    has_ffmpeg: hasF,
    yt_dlp_version: ytdlpVersion,
    ffmpeg_version: ffmpegVersion,
    possible_ytdlp_paths: POSSIBLE_YTDLP_PATHS,
    possible_ffmpeg_paths: POSSIBLE_FFMPEG_PATHS
  });
});

// Health & UI
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/', (_req, res) => {
  res.sendFile(join(UI_DIR, 'index.html'), err => {
    if (err) res.send('ytmp3 backend OK – gunakan POST /api/convert atau taruh UI di /public-ui/index.html');
  });
});

// Initialize paths saat startup
initializePaths().then(() => {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Backend listening on :${port}`);
    console.log(`yt-dlp: ${YTDLP || 'NOT FOUND'}`);
    console.log(`ffmpeg: ${FFMPEG || 'NOT FOUND'}`);
  });
}).catch(err => {
  console.error('Failed to initialize:', err);
  process.exit(1);
});