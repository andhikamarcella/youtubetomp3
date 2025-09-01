// index.js — yt-dlp + ffmpeg backend (SaveFrom-like flow)
// - /api/oembed  : ambil judul/thumb via oEmbed (noembed/youtube)
// - /api/convert : unduh bestaudio pakai yt-dlp, convert ke MP3 via ffmpeg (64..320 kbps)
// - /jobs/*      : file hasil siap unduh
// - /admin/*     : upload & cek cookies (router tetap punyamu)

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { promises as fsp } from 'node:fs';
import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import adminRouter from './admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

function sh(cmd, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '', err = '';
    p.stdout.on('data', d => out += d.toString());
    p.stderr.on('data', d => err += d.toString());
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error((err + '\n' + out).trim() || `exit ${code}`)));
  });
}
async function have(cmd, flags=['--version']) { try { await sh(cmd, flags); return true; } catch { return false; } }
function safe(name='') {
  return (name || 'audio').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0,80) || 'audio';
}

const PUBLIC_DIR = join(__dirname, 'public');
const JOBS_DIR   = join(PUBLIC_DIR, 'jobs');
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive:true });
if (!existsSync(JOBS_DIR))   mkdirSync(JOBS_DIR,   { recursive:true });

const COOKIE_PATH = '/tmp/cookies.txt'; // diisi via /admin/upload-cookies

async function fetchOEmbed(url) {
  const targets = [
    `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
  ];
  for (const t of targets) {
    try {
      const r = await fetch(t, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!r.ok) continue;
      const j = await r.json();
      return { ok:true, title:j.title||null, author:j.author_name||j.author||null, thumbnail:j.thumbnail_url||null, provider:j.provider_name||null };
    } catch {}
  }
  return { ok:false };
}

async function ytdlpDownload(url, tmpDir) {
  const args = ['-f','bestaudio/best','--no-playlist','-o', join(tmpDir, '%(title).80s.%(id)s.%(ext)s')];
  if (existsSync(COOKIE_PATH)) args.push('--cookies', COOKIE_PATH);
  args.push(url);
  await sh('yt-dlp', args);

  const files = await fsp.readdir(tmpDir);
  let latest=null, latestSt=null;
  for (const f of files) {
    const p = join(tmpDir,f), st = await fsp.stat(p);
    if (!latest || st.mtimeMs > latestSt.mtimeMs) { latest=p; latestSt=st; }
  }
  if (!latest) throw new Error('File hasil yt-dlp tidak ditemukan');
  return latest;
}

async function ffmpegToMp3(inputPath, outPath, kbps=192) {
  mkdirSync(dirname(outPath), { recursive:true });
  const args = ['-y','-i',inputPath,'-vn','-ac','2','-ar','44100','-b:a',`${kbps}k`, outPath];
  await sh('ffmpeg', args);
  return outPath;
}

const app = express();
app.use(express.json({ limit:'2mb' }));
app.use(cors());

app.use('/admin', adminRouter);
app.use('/jobs', express.static(JOBS_DIR, { maxAge:'7d' }));
app.use('/', express.static(__dirname, { maxAge:'1h', fallthrough:true }));

app.get('/', (_req,res)=>res.sendFile(join(__dirname,'index.html')));
app.get('/health', async (_req,res)=>{
  const okY = await have('yt-dlp'); const okF = await have('ffmpeg');
  res.json({ ok: okY && okF, yt_dlp: okY, ffmpeg: okF, ts: Date.now() });
});

app.get('/api/oembed', async (req,res)=>{
  const url = String(req.query.url||'');
  if (!url) return res.status(400).json({ error:'url required' });
  try {
    const meta = await fetchOEmbed(url);
    res.json(meta.ok ? { ok:true, meta } : { ok:false });
  } catch(e){ res.status(500).json({ error: String(e.message||e) }); }
});

// body: { url, kbps(64..320), filename? }
app.post('/api/convert', async (req,res)=>{
  const url  = String(req.body?.url||'');
  const kbps = Math.max(64, Math.min(320, Number(req.body?.kbps||192)));
  const fname= safe(String(req.body?.filename||''));
  if (!url) return res.status(400).json({ error:'url required' });

  const okY = await have('yt-dlp'); if (!okY) return res.status(500).json({ error:'yt-dlp tidak ditemukan di server' });
  const okF = await have('ffmpeg'); if (!okF) return res.status(500).json({ error:'ffmpeg tidak ditemukan di server' });

  const jobId = nanoid(8), jobDir = join(JOBS_DIR, jobId);
  await fsp.mkdir(jobDir, { recursive:true });

  try {
    const tmpDir = join(jobDir, 'tmp'); await fsp.mkdir(tmpDir, { recursive:true });
    const srcPath = await ytdlpDownload(url, tmpDir);

    const base = fname || basename(srcPath).replace(/\.[^.]+$/, '');
    const outPath = join(jobDir, base + '.mp3');
    await ffmpegToMp3(srcPath, outPath, kbps);

    await fsp.rm(tmpDir, { recursive:true, force:true });

    const dlUrl = `/jobs/${jobId}/${basename(outPath)}`;
    const st = await fsp.stat(outPath);
    const filename = basename(outPath);
    res.json({
      ok: true,
      downloadUrl: dlUrl,
      filename,
      // backward compatibility
      download_url: dlUrl,
      absolute_url: dlUrl,
      job: { id: jobId, kbps, url, file: filename, size: st.size }
    });
  } catch(e) {
    res.status(500).json({ error: String(e.message||e), hint:'Unggah cookies YouTube di /admin/upload-cookies jika kena age/robot check.' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, ()=> console.log(`[server] listening on :${PORT}`));
