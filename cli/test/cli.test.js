import test from 'node:test';
import assert from 'node:assert/strict';
import { cookieArgs, cookieSourcesForPlatform } from '../src/cookies.js';
import { buildDownloadArgs, formatVideoSelector } from '../src/downloader.js';

test('Termux only offers none and cookies.txt authentication', () => {
  assert.deepEqual(cookieSourcesForPlatform(true), ['none', 'file']);
});

test('desktop offers browser and file cookie sources', () => {
  const sources = cookieSourcesForPlatform(false);
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
