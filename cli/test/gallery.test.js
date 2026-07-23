import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(directory, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

test('YTConv cross-shell release is version 1.2.3', () => {
  assert.equal(manifest.version, '1.2.3');
});

test('release package includes complete docs, installers, and native iSH frontend', () => {
  const required = [
    'ish/ytconv.py', 'ish/VERSION', 'scripts/install-ish.sh',
    'scripts/install-windows.ps1', 'scripts/install-windows.cmd',
    'scripts/install-termux.sh', 'scripts/install-unix.sh',
    'CHANGELOG.md', 'docs/COMMANDS.md', 'docs/TROUBLESHOOTING.md',
    'docs/INSTALL.md', 'docs/SHELLS.md',
  ];
  for (const item of required) assert.equal(fs.existsSync(path.join(packageRoot, item)), true, item);
  assert.ok(manifest.files.includes('ish'));
  assert.ok(manifest.files.includes('docs'));
  assert.ok(manifest.files.includes('scripts'));
});
