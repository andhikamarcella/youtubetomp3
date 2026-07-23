import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCommandArgs } from '../src/commands.js';

test('normalizes beginner download and playlist commands', () => {
  assert.deepEqual(normalizeCommandArgs(['download', 'https://example.com/a']), ['https://example.com/a']);
  assert.deepEqual(normalizeCommandArgs(['playlist', 'https://example.com/list']), ['--playlist', 'https://example.com/list']);
});

test('normalizes batch with safe continue-on-error default', () => {
  assert.deepEqual(normalizeCommandArgs(['batch', 'links.txt', '--jobs', '2']), [
    '--batch-file', 'links.txt', '--continue-on-error', '--jobs', '2',
  ]);
});

test('normalizes information, format JSON, doctor, repair, and clean commands', () => {
  assert.deepEqual(normalizeCommandArgs(['info', 'https://example.com/a', '--json']), [
    '--dry-run', 'https://example.com/a', '--json',
  ]);
  assert.deepEqual(normalizeCommandArgs(['formats', 'https://example.com/a', '--json']), [
    '--formats-json', 'https://example.com/a',
  ]);
  assert.deepEqual(normalizeCommandArgs(['doctor']), ['--doctor']);
  assert.deepEqual(normalizeCommandArgs(['repair']), ['--repair']);
  assert.deepEqual(normalizeCommandArgs(['clean']), ['--clear-cache']);
});

test('keeps legacy URL-first and option-first syntax unchanged', () => {
  assert.deepEqual(normalizeCommandArgs(['https://example.com/a', '--audio']), ['https://example.com/a', '--audio']);
  assert.deepEqual(normalizeCommandArgs(['--audio', 'https://example.com/a']), ['--audio', 'https://example.com/a']);
});
