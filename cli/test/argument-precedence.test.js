import test from 'node:test';
import assert from 'node:assert/strict';
import { applyExplicitPrecedence } from '../src/argument-precedence.js';

test('explicit preset removes conflicting saved media settings but keeps saved output', () => {
  const explicit = ['--preset', 'hd', 'https://example.com/video'];
  const resolved = [
    '--output', '/tmp/out', '--preset', 'mobile', '--resolution', '720',
    '--subtitles', '--sponsorblock', 'mark', ...explicit,
  ];
  assert.deepEqual(applyExplicitPrecedence(resolved, explicit), [
    '--output', '/tmp/out', '--preset', 'hd', 'https://example.com/video',
  ]);
});

test('explicit negative flags override saved positive flags', () => {
  const explicit = ['--no-subtitles', '--no-archive', 'https://example.com/video'];
  const resolved = [
    '--subtitles', '--archive', '/tmp/archive.txt', ...explicit,
  ];
  assert.deepEqual(applyExplicitPrecedence(resolved, explicit), explicit);
});

test('unrelated saved settings remain available', () => {
  const explicit = ['--resolution', '1080', 'https://example.com/video'];
  const resolved = [
    '--output', '/tmp/out', '--resolution', '720', '--retries', '20', ...explicit,
  ];
  assert.deepEqual(applyExplicitPrecedence(resolved, explicit), [
    '--output', '/tmp/out', '--retries', '20', ...explicit,
  ]);
});
