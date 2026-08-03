import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { downloadMedia } from '../src/media-controller.js';

const TEST_URL = process.env.YTCONV_TEST_YOUTUBE_URL || 'https://www.youtube.com/watch?v=BaW_jenozKc';
const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-real-youtube-'));

function executable(name) {
  const command = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(command, [name], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return '';
  return result.stdout.trim().split(/\r?\n/u)[0] || '';
}

try {
  const ffmpegPath = executable('ffmpeg');
  const ffprobePath = executable('ffprobe');
  assert.ok(ffmpegPath, 'FFmpeg is required for the real YouTube smoke test.');
  assert.ok(ffprobePath, 'FFprobe is required for the real YouTube smoke test.');

  const result = await downloadMedia({
    ytDlp: {
      command: process.env.PYTHON || 'python3',
      prefixArgs: ['-m', 'yt_dlp'],
      displayPath: 'python3 -m yt_dlp',
    },
    options: {
      url: TEST_URL,
      mode: 'video',
      platformHint: 'auto',
      resolution: '144',
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
      target.write(`${line}\n`);
    },
  });

  assert.equal(result.fileCount >= 1, true, 'YTConv did not verify a real output file.');
  assert.ok(result.outputPath, 'YTConv did not return an output path.');
  assert.equal(path.extname(result.outputPath).toLowerCase(), '.mp4');

  const stats = await fs.stat(result.outputPath);
  assert.equal(stats.isFile(), true);
  assert.ok(stats.size > 1024, `The MP4 output is unexpectedly small: ${stats.size} bytes.`);

  const probe = spawnSync(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'stream=codec_type',
    '-of', 'json',
    result.outputPath,
  ], { encoding: 'utf8', windowsHide: true });
  assert.equal(probe.status, 0, probe.stderr);
  const streams = JSON.parse(probe.stdout).streams || [];
  assert.ok(streams.some((stream) => stream.codec_type === 'video'), 'The MP4 has no video stream.');
  assert.ok(streams.some((stream) => stream.codec_type === 'audio'), 'The MP4 has no audio stream.');

  process.stdout.write(`Verified real YouTube MP4: ${result.outputPath} (${stats.size} bytes)\n`);
} finally {
  await fs.rm(outputDirectory, { recursive: true, force: true });
}
