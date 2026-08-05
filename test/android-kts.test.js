import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanProject } from '../src/scanner.js';
import { updateProjectVersion } from '../src/versioning.js';

test('preserves Kotlin Gradle assignment syntax', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shipforge-kts-'));
  await fs.writeFile(path.join(root, 'build.gradle.kts'), 'versionCode = 10000\nversionName = "1.0.0"\n');
  assert.equal((await scanProject(root))[0].version, '1.0.0');
  await updateProjectVersion(root, '1.6.7', { write: true });
  const content = await fs.readFile(path.join(root, 'build.gradle.kts'), 'utf8');
  assert.match(content, /versionName = "1\.6\.7"/u);
  assert.match(content, /versionCode = 10607/u);
});
