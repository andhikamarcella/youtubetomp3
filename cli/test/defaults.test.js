import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { applyStableDefaults, extractDefaultToggles, normalizeRetrySleep, stableDefaultsHelpText } from '../src/defaults.js';
import { parseCliOptions } from '../src/cli-options.js';

function parseWithDefaults(argv, homeDirectory = '/tmp/ytconv-defaults-home') {
  const toggles = extractDefaultToggles(argv);
  const options = parseCliOptions(toggles.cleanArgs);
  applyStableDefaults(options, toggles, { homeDirectory, mkdirSync() {} });
  return { options, toggles };
}

test('stable defaults enable subtitles SponsorBlock mark and per-profile archives', () => {
  const { options } = parseWithDefaults([]);
  assert.equal(options.subtitles, true);
  assert.equal(options.sponsorBlockMode, 'mark');
  assert.match(options.archivePath, /yt-dlp-auto-balanced\.txt$/u);
  assert.match(options.galleryArchivePath, /gallery-dl-auto-balanced\.sqlite3$/u);
});

test('retry sleep removes current legacy and nested type prefixes', () => {
  for (const value of [
    'linear=1::2',
    'http:linear=1::2',
    'fragment:linear=1::2',
    'fragment:http:linear=1::2',
    'file_access:fragment:http:linear=1::2',
  ]) {
    assert.equal(normalizeRetrySleep(value), 'linear=1::2');
  }
  const { options } = parseWithDefaults(['--retry-sleep', 'http:linear=1::2']);
  assert.equal(options.retrySleep, 'linear=1::2');
});

test('explicit values remain authoritative over stable defaults', () => {
  const { options } = parseWithDefaults([
    '--sponsorblock', 'remove',
    '--archive', './custom.txt',
    '--subtitle-langs', 'en,id',
  ]);
  assert.equal(options.subtitles, true);
  assert.equal(options.subtitleLanguages, 'en,id');
  assert.equal(options.sponsorBlockMode, 'remove');
  assert.equal(options.archivePath, path.resolve('./custom.txt'));
  assert.equal(options.galleryArchivePath, `${path.resolve('./custom.txt')}.gallery.sqlite3`);
});

test('negative flags disable every stable default before normal parsing', () => {
  const { options, toggles } = parseWithDefaults([
    '--no-subtitles', '--no-sponsorblock', '--no-archive', 'https://example.com/media',
  ]);
  assert.deepEqual(toggles.cleanArgs, ['https://example.com/media']);
  assert.equal(options.subtitles, false);
  assert.equal(options.sponsorBlockMode, 'off');
  assert.equal(options.archivePath, '');
  assert.equal(options.galleryArchivePath, '');
});

test('audio and video archives are separated by output profile', () => {
  const audio = parseWithDefaults(['--audio-format', 'mp3', '--audio-quality', '320']).options;
  const video = parseWithDefaults(['--video-format', 'mp4', '--resolution', '1080']).options;
  assert.match(audio.archivePath, /audio-mp3-320/u);
  assert.match(video.archivePath, /video-mp4-1080/u);
  assert.notEqual(audio.archivePath, video.archivePath);
});

test('stable help explains defaults and opt-out commands', () => {
  const text = stableDefaultsHelpText();
  assert.match(text, /subtitles\s+ON/u);
  assert.match(text, /SponsorBlock\s+ON/u);
  assert.match(text, /archive ON/u);
  assert.match(text, /--no-subtitles/u);
  assert.match(text, /--no-sponsorblock/u);
  assert.match(text, /--no-archive/u);
});
