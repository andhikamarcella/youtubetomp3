import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repairBundledFfmpeg } from '../src/dependencies.js';
import { downloadMedia } from '../src/media-controller.js';

const DEFAULT_TEST_URLS = [
  // Blender Foundation open movies. Only a short clip is downloaded.
  'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  'https://www.youtube.com/watch?v=eRsGyueVLvQ',
  'https://www.youtube.com/watch?v=R6MlUcmOul8',
];
const TEST_URLS = (process.env.YTCONV_TEST_YOUTUBE_URLS
  || process.env.YTCONV_TEST_YOUTUBE_URL
  || DEFAULT_TEST_URLS.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const rootDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-real-youtube-'));

function executable(name) {
  const command = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(command, [name], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return '';
  return result.stdout.trim().split(/\r?\n/u)[0] || '';
}

async function resolveFfmpeg() {
  const system = executable('ffmpeg');
  if (system) return { path: system, source: 'system FFmpeg' };

  process.stdout.write('System FFmpeg is unavailable; testing YTConv verified FFmpeg repair...\n');
  const repaired = await repairBundledFfmpeg({ silent: false });
  assert.equal(
    repaired.installed,
    true,
    repaired.error || 'YTConv verified FFmpeg repair did not install an executable.',
  );
  assert.ok(repaired.path, 'YTConv verified FFmpeg repair returned no executable path.');
  return {
    path: repaired.path,
    source: repaired.repaired ? 'new verified YTConv FFmpeg' : 'existing verified YTConv FFmpeg',
  };
}

function verifyStream(ffmpegPath, outputPath, type) {
  const args = type === 'video'
    ? ['-v', 'error', '-i', outputPath, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-']
    : ['-v', 'error', '-i', outputPath, '-map', '0:a:0', '-t', '1', '-f', 'null', '-'];
  const result = spawnSync(ffmpegPath, args, {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(
    result.status,
    0,
    `The MP4 has no decodable ${type} stream. ${result.stderr || result.error?.message || ''}`,
  );
}

async function verifyCandidate({ url, index, pass, ffmpegPath }) {
  const outputDirectory = path.join(rootDirectory, `candidate-${index + 1}-pass-${pass}`);
  await fs.mkdir(outputDirectory, { recursive: true });

  const result = await downloadMedia({
    ytDlp: {
      command: process.env.PYTHON || 'python3',
      prefixArgs: ['-m', 'yt_dlp'],
      displayPath: 'python3 -m yt_dlp',
    },
    options: {
      url,
      mode: 'video',
      platformHint: 'auto',
      resolution: '240',
      videoFormat: 'auto',
      audioFormat: 'mp3',
      audioQuality: 'best',
      cookieConfig: { kind: 'none' },
      playlist: false,
      outputDirectory,
      ffmpegPath,
      subtitles: false,
      subtitleOnly: false,
      sponsorBlockMode: 'off',
      archivePath: '',
      galleryArchivePath: '',
      clipStart: '0',
      clipEnd: '5',
      resume: true,
      overwrite: true,
      retries: '5',
      fragmentRetries: '5',
      fileAccessRetries: '3',
      retrySleep: 'linear=1::2',
      concurrentFragments: '1',
    },
    onLog(line, isError) {
      const target = isError ? process.stderr : process.stdout;
      target.write(`[candidate ${index + 1}, pass ${pass}] ${line}\n`);
    },
  });

  assert.equal(result.fileCount >= 1, true, 'YTConv did not verify a real output file.');
  assert.ok(result.outputPath, 'YTConv did not return an output path.');
  assert.equal(path.extname(result.outputPath).toLowerCase(), '.mp4');

  const stats = await fs.stat(result.outputPath);
  assert.equal(stats.isFile(), true);
  assert.ok(stats.size > 1024, `The MP4 output is unexpectedly small: ${stats.size} bytes.`);

  verifyStream(ffmpegPath, result.outputPath, 'video');
  verifyStream(ffmpegPath, result.outputPath, 'audio');

  return { outputPath: result.outputPath, size: stats.size };
}

try {
  const ffmpeg = await resolveFfmpeg();
  const version = spawnSync(ffmpeg.path, ['-version'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(version.status, 0, version.stderr || version.error?.message);
  process.stdout.write(`Using ${ffmpeg.source}: ${ffmpeg.path}\n`);
  assert.ok(TEST_URLS.length > 0, 'At least one real YouTube test URL is required.');

  const failures = [];
  let verified = null;
  for (let index = 0; index < TEST_URLS.length; index += 1) {
    const url = TEST_URLS[index];
    process.stdout.write(`Trying real YouTube candidate ${index + 1}/${TEST_URLS.length}: ${url}\n`);
    try {
      const first = await verifyCandidate({ url, index, pass: 1, ffmpegPath: ffmpeg.path });
      const second = await verifyCandidate({ url, index, pass: 2, ffmpegPath: ffmpeg.path });
      verified = second;
      process.stdout.write(
        `Verified real YouTube MP4 twice: ${first.size} bytes then ${second.size} bytes; video + audio\n`,
      );
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${url}: ${message}`);
      process.stderr.write(`Candidate ${index + 1} failed: ${message}\n`);
    }
  }

  assert.ok(
    verified,
    `No real public YouTube candidate produced a verified MP4 with video and audio. ${failures.join(' | ')}`,
  );
} finally {
  await fs.rm(rootDirectory, { recursive: true, force: true });
}
