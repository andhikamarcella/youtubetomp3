import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { resolveCommandPath } from '../src/command-path.js';
import { downloadMedia } from '../src/media-controller.js';

const VIDEO_FORMATS = ['mp4', 'mkv', 'webm'];
const AUDIO_FORMATS = ['mp3', 'm4a', 'aac', 'opus', 'vorbis', 'flac', 'alac', 'wav'];
const EXPECTED_EXTENSIONS = Object.freeze({ aac: ['aac', 'm4a'], vorbis: ['ogg', 'oga'], alac: ['m4a'] });

async function requireExecutable(names) {
  const value = await resolveCommandPath(names);
  if (!value) throw new Error(`${names.join(' or ')} is required for the format integration matrix.`);
  return value;
}

function createFixture(ffmpeg, target) {
  const result = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'color=c=black:s=320x180:d=1',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-y', target,
  ], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || 'FFmpeg could not create the integration fixture.');
}

async function serveFile(file) {
  const data = await fs.readFile(file);
  const server = http.createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method || '') || request.url !== '/sample.mp4') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      'content-type': 'video/mp4',
      'content-length': data.length,
      'accept-ranges': 'bytes',
    });
    if (request.method === 'HEAD') response.end(); else response.end(data);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}/sample.mp4`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function verifyTwice({ runner, ffmpeg, url, root, mode, format, upscaleHeight = 0 }) {
  const outputDirectory = path.join(root, `${mode}-${format}${upscaleHeight ? `-upscale-${upscaleHeight}` : ''}`);
  await fs.mkdir(outputDirectory, { recursive: true });
  const options = {
    url,
    mode,
    platformHint: 'auto',
    resolution: '360',
    videoFormat: mode === 'video' ? format : 'mp4',
    audioFormat: mode === 'audio' ? format : 'mp3',
    audioQuality: 'best',
    cookieConfig: { kind: 'none' },
    playlist: false,
    outputDirectory,
    subtitles: false,
    subtitleOnly: false,
    sponsorBlockMode: 'off',
    archivePath: '',
    concurrentFragments: 2,
    retries: '3',
    fragmentRetries: '3',
    fileAccessRetries: '3',
    retrySleep: 'linear=1::2',
    resume: true,
    ffmpegPath: ffmpeg,
    upscaleHeight,
  };

  let outputPath = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await downloadMedia({ ytDlp: runner, options });
    if (result.fileCount < 1 || !result.outputPath) throw new Error(`${mode}/${format} attempt ${attempt} produced no file.`);
    const stats = await fs.stat(result.outputPath);
    if (!stats.isFile() || stats.size < 256) throw new Error(`${mode}/${format} attempt ${attempt} produced an invalid file.`);
    const actualExtension = path.extname(result.outputPath).slice(1).toLowerCase();
    const expectedExtensions = EXPECTED_EXTENSIONS[format] || [format];
    if (!expectedExtensions.includes(actualExtension)) {
      throw new Error(`${mode}/${format} attempt ${attempt} returned ${path.basename(result.outputPath)}.`);
    }
    outputPath = result.outputPath;
  }
  console.log(`OK ${mode.padEnd(5)} ${format.padEnd(7)} first + repeat conversion${upscaleHeight ? ` + ${upscaleHeight}p` : ''}`);
  return outputPath;
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-format-matrix-'));
const fixture = path.join(root, 'sample.mp4');
const ffmpeg = await requireExecutable(process.platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg'] : ['ffmpeg']);
const ffprobe = await requireExecutable(process.platform === 'win32' ? ['ffprobe.exe', 'ffprobe'] : ['ffprobe']);
const python = await requireExecutable(process.platform === 'win32' ? ['python.exe', 'python3.exe'] : ['python3', 'python']);
createFixture(ffmpeg, fixture);
const server = await serveFile(fixture);
const runner = { command: python, prefixArgs: ['-m', 'yt_dlp'], displayPath: `${python} -m yt_dlp` };

try {
  for (const format of VIDEO_FORMATS) await verifyTwice({ runner, ffmpeg, url: server.url, root, mode: 'video', format });
  for (const format of AUDIO_FORMATS) await verifyTwice({ runner, ffmpeg, url: server.url, root, mode: 'audio', format });
  const upscaled = await verifyTwice({ runner, ffmpeg, url: server.url, root, mode: 'video', format: 'mp4', upscaleHeight: 2160 });
  const probe = spawnSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', upscaled], {
    encoding: 'utf8', windowsHide: true,
  });
  if (probe.status !== 0) throw new Error(probe.stderr || 'ffprobe could not validate the 4K output.');
  const dimensions = JSON.parse(probe.stdout).streams?.[0];
  if (dimensions?.width !== 3840 || dimensions?.height !== 2160) throw new Error(`Unexpected 4K dimensions: ${JSON.stringify(dimensions)}`);
  console.log(`Verified ${VIDEO_FORMATS.length + AUDIO_FORMATS.length} formats twice.`);
} finally {
  await server.close();
  await fs.rm(root, { recursive: true, force: true });
}
