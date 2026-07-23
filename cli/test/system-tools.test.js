import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSystemOptions, systemHelpText } from '../src/system-tools.js';
import { explainError } from '../src/error-help.js';

test('extracts beginner and headless flags before normal CLI parsing', () => {
  const result = extractSystemOptions([
    '--headless', '--batch-file', 'links.txt', '--continue-on-error',
    '--open-output', '--preset', 'music', 'https://example.com/a',
  ]);
  assert.equal(result.system.headless, true);
  assert.equal(result.system.batchFile, 'links.txt');
  assert.equal(result.system.continueOnError, true);
  assert.equal(result.system.openOutput, true);
  assert.deepEqual(result.cleanArgs, ['--preset', 'music', 'https://example.com/a']);
});

test('doctor alias is translated before the normal parser', () => {
  const result = extractSystemOptions(['--doctor']);
  assert.deepEqual(result.cleanArgs, ['--diagnose']);
});

test('system help documents repair, headless, batch jobs, and JSON reports', () => {
  const value = systemHelpText();
  assert.match(value, /--repair/u);
  assert.match(value, /--shell-info/u);
  assert.match(value, /--headless/u);
  assert.match(value, /--batch-file/u);
  assert.match(value, /--jobs/u);
  assert.match(value, /--result-json/u);
});

test('error explanation gives actionable PowerShell, cookie, and update guidance', () => {
  assert.match(explainError(new Error('spawnSync npm.cmd EINVAL')), /1\.3\.0/u);
  assert.match(explainError(new Error('running scripts is disabled on this system')), /ytconv\.cmd/u);
  assert.match(explainError(new Error('cookie database is locked')), /cookies-from-browser/u);
});
