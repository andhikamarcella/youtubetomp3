import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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

function probeMedia(ffprobePath, outputPath) {
  const probe = spawnSync(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,codec_name',
    '-of', 'json',
    outputPath,
  ], { encoding: 'utf8', windowsHide: true });
  assert.equal(probe.status, 0, probe.stderr);
  return JSON.parse(probe.stdout).streams || [];
}

async function verifyCandidate({ url, index, ffmpegPath, ffprobePath }) {
  const outputDirectory = path.join(rootDirectory, `candidate-${index + 1}`);
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
      clipEnd: '10',
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
      target.write(`[candidate ${index + 1}] ${line}\n`);
    },
  });

  assert.equal(result.fileCount >= 1, true, 'YTConv did not verify a real output file.');
  assert.ok(result.outputPath, 'YTConv did not return an output path.');
  assert.equal(path.extname(result.outputPath).toLowerCase(), '.mp4');

  const stats = await fs.stat(result.outputPath);
  assert.equal(stats.isFile(), true);
  assert.ok(stats.size > 1024, `The MP4 output is unexpectedly small: ${stats.size} bytes.`);

  const streams = probeMedia(ffprobePath, result.outputPath);
  assert.ok(streams.some((stream) => stream.codec_type === 'video'), 'The MP4 has no video stream.');
  assert.ok(streams.some((stream) => stream.codec_type === 'audio'), 'The MP4 has no audio stream.');

  return { outputPath: result.outputPath, size: stats.size, streams };
}

try {
  const ffmpegPath = executable('ffmpeg');
  const ffprobePath = executable('ffprobe');
  assert.ok(ffmpegPath, 'FFmpeg is required for the real YouTube smoke test.');
  assert.ok(ffprobePath, 'FFprobe is required for the real YouTube smoke test.');
  assert.ok(TEST_URLS.length > 0, 'At least one real YouTube test URL is required.');

  const failures = [];
  let verified = null;
  for (let index = 0; index < TEST_URLS.length; index += 1) {
    const url = TEST_URLS[index];
    process.stdout.write(`Trying real YouTube candidate ${index + 1}/${TEST_URLS.length}: ${url}\n`);
    try {
      verified = await verifyCandidate({ url, index, ffmpegPath, ffprobePath });
      process.stdout.write(
        `Verified real YouTube MP4: ${verified.outputPath} (${verified.size} bytes; `
        + `${verified.streams.map((stream) => `${stream.codec_type}:${stream.codec_name}`).join(', ')})\n`,
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
