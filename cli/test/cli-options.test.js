import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { helpText, parseCliOptions } from '../src/cli-options.js';

test('parses URL, audio, playlist, output and cookies options', () => {
  const options = parseCliOptions([
    '--audio',
    '--playlist',
    '--output',
    './downloads',
    '--cookies',
    './cookies.txt',
    'https://example.com/video',
  ]);

  assert.equal(options.initialMode, 'audio');
  assert.equal(options.initialPlaylist, true);
  assert.equal(options.initialUrl, 'https://example.com/video');
  assert.equal(options.outputDirectory, path.resolve('./downloads'));
  assert.equal(options.cookiesPath, path.resolve('./cookies.txt'));
});

test('rejects unknown options and missing values', () => {
  assert.throws(() => parseCliOptions(['--unknown']), /Opsi tidak dikenal/u);
  assert.throws(() => parseCliOptions(['--output']), /membutuhkan nilai/u);
});

test('help includes diagnose and custom output examples', () => {
  const text = helpText();
  assert.match(text, /--diagnose/u);
  assert.match(text, /--output/u);
  assert.match(text, /--audio/u);
});
