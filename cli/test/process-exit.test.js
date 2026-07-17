import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.join(directory, '..', 'bin', 'ytconv.js');
const source = fs.readFileSync(binPath, 'utf8');

test('CLI does not force process.exit while Windows async handles are closing', () => {
  assert.doesNotMatch(source, /process\.exit\s*\(/u);
  assert.match(source, /process\.exitCode\s*=\s*await main\(\)/u);
});
