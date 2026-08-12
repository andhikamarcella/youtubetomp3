import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCliOptions } from '../src/cli-options.js';
import { normalizeCommandArgs } from '../src/commands.js';
import { denoRuntimeSupported } from '../src/dependencies.js';

test('1.7.5 parses deterministic upscale targets', () => {
  assert.equal(parseCliOptions(['--upscale', '4k']).upscaleHeight, 2160);
  assert.equal(parseCliOptions(['--upscale', '2k']).upscaleHeight, 1440);
  assert.equal(parseCliOptions(['--upscale', 'off']).upscaleHeight, 0);
  assert.throws(() => parseCliOptions(['--upscale', '8k']), /must be one of/u);
});

test('1.7.5 exposes content and transcript aliases', () => {
  const url = 'https://example.com/media';
  assert.deepEqual(normalizeCommandArgs(['extract', url]), ['--subtitle-only', '--metadata-files', url]);
  assert.deepEqual(normalizeCommandArgs(['transcript', url]), ['--subtitle-only', url]);
});

test('1.7.5 accepts supported Deno and rejects older or malformed versions', () => {
  assert.equal(denoRuntimeSupported('deno 2.3.0'), true);
  assert.equal(denoRuntimeSupported('deno 2.9.5'), true);
  assert.equal(denoRuntimeSupported('deno 2.2.9'), false);
  assert.equal(denoRuntimeSupported('not installed'), false);
});
