import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generateChecksums } from '../src/checksums.js';

test('creates stable SHA-256 manifest', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shipforge-assets-'));
  await fs.writeFile(path.join(root, 'a.txt'), 'alpha');
  await fs.writeFile(path.join(root, 'b.txt'), 'beta');
  const result = await generateChecksums(root);
  assert.equal(result.count, 2);
  const manifest = await fs.readFile(result.outputPath, 'utf8');
  assert.match(manifest, /a\.txt/u);
  assert.match(manifest, /b\.txt/u);
});
