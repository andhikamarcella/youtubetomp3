import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildDownloadArgs, downloadOutputTemplate } from '../src/downloader.js';
import { managedArchivePaths } from '../src/defaults.js';
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
    subtitleOnly: false,
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
  const rootDirectory = await temporaryDirectory(t);
  const outputDirectory = path.join(rootDirectory, 'output');
  await fs.mkdir(outputDirectory, { recursive: true });
  const script = path.join(rootDirectory, 'fake-yt-dlp.mjs');
  const marker = path.join(rootDirectory, 'calls.jsonl');
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
if (process.env.YTCONV_TEST_BEHAVIOR === 'quiet-archive-recovery') {
  if (args.includes('--download-archive')) process.exit(0);
  const target = path.join(process.cwd(), 'quietly-restored.mp4');
  fs.writeFileSync(target, 'verified quiet archive recovery');
  console.log('ytconv-file:' + target);
  process.exit(0);
}
if (process.env.YTCONV_TEST_BEHAVIOR === 'existing-output') {
  console.log('ytconv-file:' + process.env.YTCONV_TEST_EXISTING_FILE);
  process.exit(0);
}
if (process.env.YTCONV_TEST_BEHAVIOR === 'quality-switch') {
  const selector = args[args.indexOf('-f') + 1] || '';
  const resolution = selector.split('height=')[1]?.match(/^[0-9]+/)?.[0] || 'best';
  const archiveIndex = args.indexOf('--download-archive');
  const archive = archiveIndex >= 0 ? args[archiveIndex + 1] : '';
  if (archive && fs.existsSync(archive) && fs.readFileSync(archive, 'utf8').includes('youtube BaW_jenozKc')) {
    console.log('[download] BaW_jenozKc has already been recorded in the archive');
    process.exit(0);
  }
  if (archive) {
    fs.mkdirSync(path.dirname(archive), { recursive: true });
    fs.appendFileSync(archive, 'youtube BaW_jenozKc\\n');
  }
  const target = path.join(process.cwd(), 'quality-' + resolution + '.mp4');
  fs.writeFileSync(target, 'verified ' + resolution + 'p output');
  console.log('ytconv-file:' + target);
  process.exit(0);
}
if (process.env.YTCONV_TEST_BEHAVIOR === 'thumbnail-only') {
  const target = path.join(process.cwd(), 'thumbnail.jpg');
  fs.writeFileSync(target, 'not a video');
  console.log('ytconv-file:' + target);
  process.exit(0);
}
if (process.env.YTCONV_TEST_BEHAVIOR === 'metadata-only') {
  fs.writeFileSync(path.join(process.cwd(), 'metadata.info.json'), '{}');
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
    directory: outputDirectory,
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
  assert.match(selector, /\/b$/u);
  assert.deepEqual(videoContainerArgs('mp4'), [
    '--merge-output-format', 'mp4', '--recode-video', 'mp4',
  ]);
});

test('2160p source formats outrank lower AVC fallbacks and output names are quality-specific', () => {
  const selector = formatVideoSelector('2160', 'mp4');
  const exactAny = selector.indexOf('bv[height=2160]+ba');
  const boundedAvc = selector.indexOf('bv[height<=2160][ext=mp4][vcodec^=avc1]+ba[ext=m4a]');
  assert.ok(exactAny >= 0);
  assert.ok(boundedAvc > exactAny, selector);

  const hd = downloadOutputTemplate(baseOptions({ resolution: '1080', outputDirectory: '/downloads' }));
  const fourK = downloadOutputTemplate(baseOptions({ resolution: '2160', outputDirectory: '/downloads' }));
  assert.notEqual(hd, fourK);
  assert.match(hd, /ytconv-video-auto-1080/u);
  assert.match(fourK, /ytconv-video-auto-2160/u);
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

test('1080p then 2160p then repeated 2160p stay distinct with managed archives enabled', async (t) => {
  const { directory, marker, runner } = await fakeRunner(t, 'quality-switch');
  const homeDirectory = path.dirname(directory);
  const results = [];
  for (const resolution of ['1080', '2160', '2160']) {
    const archives = managedArchivePaths(
      { mode: 'video', videoFormat: 'auto', resolution },
      { homeDirectory },
    );
    results.push(await downloadMedia({
      ytDlp: runner,
      options: baseOptions({
        outputDirectory: directory,
        resolution,
        archivePath: archives.archivePath,
        galleryArchivePath: archives.galleryArchivePath,
      }),
    }));
  }

  assert.notEqual(results[0].outputPath, results[1].outputPath);
  assert.equal(await fs.readFile(results[0].outputPath, 'utf8'), 'verified 1080p output');
  assert.equal(await fs.readFile(results[1].outputPath, 'utf8'), 'verified 2160p output');
  assert.equal(await fs.readFile(results[2].outputPath, 'utf8'), 'verified 2160p output');
  const calls = (await fs.readFile(marker, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(calls.length, 4);
  assert.notEqual(
    calls[0][calls[0].indexOf('--download-archive') + 1],
    calls[1][calls[1].indexOf('--download-archive') + 1],
  );
  assert.equal(calls[2].includes('--download-archive'), true);
  assert.equal(calls[3].includes('--download-archive'), false);
});

test('interactive environment archive is recovered even when yt-dlp quietly exits zero', async (t) => {
  const { directory, marker, runner } = await fakeRunner(t, 'quiet-archive-recovery');
  const previousArchive = process.env.YTCONV_ARCHIVE;
  process.env.YTCONV_ARCHIVE = path.join(directory, 'ui-default-archive.txt');
  t.after(() => {
    if (previousArchive === undefined) delete process.env.YTCONV_ARCHIVE;
    else process.env.YTCONV_ARCHIVE = previousArchive;
  });

  const options = baseOptions({ outputDirectory: directory });
  delete options.archivePath;
  const result = await downloadMedia({ ytDlp: runner, options });

  assert.equal(await fs.readFile(result.outputPath, 'utf8'), 'verified quiet archive recovery');
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
  const canonicalExisting = await fs.realpath(existing);
  assert.equal(result.outputPath, canonicalExisting);
  assert.deepEqual(result.outputPaths, [canonicalExisting]);
  assert.equal(result.fileCount, 1);
});

test('yt-dlp exit zero without a real mode-matching file is rejected', async (t) => {
  for (const behavior of ['zero-output', 'thumbnail-only', 'metadata-only']) {
    const { directory, runner } = await fakeRunner(t, behavior);
    await assert.rejects(
      downloadMedia({
        ytDlp: runner,
        options: baseOptions({ outputDirectory: directory }),
      }),
      /exited successfully but produced no video file/u,
    );
  }
});
