import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isGalleryPreferredUrl } from '../src/gallery.js';
import { parseCliOptions } from '../src/cli-options.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(directory, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

test('YTConv public hotfix release is version 1.2.1', () => {
  assert.equal(manifest.version, '1.2.1');
});

test('release package includes complete docs and native iSH frontend', () => {
  assert.equal(fs.existsSync(path.join(packageRoot, 'ish', 'ytconv.py')), true);
  assert.equal(fs.existsSync(path.join(packageRoot, 'ish', 'VERSION')), true);
  assert.equal(fs.existsSync(path.join(packageRoot, 'scripts', 'install-ish.sh')), true);
  assert.equal(fs.existsSync(path.join(packageRoot, 'CHANGELOG.md')), true);
  assert.equal(fs.existsSync(path.join(packageRoot, 'docs', 'COMMANDS.md')), true);
  assert.equal(fs.existsSync(path.join(packageRoot, 'docs', 'TROUBLESHOOTING.md')), true);
  assert.ok(manifest.files.includes('ish'));
  assert.ok(manifest.files.includes('docs'));
});
