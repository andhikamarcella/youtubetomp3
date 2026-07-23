import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { applyBetaDefaults, betaDefaultsHelpText, extractBetaToggles } from '../src/beta-defaults.js';
import { parseCliOptions } from '../src/cli-options.js';

function parseWithDefaults(argv, homeDirectory = path.resolve('/tmp/ytconv-beta-home')) {
  const toggles = extractBetaToggles(argv);
  const options = parseCliOptions(toggles.cleanArgs);
  const created = [];
  applyBetaDefaults(options, toggles, {
    homeDirectory,
    mkdirSync(target) { created.push(target); },
  });
  return { options, toggles, created };
}

test('subtitles SponsorBlock mark and archives are enabled by default', () => {
  const { options } = parseWithDefaults([]);
  assert.equal(options.subtitles, true);
  assert.equal(options.sponsorBlockMode, 'mark');
  assert.match(options.archivePath, /\.ytconv[\\/]archives[\\/]yt-dlp-auto-balanced\.txt$/u);
  assert.match(options.galleryArchivePath, /gallery-dl-auto-balanced\.sqlite3$/u);
});

test('audio and video use separate automatic archive profiles', () => {
  const audio = parseWithDefaults(['--audio-format', 'mp3', '--audio-quality', '320']).options;
  const video = parseWithDefaults(['--video-format', 'mp4', '--resolution', '1080']).options;
  assert.match(audio.archivePath, /yt-dlp-audio-mp3-320\.txt$/u);
  assert.match(video.archivePath, /yt-dlp-video-mp4-1080\.txt$/u);
  assert.notEqual(audio.archivePath, video.archivePath);
});

test('explicit values remain authoritative', () => {
  const { options } = parseWithDefaults([
    '--sponsorblock', 'remove',
    '--archive', './custom.txt',
    '--subtitle-langs', 'id,en',
  ]);
  assert.equal(options.subtitles, true);
  assert.equal(options.subtitleLanguages, 'id,en');
  assert.equal(options.sponsorBlockMode, 'remove');
  assert.equal(options.archivePath, path.resolve('./custom.txt'));
  assert.equal(options.galleryArchivePath, `${path.resolve('./custom.txt')}.gallery.sqlite3`);
});

test('beginner opt-out flags are removed before parser and disable defaults', () => {
  const { options, toggles } = parseWithDefaults([
    '--no-subtitles', '--no-sponsorblock', '--no-archive', 'https://example.com/media',
  ]);
  assert.deepEqual(toggles.cleanArgs, ['https://example.com/media']);
  assert.equal(options.subtitles, false);
  assert.equal(options.sponsorBlockMode, 'off');
  assert.equal(options.archivePath, '');
  assert.equal(options.galleryArchivePath, '');
});

test('help explains safe always-on behavior and opt-out flags', () => {
  const text = betaDefaultsHelpText();
  assert.match(text, /subtitle\s+ON/u);
  assert.match(text, /SponsorBlock\s+ON mode mark/u);
  assert.match(text, /--no-subtitles/u);
  assert.match(text, /--no-sponsorblock/u);
  assert.match(text, /--no-archive/u);
  assert.match(text, /tidak memotong media/u);
});
