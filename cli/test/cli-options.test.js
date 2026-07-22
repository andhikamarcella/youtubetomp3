import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  applyCliEnvironment,
  helpText,
  isDirectCommand,
  parseCliOptions,
} from '../src/cli-options.js';

const ENV_KEYS = [
  'YTCONV_PRESET',
  'YTCONV_AUDIO_FORMAT',
  'YTCONV_AUDIO_QUALITY',
  'YTCONV_VIDEO_FORMAT',
  'YTCONV_RESOLUTION',
  'YTCONV_SUBTITLES',
  'YTCONV_SPONSORBLOCK_MODE',
  'YTCONV_RATE_LIMIT',
  'YTCONV_CONCURRENT_FRAGMENTS',
  'YTCONV_OUTPUT_TEMPLATE',
];

function withCleanEnvironment(callback) {
  const previous = Object.fromEntries(ENV_KEYS.map((name) => [name, process.env[name]]));
  for (const name of ENV_KEYS) delete process.env[name];
  try {
    return callback();
  } finally {
    for (const name of ENV_KEYS) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

test('parses URL, platform, playlist, output and cookies options', () => {
  const options = parseCliOptions([
    '--platform', 'facebook',
    '--playlist',
    '--output', './downloads',
    '--cookies', './cookies.txt',
    'https://www.facebook.com/reel/example',
  ]);
  assert.equal(options.initialPlatform, 'facebook');
  assert.equal(options.initialPlaylist, true);
  assert.equal(options.initialUrl, 'https://www.facebook.com/reel/example');
  assert.equal(options.outputDirectory, path.resolve('./downloads'));
  assert.equal(options.cookiesPath, path.resolve('./cookies.txt'));
});

test('presets apply before explicit options regardless of argument order', () => {
  const music = parseCliOptions(['--audio-quality', '128', '--preset', 'music']);
  assert.equal(music.preset, 'music');
  assert.equal(music.initialMode, 'audio');
  assert.equal(music.audioFormat, 'mp3');
  assert.equal(music.audioQuality, '128');
  assert.equal(music.writeThumbnail, true);

  const archive = parseCliOptions(['--preset', 'archive']);
  assert.equal(archive.videoFormat, 'mkv');
  assert.equal(archive.subtitles, true);
  assert.equal(archive.writeInfoJson, true);
  assert.match(archive.archivePath, /ytconv-archive\.txt$/u);
});

test('parses mature audio, video, network, and file settings', () => {
  const options = parseCliOptions([
    '--audio-format', 'alac',
    '--audio-quality', '256',
    '--normalize-audio',
    '--keep-video',
    '--sponsorblock', 'remove',
    '--rate-limit', '2m',
    '--concurrent-fragments', '8',
    '--proxy', 'socks5://127.0.0.1:1080',
    '--output-template', '%(uploader)s/%(title)s.%(ext)s',
    '--restrict-filenames',
    '--overwrite',
    '--log-file', './ytconv.log',
  ]);
  assert.equal(options.audioFormat, 'alac');
  assert.equal(options.audioQuality, '256');
  assert.equal(options.normalizeAudio, true);
  assert.equal(options.keepVideo, true);
  assert.equal(options.sponsorBlockMode, 'remove');
  assert.equal(options.rateLimit, '2M');
  assert.equal(options.concurrentFragments, 8);
  assert.equal(options.proxy, 'socks5://127.0.0.1:1080');
  assert.equal(options.outputTemplate, '%(uploader)s/%(title)s.%(ext)s');
  assert.equal(options.restrictFilenames, true);
  assert.equal(options.overwrite, true);
  assert.equal(options.logFile, path.resolve('./ytconv.log'));
});

test('parses subtitle, sidecar, clipping, live and playlist ranges', () => {
  const options = parseCliOptions([
    '--video-format', 'webm',
    '--resolution', '1080',
    '--subtitles',
    '--subtitle-langs', 'id,en',
    '--metadata-files',
    '--thumbnail',
    '--start', '01:02',
    '--end', '01:05:30',
    '--archive', './downloaded.txt',
    '--playlist-items', '1,3,5-10',
    '--max-downloads', '25',
    '--live-from-start',
  ]);
  assert.equal(options.initialMode, 'video');
  assert.equal(options.videoFormat, 'webm');
  assert.equal(options.resolution, '1080');
  assert.equal(options.subtitles, true);
  assert.equal(options.subtitleLanguages, 'id,en');
  assert.equal(options.writeInfoJson, true);
  assert.equal(options.writeDescription, true);
  assert.equal(options.writeThumbnail, true);
  assert.equal(options.clipStart, '01:02');
  assert.equal(options.clipEnd, '01:05:30');
  assert.equal(options.archivePath, path.resolve('./downloaded.txt'));
  assert.equal(options.playlistItems, '1,3,5-10');
  assert.equal(options.maxDownloads, 25);
  assert.equal(options.liveFromStart, true);
});

test('direct commands are detected and JSON implies dry run', () => {
  const json = parseCliOptions(['--json', 'https://example.com/video']);
  assert.equal(json.dryRun, true);
  assert.equal(json.noUpdateCheck, true);
  assert.equal(isDirectCommand(json), true);
  assert.equal(isDirectCommand(parseCliOptions([])), false);
});

test('environment mapping is deterministic', () => withCleanEnvironment(() => {
  const options = parseCliOptions([
    '--preset', 'hd',
    '--subtitles',
    '--sponsorblock', 'mark',
    '--rate-limit', '1M',
    '--concurrent-fragments', '6',
    '--output-template', '%(title)s.%(ext)s',
  ]);
  applyCliEnvironment(options);
  assert.equal(process.env.YTCONV_PRESET, 'hd');
  assert.equal(process.env.YTCONV_VIDEO_FORMAT, 'mp4');
  assert.equal(process.env.YTCONV_RESOLUTION, '1080');
  assert.equal(process.env.YTCONV_SUBTITLES, '1');
  assert.equal(process.env.YTCONV_SPONSORBLOCK_MODE, 'mark');
  assert.equal(process.env.YTCONV_RATE_LIMIT, '1M');
  assert.equal(process.env.YTCONV_CONCURRENT_FRAGMENTS, '6');
  assert.equal(process.env.YTCONV_OUTPUT_TEMPLATE, '%(title)s.%(ext)s');
}));

test('rejects invalid values and unsafe output templates', () => {
  assert.throws(() => parseCliOptions(['--unknown']), /Opsi tidak dikenal/u);
  assert.throws(() => parseCliOptions(['--preset', 'cinema']), /tidak dikenal/u);
  assert.throws(() => parseCliOptions(['--audio-format', 'wma']), /mp3, m4a, aac/u);
  assert.throws(() => parseCliOptions(['--video-format', 'avi']), /auto, mp4, mkv, webm/u);
  assert.throws(() => parseCliOptions(['--start', 'abc']), /detik, MM:SS, atau HH:MM:SS/u);
  assert.throws(() => parseCliOptions(['--rate-limit', 'fast']), /500K/u);
  assert.throws(() => parseCliOptions(['--concurrent-fragments', '99']), /1–16/u);
  assert.throws(() => parseCliOptions(['--proxy', 'file:///tmp/proxy']), /proxy http/u);
  assert.throws(() => parseCliOptions(['--output-template', '../x.%(ext)s']), /di dalam folder output/u);
  assert.throws(() => parseCliOptions(['--output-template', '%(title)s']), /%\(ext\)s/u);
  assert.throws(() => parseCliOptions(['--playlist-items', 'one-two']), /angka/u);
});

test('help documents final 1.2 command surface', () => {
  const text = helpText();
  assert.match(text, /--preset/u);
  assert.match(text, /--normalize-audio/u);
  assert.match(text, /--sponsorblock/u);
  assert.match(text, /--output-template/u);
  assert.match(text, /--dry-run/u);
  assert.match(text, /--list-formats/u);
  assert.match(text, /--log-file/u);
});
