import test from 'node:test';
import assert from 'node:assert/strict';
import { cookieArgs, cookieSourcesForPlatform } from '../src/cookies.js';
import { buildDownloadArgs, formatVideoSelector } from '../src/downloader.js';
import {
  createTerminalInputDecoder,
  parseSgrMouseEvents,
  stripMouseSequences,
} from '../src/terminal-input.js';

const ADVANCED_ENV = [
  'YTCONV_AUDIO_FORMAT',
  'YTCONV_AUDIO_QUALITY',
  'YTCONV_VIDEO_FORMAT',
  'YTCONV_RESOLUTION',
  'YTCONV_SUBTITLES',
  'YTCONV_SUBTITLE_LANGS',
  'YTCONV_WRITE_INFO_JSON',
  'YTCONV_WRITE_DESCRIPTION',
  'YTCONV_WRITE_THUMBNAIL',
  'YTCONV_CLIP_START',
  'YTCONV_CLIP_END',
  'YTCONV_ARCHIVE',
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

test('Termux offers automatic public-first cookies, none, and cookies.txt', () => {
  assert.deepEqual(cookieSourcesForPlatform(true), ['auto', 'none', 'file']);
});

test('desktop offers automatic browser detection and manual sources', () => {
  const sources = cookieSourcesForPlatform(false);
  assert.equal(sources[0], 'auto');
  assert.ok(sources.includes('file'));
  assert.ok(sources.includes('chrome'));
  assert.ok(sources.includes('firefox'));
});

test('cookie arguments support Netscape files and browsers', () => {
  assert.deepEqual(cookieArgs({ kind: 'file', path: '/tmp/cookies.txt' }), [
    '--cookies',
    '/tmp/cookies.txt',
  ]);
  assert.deepEqual(cookieArgs({ kind: 'browser', spec: 'chrome:Default' }), [
    '--cookies-from-browser',
    'chrome:Default',
  ]);
});

test('video selector prioritizes compatible MP4 and keeps fallbacks', () => {
  const selector = formatVideoSelector('1080');
  assert.match(selector, /\[height<=1080\]\[ext=mp4\]/u);
  assert.match(selector, /bv\*\[height<=1080\]\+ba/u);
});

test('WEBM selector prioritizes WEBM streams', () => {
  const selector = formatVideoSelector('720', 'webm');
  assert.match(selector, /\[height<=720\]\[ext=webm\]\+ba\[ext=webm\]/u);
});

test('download arguments include retries, JS runtime, cookies and container fallback', () => {
  const args = withEnvironment({}, () => buildDownloadArgs({
    url: 'https://example.com/video',
    mode: 'video',
    resolution: 'best',
    audioFormat: 'mp3',
    audioQuality: '0',
    cookieConfig: { kind: 'file', path: '/tmp/cookies.txt' },
    playlist: false,
    outputDirectory: '/tmp/output',
    ffmpegPath: '/tmp/ffmpeg',
  }));

  assert.ok(args.includes('--js-runtimes'));
  assert.ok(args.includes('--remote-components'));
  assert.ok(args.includes('--check-formats'));
  assert.ok(args.includes('--cookies'));
  assert.ok(args.includes('mp4/mkv'));
  assert.equal(args.at(-1), 'https://example.com/video');
});

test('MP3 keeps a separate JPG thumbnail and embeds cover plus metadata', () => {
  const args = withEnvironment({}, () => buildDownloadArgs({
    url: 'https://www.youtube.com/watch?v=video-id',
    mode: 'audio',
    resolution: 'best',
    audioFormat: 'mp3',
    audioQuality: '0',
    cookieConfig: { kind: 'none' },
    playlist: false,
    outputDirectory: '/tmp/output',
  }));

  assert.ok(args.includes('--embed-metadata'));
  assert.ok(args.includes('--embed-chapters'));
  assert.ok(args.includes('--write-thumbnail'));
  assert.ok(args.includes('--embed-thumbnail'));
  assert.equal(args[args.indexOf('--convert-thumbnails') + 1], 'jpg');
  assert.equal(args.includes('--ppa'), false);
});

test('YouTube Music MP3 crops the saved and embedded cover to square', () => {
  const args = withEnvironment({}, () => buildDownloadArgs({
    url: 'https://music.youtube.com/watch?v=music-id',
    mode: 'audio',
    resolution: 'best',
    audioFormat: 'mp3',
    audioQuality: '0',
    cookieConfig: { kind: 'none' },
    playlist: false,
    outputDirectory: '/tmp/output',
  }));

  assert.equal(
    args[args.indexOf('--ppa') + 1],
    'ThumbnailsConvertor+ffmpeg_o:-vf crop=ih:ih',
  );
  assert.equal(args.at(-1), 'https://music.youtube.com/watch?v=music-id');
});

test('non-MP3 audio keeps metadata without forcing a thumbnail', () => {
  const args = withEnvironment({}, () => buildDownloadArgs({
    url: 'https://music.youtube.com/watch?v=music-id',
    mode: 'audio',
    resolution: 'best',
    audioFormat: 'm4a',
    audioQuality: '0',
    cookieConfig: { kind: 'none' },
    playlist: false,
    outputDirectory: '/tmp/output',
  }));

  assert.ok(args.includes('--embed-metadata'));
  assert.equal(args.includes('--write-thumbnail'), false);
  assert.equal(args.includes('--embed-thumbnail'), false);
  assert.equal(args.includes('--ppa'), false);
});

test('advanced video settings add subtitles, sidecars, clipping and archive', () => {
  const args = withEnvironment({
    YTCONV_VIDEO_FORMAT: 'webm',
    YTCONV_RESOLUTION: '720',
    YTCONV_SUBTITLES: '1',
    YTCONV_SUBTITLE_LANGS: 'id,en',
    YTCONV_WRITE_INFO_JSON: '1',
    YTCONV_WRITE_DESCRIPTION: '1',
    YTCONV_WRITE_THUMBNAIL: '1',
    YTCONV_CLIP_START: '01:00',
    YTCONV_CLIP_END: '02:30',
    YTCONV_ARCHIVE: '/tmp/downloaded.txt',
  }, () => buildDownloadArgs({
    url: 'https://example.com/video',
    mode: 'video',
    resolution: 'best',
    cookieConfig: { kind: 'none' },
    playlist: false,
    outputDirectory: '/tmp/output',
  }));

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
});

test('advanced audio settings support FLAC quality and optional cover', () => {
  const args = withEnvironment({
    YTCONV_AUDIO_FORMAT: 'flac',
    YTCONV_AUDIO_QUALITY: '320',
    YTCONV_WRITE_THUMBNAIL: '1',
  }, () => buildDownloadArgs({
    url: 'https://soundcloud.com/example/song',
    mode: 'audio',
    audioFormat: 'mp3',
    audioQuality: '0',
    cookieConfig: { kind: 'none' },
    playlist: false,
    outputDirectory: '/tmp/output',
  }));

  assert.equal(args[args.indexOf('--audio-format') + 1], 'flac');
  assert.equal(args[args.indexOf('--audio-quality') + 1], '320K');
  assert.ok(args.includes('--write-thumbnail'));
  assert.ok(args.includes('--embed-thumbnail'));
});

test('mouse escape sequences never become visible link text', () => {
  const brokenInput = '\u001b[<0;62;19M\u001b[<0;62;19mhttps://example.com/video';
  assert.equal(stripMouseSequences(brokenInput), 'https://example.com/video');
});

test('mouse sequences without ESC are also removed', () => {
  const brokenInput = '[<2;61;19M[<2;61;19mhttps://example.com/video';
  assert.equal(stripMouseSequences(brokenInput), 'https://example.com/video');
});

test('streaming decoder joins mouse sequences split across chunks', () => {
  const decoder = createTerminalInputDecoder();
  assert.deepEqual(decoder.feed('[<2;61'), { text: '', events: [] });
  assert.deepEqual(decoder.feed(';19Mhttps://example.com/video'), {
    text: 'https://example.com/video',
    events: [{ button: 2, x: 61, y: 19, pressed: true }],
  });
});

test('reported drag and click noise is fully discarded', () => {
  const decoder = createTerminalInputDecoder();
  const result = decoder.feed(
    '[<2;61;19M[<2;61;19m[<10;61;19M[<10;61;19m[<0;93;10Mhttps://example.com/video',
  );

  assert.equal(result.text, 'https://example.com/video');
  assert.equal(result.events.length, 5);
});

test('SGR mouse parser keeps button coordinates for clickable convert', () => {
  assert.deepEqual(parseSgrMouseEvents('\u001b[<0;62;19M'), [
    { button: 0, x: 62, y: 19, pressed: true },
  ]);
});
