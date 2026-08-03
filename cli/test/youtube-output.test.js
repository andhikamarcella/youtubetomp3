import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildDownloadArgs } from '../src/downloader.js';
import { downloadMedia, effectiveMediaMode } from '../src/media-controller.js';
import {
  effectiveVideoContainer,
  formatVideoSelector,
  videoContainerArgs,
} from '../src/youtube-output.js';

function baseOptions(overrides = {}) {
  return {
    url: 'https://www.youtube.com/watch?v=BaW_jenozKc',
    mode: 'video',
    platformHint: 'auto',
    resolution: '720',
    videoFormat: 'auto',
    audioFormat: 'mp3',
    audioQuality: 'best',
    cookieConfig: { kind: 'none' },
    playlist: false,
    outputDirectory: os.tmpdir(),
    subtitles: false,
    sponsorBlockMode: 'off',
    archivePath: '',
    ...overrides,
  };
}

async function temporaryDirectory(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-youtube-output-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

async function fakeRunner(t, behavior) {
  const directory = await temporaryDirectory(t);
  const script = path.join(directory, 'fake-yt-dlp.mjs');
  const marker = path.join(directory, 'calls.jsonl');
  await fs.writeFile(script, `
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
fs.appendFileSync(process.env.YTCONV_TEST_MARKER, JSON.stringify(args) + '\\n');
if (process.env.YTCONV_TEST_BEHAVIOR === 'archive-recovery') {
  if (args.includes('--download-archive')) {
    console.log('[download] BaW_jenozKc has already been recorded in the archive');
    process.exit(0);
  }
  const target = path.join(process.cwd(), 'restored.mp4');
  fs.writeFileSync(target, 'verified mp4 output');
  console.log('ytconv-file:' + target);
  process.exit(0);
}
if (process.env.YTCONV_TEST_BEHAVIOR === 'existing-output') {
  console.log('ytconv-file:' + process.env.YTCONV_TEST_EXISTING_FILE);
  process.exit(0);
}
if (process.env.YTCONV_TEST_BEHAVIOR === 'zero-output') process.exit(0);
process.exit(2);
`, 'utf8');

  const previous = {
    marker: process.env.YTCONV_TEST_MARKER,
    behavior: process.env.YTCONV_TEST_BEHAVIOR,
    existing: process.env.YTCONV_TEST_EXISTING_FILE,
  };
  process.env.YTCONV_TEST_MARKER = marker;
  process.env.YTCONV_TEST_BEHAVIOR = behavior;
  t.after(() => {
    if (previous.marker === undefined) delete process.env.YTCONV_TEST_MARKER;
    else process.env.YTCONV_TEST_MARKER = previous.marker;
    if (previous.behavior === undefined) delete process.env.YTCONV_TEST_BEHAVIOR;
    else process.env.YTCONV_TEST_BEHAVIOR = previous.behavior;
    if (previous.existing === undefined) delete process.env.YTCONV_TEST_EXISTING_FILE;
    else process.env.YTCONV_TEST_EXISTING_FILE = previous.existing;
  });

  return {
    directory,
    marker,
    runner: { command: process.execPath, prefixArgs: [script], displayPath: script },
  };
}

test('AUTO routes YouTube Music to MP3 audio and regular YouTube to video', () => {
  assert.equal(effectiveMediaMode({
    url: 'https://music.youtube.com/watch?v=music-id',
    mode: 'auto',
  }), 'audio');
  assert.equal(effectiveMediaMode({
    url: 'https://www.youtube.com/watch?v=video-id',
    mode: 'auto',
  }), 'video');
  assert.equal(effectiveMediaMode({
    url: 'https://youtu.be/video-id',
    mode: 'auto',
  }), 'video');

  const musicArgs = buildDownloadArgs(baseOptions({
    url: 'https://music.youtube.com/watch?v=music-id',
    mode: 'audio',
  }));
  assert.equal(musicArgs[musicArgs.indexOf('--audio-format') + 1], 'mp3');
  assert.equal(musicArgs.includes('--merge-output-format'), false);
});

test('regular YouTube AUTO video defaults to MP4 while user choices win', () => {
  assert.equal(effectiveVideoContainer({
    url: 'https://www.youtube.com/watch?v=video-id',
    mode: 'video',
    requestedContainer: 'auto',
  }), 'mp4');
  assert.equal(effectiveVideoContainer({
    url: 'https://music.youtube.com/watch?v=music-id',
    mode: 'video',
    requestedContainer: 'mkv',
  }), 'mkv');
  assert.equal(effectiveMediaMode({
    url: 'https://music.youtube.com/watch?v=music-id',
    mode: 'video',
  }), 'video');

  const args = buildDownloadArgs(baseOptions({ videoFormat: 'auto' }));
  assert.equal(args[args.indexOf('--merge-output-format') + 1], 'mp4');
  assert.equal(args[args.indexOf('--recode-video') + 1], 'mp4');
  assert.match(args[args.indexOf('-f') + 1], /vcodec\^=avc1/u);

  const explicit = buildDownloadArgs(baseOptions({ videoFormat: 'webm' }));
  assert.equal(explicit[explicit.indexOf('--merge-output-format') + 1], 'webm');
  assert.equal(explicit[explicit.indexOf('--recode-video') + 1], 'webm');
});

test('MP4 selector has AVC M4A preference and conversion-safe fallback', () => {
  const selector = formatVideoSelector('1080', 'mp4');
  assert.match(selector, /bv\[height<=1080\]\[ext=mp4\]\[vcodec\^=avc1\]\+ba\[ext=m4a\]/u);
  assert.match(selector, /bv\[height<=1080\]\+ba/u);
  assert.deepEqual(videoContainerArgs('mp4'), [
    '--merge-output-format', 'mp4', '--recode-video', 'mp4',
  ]);
});

test('archive skip with a missing file is restored once without the archive', async (t) => {
  const { directory, marker, runner } = await fakeRunner(t, 'archive-recovery');
  const result = await downloadMedia({
    ytDlp: runner,
    options: baseOptions({
      outputDirectory: directory,
      archivePath: path.join(directory, 'archive.txt'),
    }),
  });

  assert.equal(result.fileCount, 1);
  assert.equal(path.extname(result.outputPath), '.mp4');
  assert.equal(await fs.readFile(result.outputPath, 'utf8'), 'verified mp4 output');
  const calls = (await fs.readFile(marker, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].includes('--download-archive'), true);
  assert.equal(calls[1].includes('--download-archive'), false);
});

test('an existing path printed by yt-dlp is verified instead of treated as empty', async (t) => {
  const { directory, runner } = await fakeRunner(t, 'existing-output');
  const existing = path.join(directory, 'already-here.mp4');
  await fs.writeFile(existing, 'existing output', 'utf8');
  process.env.YTCONV_TEST_EXISTING_FILE = existing;

  const result = await downloadMedia({
    ytDlp: runner,
    options: baseOptions({ outputDirectory: directory }),
  });
  assert.equal(result.outputPath, existing);
  assert.deepEqual(result.outputPaths, [existing]);
  assert.equal(result.fileCount, 1);
});

test('yt-dlp exit zero without a real file is rejected', async (t) => {
  const { directory, runner } = await fakeRunner(t, 'zero-output');
  await assert.rejects(
    downloadMedia({
      ytDlp: runner,
      options: baseOptions({ outputDirectory: directory }),
    }),
    /exited successfully but produced no file/u,
  );
});
