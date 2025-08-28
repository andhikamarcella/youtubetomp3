import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { nanoid } from 'nanoid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors()); // jika frontend beda origin. Jika satu origin, Anda boleh hapus ini.

// Sediakan folder publik untuk hasil unduhan
const PUBLIC_DIR = join(__dirname, 'public');
const JOBS_DIR = join(PUBLIC_DIR, 'jobs');
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR);
if (!existsSync(JOBS_DIR)) mkdirSync(JOBS_DIR);
app.use('/jobs', express.static(JOBS_DIR, { fallthrough: false }));

// Cek ketersediaan yt-dlp & ffmpeg di PATH
function checkTool(cmd) {
  return new Promise((resolve) => {
    const p = spawn(cmd, ['-version']);
    p.on('error', () => resolve(false));
    p.on('close', (code) => resolve(code === 0));
  });
}

app.post('/api/convert', async (req, res) => {
  try {
    const { url, quality = 128, id3, trim, normalize } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Missing url' });

    const hasYtDlp = await checkTool('yt-dlp');
    const hasFfmpeg = await checkTool('ffmpeg');
    if (!hasYtDlp || !hasFfmpeg) {
      return res.status(500).json({ error: 'yt-dlp/ffmpeg tidak ditemukan di server' });
    }

    const id = nanoid(10);
    const jobDir = join(JOBS_DIR, id);
    mkdirSync(jobDir);

    // 1) Ambil audio terbaik (m4a/webm) dari YouTube
    const bestAudio = join(jobDir, 'audio.m4a');
    const ytdlpArgs = [
      '-f', 'bestaudio/best',
      '-o', bestAudio,
      url
    ];

    await new Promise((resolve, reject) => {
      const y = spawn('yt-dlp', ytdlpArgs);
      y.on('error', reject);
      y.stderr.on('data', d => process.stderr.write(d));
      y.on('close', code => code === 0 ? resolve() : reject(new Error('yt-dlp gagal')));
    });

    // 2) Konversi ke MP3 sesuai kualitas + opsi trim/normalize
    const outFile = join(jobDir, 'output.mp3');
    const ffArgs = ['-y', '-i', bestAudio];

    if (trim?.start) ffArgs.unshift('-ss', trim.start);
    if (trim?.end) ffArgs.push('-to', trim.end);

    if (normalize) {
      // filter loudness dasar
      ffArgs.push('-af', 'dynaudnorm');
    }

    ffArgs.push('-vn', '-codec:a', 'libmp3lame', '-b:a', `${quality}k`, outFile);

    await new Promise((resolve, reject) => {
      const f = spawn('ffmpeg', ffArgs);
      f.on('error', reject);
      f.stderr.on('data', d => process.stderr.write(d));
      f.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg gagal')));
    });

    // 3) (Opsional) tulis ID3 dengan ffmpeg -metadata
    if (id3?.title || id3?.artist) {
      const tagged = join(jobDir, 'output.tagged.mp3');
      const meta = [];
      if (id3.title) meta.push('-metadata', `title=${id3.title}`);
      if (id3.artist) meta.push('-metadata', `artist=${id3.artist}`);
      await new Promise((resolve, reject) => {
        const f2 = spawn('ffmpeg', ['-y', '-i', outFile, ...meta, '-codec:a', 'copy', tagged]);
        f2.on('error', reject);
        f2.on('close', code => code === 0 ? resolve() : reject(new Error('penulisan ID3 gagal')));
      });
      // ganti file
      await new Promise((resolve, reject) => {
        const f3 = spawn(process.platform === 'win32' ? 'cmd' : 'bash', process.platform === 'win32' ? ['/c', 'move', '/y', tagged, outFile] : ['-lc', `mv -f "${tagged}" "${outFile}"`]);
        f3.on('error', reject);
        f3.on('close', () => resolve());
      });
    }

    const filename = `${(id3?.title || 'audio')}-${quality}kbps.mp3`;
    const downloadUrl = `/jobs/${id}/output.mp3`;
    res.json({ filename, downloadUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// (Opsional) layani file frontend statis jika ditempatkan di ../public-ui
// app.use(express.static(join(__dirname, '../public-ui')))

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Backend listening on :' + port));