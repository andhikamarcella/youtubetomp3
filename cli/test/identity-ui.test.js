import assert from 'node:assert/strict';
import test from 'node:test';
import { renderBrand } from '../src/branding.js';
import { commanderHelpText } from '../src/command-program.js';
import { parseCliOptions } from '../src/cli-options.js';
import { progressPhase, spinnerFrame } from '../src/progress-ui.js';

test('1.6.8 restores a recognizable Figlet terminal identity', () => {
  const brand = renderBrand({ width: 120 });
  assert.ok(brand.split('\n').length >= 2);
  assert.match(brand, /[█╗╔╝╚]/u);
  assert.equal(renderBrand({ compact: true }), 'YTCONV · social media downloader');
  assert.equal(renderBrand({ tiny: true }), 'YTCONV');
});

test('Commander help documents social downloads and browser login', () => {
  const help = commanderHelpText('1.6.8');
  assert.match(help, /ytconv/u);
  assert.match(help, /social platforms/u);
  assert.match(help, /cookies-browser/u);
  assert.match(help, /subtitles \(off by default\)/iu);
});

test('subtitles remain disabled unless explicitly requested', () => {
  assert.equal(parseCliOptions([]).subtitles, false);
  assert.equal(parseCliOptions(['--subtitles']).subtitles, true);
});

test('animated progress distinguishes checking downloading and conversion', () => {
  assert.notEqual(spinnerFrame(0), spinnerFrame(1));
  assert.equal(progressPhase('probing', ''), 'Checking link');
  assert.equal(progressPhase('downloading', ''), 'Downloading');
  assert.equal(progressPhase('downloading', '[ExtractAudio] converting'), 'Converting');
});
