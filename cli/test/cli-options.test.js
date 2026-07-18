import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { helpText, parseCliOptions } from '../src/cli-options.js';

test('parses URL, platform, playlist, output and cookies options', () => {
  const options = parseCliOptions([
    '--platform',
    'facebook',
    '--playlist',
    '--output',
    './downloads',
    '--cookies',
    './cookies.txt',
    'https://www.facebook.com/reel/example',
  ]);

  assert.equal(options.initialPlatform, 'facebook');
  assert.equal(options.initialPlaylist, true);
  assert.equal(options.initialUrl, 'https://www.facebook.com/reel/example');
  assert.equal(options.outputDirectory, path.resolve('./downloads'));
  assert.equal(options.cookiesPath, path.resolve('./cookies.txt'));
});

test('defaults to automatic platform and parses image format', () => {
  const defaults = parseCliOptions([]);
  assert.equal(defaults.initialMode, 'auto');
  assert.equal(defaults.initialPlatform, 'auto');
  const options = parseCliOptions(['--platform', 'instagram', '--image-format', 'webp', 'https://instagram.com/p/example/']);
  assert.equal(options.initialPlatform, 'instagram');
  assert.equal(options.initialImageFormat, 'webp');
});

test('parses update controls', () => {
  assert.equal(parseCliOptions(['--check-update']).checkUpdate, true);
  assert.equal(parseCliOptions(['--update']).update, true);
  assert.equal(parseCliOptions(['--no-update-check']).noUpdateCheck, true);
});

test('rejects unknown options, invalid platforms and invalid image formats', () => {
  assert.throws(() => parseCliOptions(['--unknown']), /Opsi tidak dikenal/u);
  assert.throws(() => parseCliOptions(['--output']), /membutuhkan nilai/u);
  assert.throws(() => parseCliOptions(['--platform', 'myspace']), /tidak dikenali/u);
  assert.throws(() => parseCliOptions(['--image-format', 'gif']), /original, jpg, png, atau webp/u);
});

test('help is platform-first and keeps advanced compatibility flags', () => {
  const text = helpText();
  assert.match(text, /--platform instagram/u);
  assert.match(text, /--platform facebook/u);
  assert.match(text, /--platform tiktok/u);
  assert.match(text, /--diagnose/u);
  assert.match(text, /--check-update/u);
  assert.match(text, /--image-format/u);
  assert.match(text, /--audio/u);
});
