import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanProject } from '../src/scanner.js';
import { updateProjectVersion } from '../src/versioning.js';

test('scans and synchronizes npm, Android, Snap, and Alpine versions', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'shipforge-'));
  await fs.mkdir(path.join(root, 'android'), { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), '{"name":"demo","version":"1.0.0"}\n');
  await fs.writeFile(path.join(root, 'package-lock.json'), '{"name":"demo","version":"1.0.0","lockfileVersion":3,"packages":{"":{"name":"demo","version":"1.0.0"}}}\n');
  await fs.writeFile(path.join(root, 'android', 'build.gradle'), 'versionCode 10000\nversionName "1.0.0"\n');
  await fs.writeFile(path.join(root, 'snapcraft.yaml'), 'name: demo\nversion: 1.0.0\n');
  await fs.writeFile(path.join(root, 'APKBUILD'), 'pkgname=demo\npkgver=1.0.0\n');

  assert.equal((await scanProject(root)).length, 5);
  const preview = await updateProjectVersion(root, '1.6.7');
  assert.equal(preview.length, 5);
  assert.match(await fs.readFile(path.join(root, 'package.json'), 'utf8'), /1\.0\.0/u);

  await updateProjectVersion(root, '1.6.7', { write: true });
  const versions = [...new Set((await scanProject(root)).map((entry) => entry.version))];
  assert.deepEqual(versions, ['1.6.7']);
  assert.match(await fs.readFile(path.join(root, 'android', 'build.gradle'), 'utf8'), /versionCode 10607/u);
});
