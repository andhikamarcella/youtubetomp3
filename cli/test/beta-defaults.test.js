import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { applyBetaDefaults, betaDefaultsHelpText, extractBetaToggles } from '../src/beta-defaults.js';
import { parseCliOptions } from '../src/cli-options.js';

function parseWithDefaults(argv) {
  const toggles = extractBetaToggles(argv);
  const options = parseCliOptions(toggles.cleanArgs);
  applyBetaDefaults(options, toggles);
  return { options, toggles };
}

test('stable release keeps subtitles SponsorBlock and archive opt-in', () => {
  const { options } = parseWithDefaults([]);
  assert.equal(options.subtitles, false);
  assert.equal(options.sponsorBlockMode, 'off');
  assert.equal(options.archivePath, '');
  assert.equal(options.galleryArchivePath, undefined);
});

test('explicit stable values remain authoritative', () => {
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

test('negative compatibility flags are removed before normal parsing', () => {
  const { options, toggles } = parseWithDefaults([
    '--no-subtitles', '--no-sponsorblock', '--no-archive', 'https://example.com/media',
  ]);
  assert.deepEqual(toggles.cleanArgs, ['https://example.com/media']);
  assert.equal(options.subtitles, false);
  assert.equal(options.sponsorBlockMode, 'off');
  assert.equal(options.archivePath, '');
  assert.equal(options.galleryArchivePath, '');
});

test('stable help explains conservative defaults', () => {
  const text = betaDefaultsHelpText();
  assert.match(text, /subtitles\s+OFF/u);
  assert.match(text, /SponsorBlock\s+OFF/u);
  assert.match(text, /archive OFF/u);
  assert.match(text, /--subtitles/u);
  assert.match(text, /--sponsorblock/u);
  assert.match(text, /--archive/u);
});
