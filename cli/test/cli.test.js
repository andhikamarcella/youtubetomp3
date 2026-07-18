import test from 'node:test';
import assert from 'node:assert/strict';
import { cookieArgs, cookieSourcesForPlatform } from '../src/cookies.js';
import { buildDownloadArgs, formatVideoSelector } from '../src/downloader.js';
import {
  createTerminalInputDecoder,
  parseSgrMouseEvents,
  stripMouseSequences,
} from '../src/terminal-input.js';

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

test('download arguments include retries, JS runtime, cookies and container fallback', () => {
  const args = buildDownloadArgs({
    url: 'https://example.com/video',
    mode: 'video',
    resolution: 'best',
    audioFormat: 'mp3',
    audioQuality: '0',
    cookieConfig: { kind: 'file', path: '/tmp/cookies.txt' },
    playlist: false,
    outputDirectory: '/tmp/output',
    ffmpegPath: '/tmp/ffmpeg',
  });

  assert.ok(args.includes('--js-runtimes'));
  assert.ok(args.includes('--remote-components'));
  assert.ok(args.includes('--check-formats'));
  assert.ok(args.includes('--cookies'));
  assert.ok(args.includes('mp4/mkv'));
  assert.equal(args.at(-1), 'https://example.com/video');
});

test('MP3 keeps a separate JPG thumbnail and embeds cover plus metadata', () => {
  const args = buildDownloadArgs({
    url: 'https://www.youtube.com/watch?v=video-id',
    mode: 'audio',
    resolution: 'best',
    audioFormat: 'mp3',
    audioQuality: '0',
    cookieConfig: { kind: 'none' },
    playlist: false,
    outputDirectory: '/tmp/output',
  });

  assert.ok(args.includes('--embed-metadata'));
  assert.ok(args.includes('--write-thumbnail'));
  assert.ok(args.includes('--embed-thumbnail'));
  assert.equal(args[args.indexOf('--convert-thumbnails') + 1], 'jpg');
  assert.equal(args.includes('--ppa'), false);
});

test('YouTube Music MP3 crops the saved and embedded cover to square', () => {
  const args = buildDownloadArgs({
    url: 'https://music.youtube.com/watch?v=music-id',
    mode: 'audio',
    resolution: 'best',
    audioFormat: 'mp3',
    audioQuality: '0',
    cookieConfig: { kind: 'none' },
    playlist: false,
    outputDirectory: '/tmp/output',
  });

  assert.equal(
    args[args.indexOf('--ppa') + 1],
    'ThumbnailsConvertor+ffmpeg_o:-vf crop=ih:ih',
  );
  assert.equal(args.at(-1), 'https://music.youtube.com/watch?v=music-id');
});

test('non-MP3 audio keeps the existing metadata-only behavior', () => {
  const args = buildDownloadArgs({
    url: 'https://music.youtube.com/watch?v=music-id',
    mode: 'audio',
    resolution: 'best',
    audioFormat: 'm4a',
    audioQuality: '0',
    cookieConfig: { kind: 'none' },
    playlist: false,
    outputDirectory: '/tmp/output',
  });

  assert.ok(args.includes('--embed-metadata'));
  assert.equal(args.includes('--write-thumbnail'), false);
  assert.equal(args.includes('--embed-thumbnail'), false);
  assert.equal(args.includes('--ppa'), false);
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
