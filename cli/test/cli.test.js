import test from 'node:test';
import assert from 'node:assert/strict';
import { cookieArgs, cookieSourcesForPlatform } from '../src/cookies.js';
import {
  buildDownloadArgs,
  buildUtilityArgs,
  formatVideoSelector,
  javascriptRuntimeArgs,
} from '../src/downloader.js';
import {
  createTerminalInputDecoder,
  parseSgrMouseEvents,
  stripMouseSequences,
} from '../src/terminal-input.js';

const ADVANCED_ENV = [
  'YTCONV_AUDIO_FORMAT', 'YTCONV_AUDIO_QUALITY', 'YTCONV_VIDEO_FORMAT', 'YTCONV_RESOLUTION',
  'YTCONV_SUBTITLES', 'YTCONV_SUBTITLE_LANGS', 'YTCONV_WRITE_INFO_JSON',
  'YTCONV_WRITE_DESCRIPTION', 'YTCONV_WRITE_THUMBNAIL', 'YTCONV_CLIP_START',
  'YTCONV_CLIP_END', 'YTCONV_ARCHIVE', 'YTCONV_SPONSORBLOCK_MODE',
  'YTCONV_SPONSORBLOCK_CATEGORIES', 'YTCONV_NORMALIZE_AUDIO', 'YTCONV_KEEP_VIDEO',
  'YTCONV_OVERWRITE', 'YTCONV_RATE_LIMIT', 'YTCONV_CONCURRENT_FRAGMENTS',
  'YTCONV_PROXY', 'YTCONV_OUTPUT_TEMPLATE', 'YTCONV_RESTRICT_FILENAMES',
  'YTCONV_PLAYLIST_ITEMS', 'YTCONV_MAX_DOWNLOADS', 'YTCONV_LIVE_FROM_START',
];

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(ADVANCED_ENV.map((name) => [name, process.env[name]]));
  for (const name of ADVANCED_ENV) delete process.env[name];
  for (const [name, value] of Object.entries(values)) process.env[name] = value;
  try {
    return callback();
  } finally {
    for (const name of ADVANCED_ENV) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

function baseOptions(overrides = {}) {
  return {
    url: 'https://example.com/video',
    mode: 'video',
    resolution: 'best',
    videoFormat: 'auto',
    audioFormat: 'mp3',
    audioQuality: 'best',
    cookieConfig: { kind: 'none' },
    playlist: false,
    outputDirectory: '/tmp/output',
    ...overrides,
  };
}

test('Termux and desktop expose safe cookie sources', () => {
  assert.deepEqual(cookieSourcesForPlatform(true), ['auto', 'none', 'file']);
  const desktop = cookieSourcesForPlatform(false);
  assert.equal(desktop[0], 'auto');
  assert.ok(desktop.includes('chrome'));
  assert.ok(desktop.includes('firefox'));
});

test('cookie arguments support files and browsers', () => {
  assert.deepEqual(cookieArgs({ kind: 'file', path: '/tmp/cookies.txt' }), ['--cookies', '/tmp/cookies.txt']);
  assert.deepEqual(cookieArgs({ kind: 'browser', spec: 'chrome:Default' }), [
    '--cookies-from-browser', 'chrome:Default',
  ]);
});

test('video selectors prioritize compatible streams and retain fallbacks', () => {
  assert.match(formatVideoSelector('1080'), /\[height<=1080\]\[ext=mp4\]/u);
  assert.match(formatVideoSelector('720', 'webm'), /\[height<=720\]\[ext=webm\]\+ba\[ext=webm\]/u);
  assert.match(formatVideoSelector('720', 'webm'), /bv\*\[height<=720\]\+ba/u);
});

test('local JavaScript runtime requires the supported Node baseline', () => {
  assert.deepEqual(javascriptRuntimeArgs({ nodeVersion: '22.13.1', nodePath: '/node' }), []);
  assert.deepEqual(javascriptRuntimeArgs({ nodeVersion: '22.14.0', nodePath: '/node' }), ['--js-runtimes', 'node:/node']);
  assert.deepEqual(javascriptRuntimeArgs({ nodeVersion: '24.0.0', nodePath: '/node' }), ['--js-runtimes', 'node:/node']);
});

test('default download arguments include resilient extraction and safe files', () => {
  const args = withEnvironment({}, () => buildDownloadArgs(baseOptions({
    cookieConfig: { kind: 'file', path: '/tmp/cookies.txt' },
    ffmpegPath: '/tmp/ffmpeg',
  })));
  assert.ok(args.includes('--js-runtimes'));
  assert.ok(args.includes('--no-remote-components'));
  assert.ok(args.includes('--ignore-config'));
  assert.ok(args.includes('--no-colors'));
  assert.equal(args.includes('--remote-components'), false);
  assert.ok(args.includes('--check-formats'));
  assert.ok(args.includes('--no-overwrites'));
  assert.equal(args[args.indexOf('--concurrent-fragments') + 1], '4');
  assert.ok(args.includes('--cookies'));
  assert.ok(args.includes('mp4/mkv'));
  assert.equal(args.at(-1), 'https://example.com/video');
});

test('MP3 always keeps JPG thumbnail and embeds cover plus metadata', () => {
  const args = withEnvironment({}, () => buildDownloadArgs(baseOptions({
    url: 'https://www.youtube.com/watch?v=video-id', mode: 'audio',
  })));
  assert.ok(args.includes('--embed-metadata'));
  assert.ok(args.includes('--embed-chapters'));
  assert.ok(args.includes('--write-thumbnail'));
  assert.ok(args.includes('--embed-thumbnail'));
  assert.equal(args[args.indexOf('--convert-thumbnails') + 1], 'jpg');
});

test('YouTube Music crops artwork square and normalization is additive', () => {
  const args = withEnvironment({}, () => buildDownloadArgs(baseOptions({
    url: 'https://music.youtube.com/watch?v=music-id',
    mode: 'audio',
    normalizeAudio: true,
  })));
  const ppaValues = args.flatMap((value, index) => value === '--ppa' ? [args[index + 1]] : []);
  assert.ok(ppaValues.includes('ThumbnailsConvertor+ffmpeg_o:-vf crop=ih:ih'));
  assert.ok(ppaValues.includes('ExtractAudio+ffmpeg_o:-af loudnorm=I=-16:LRA=11:TP=-1.5'));
});

test('final video options add subtitles, SponsorBlock, sidecars, clipping and archive', () => {
  const args = withEnvironment({}, () => buildDownloadArgs(baseOptions({
    videoFormat: 'webm',
    resolution: '720',
    subtitles: true,
    subtitleLanguages: 'id,en',
    writeInfoJson: true,
    writeDescription: true,
    writeThumbnail: true,
    clipStart: '01:00',
    clipEnd: '02:30',
    archivePath: '/tmp/downloaded.txt',
    sponsorBlockMode: 'remove',
    sponsorBlockCategories: 'sponsor,selfpromo',
  })));
  assert.equal(args[args.indexOf('--merge-output-format') + 1], 'webm');
  assert.match(args[args.indexOf('-f') + 1], /height<=720/u);
  assert.ok(args.includes('--write-subs'));
  assert.ok(args.includes('--write-auto-subs'));
  assert.ok(args.includes('--embed-subs'));
  assert.equal(args[args.indexOf('--sub-langs') + 1], 'id,en');
  assert.ok(args.includes('--write-info-json'));
  assert.ok(args.includes('--write-description'));
  assert.ok(args.includes('--write-thumbnail'));
  assert.equal(args[args.indexOf('--download-sections') + 1], '*01:00-02:30');
  assert.equal(args[args.indexOf('--download-archive') + 1], '/tmp/downloaded.txt');
  assert.equal(args[args.indexOf('--sponsorblock-remove') + 1], 'sponsor,selfpromo');
});

test('performance, network, playlist and naming controls are passed safely', () => {
  const args = withEnvironment({}, () => buildDownloadArgs(baseOptions({
    overwrite: true,
    rateLimit: '2M',
    concurrentFragments: 8,
    proxy: 'socks5://127.0.0.1:1080',
    outputTemplate: '%(uploader)s/%(title)s.%(ext)s',
    restrictFilenames: true,
    playlist: true,
    playlistItems: '1,3,5-10',
    maxDownloads: 25,
    liveFromStart: true,
  })));
  assert.ok(args.includes('--force-overwrites'));
  assert.equal(args[args.indexOf('--limit-rate') + 1], '2M');
  assert.equal(args[args.indexOf('--concurrent-fragments') + 1], '8');
  assert.equal(args[args.indexOf('--proxy') + 1], 'socks5://127.0.0.1:1080');
  assert.match(args[args.indexOf('--output') + 1], /uploader.*title/u);
  assert.ok(args.includes('--restrict-filenames'));
  assert.equal(args[args.indexOf('--playlist-items') + 1], '1,3,5-10');
  assert.equal(args[args.indexOf('--max-downloads') + 1], '25');
  assert.ok(args.includes('--live-from-start'));
});

test('audio formats, keep-video and optional covers remain configurable', () => {
  const args = withEnvironment({}, () => buildDownloadArgs(baseOptions({
    url: 'https://soundcloud.com/example/song',
    mode: 'audio',
    audioFormat: 'flac',
    audioQuality: '320',
    writeThumbnail: true,
    keepVideo: true,
  })));
  assert.equal(args[args.indexOf('--audio-format') + 1], 'flac');
  assert.equal(args[args.indexOf('--audio-quality') + 1], '320K');
  assert.ok(args.includes('--write-thumbnail'));
  assert.ok(args.includes('--embed-thumbnail'));
  assert.ok(args.includes('--keep-video'));
});

test('utility commands build list-format and list-subtitle calls', () => {
  const formatArgs = withEnvironment({}, () => buildUtilityArgs({
    url: 'https://example.com/video', cookieConfig: { kind: 'none' }, kind: 'formats',
  }));
  const subArgs = withEnvironment({}, () => buildUtilityArgs({
    url: 'https://example.com/video', cookieConfig: { kind: 'none' }, kind: 'subs',
  }));
  assert.ok(formatArgs.includes('--list-formats'));
  assert.ok(subArgs.includes('--list-subs'));
  assert.equal(formatArgs.at(-1), 'https://example.com/video');
});

test('mouse escape sequences never become visible link text', () => {
  assert.equal(
    stripMouseSequences('\u001b[<0;62;19M\u001b[<0;62;19mhttps://example.com/video'),
    'https://example.com/video',
  );
  assert.equal(stripMouseSequences('[<2;61;19M[<2;61;19mhttps://example.com/video'), 'https://example.com/video');
});

test('streaming decoder and SGR parser preserve real link input', () => {
  const decoder = createTerminalInputDecoder();
  assert.deepEqual(decoder.feed('[<2;61'), { text: '', events: [] });
  assert.deepEqual(decoder.feed(';19Mhttps://example.com/video'), {
    text: 'https://example.com/video',
    events: [{ button: 2, x: 61, y: 19, pressed: true }],
  });
  assert.deepEqual(parseSgrMouseEvents('\u001b[<0;62;19M'), [
    { button: 0, x: 62, y: 19, pressed: true },
  ]);
});
