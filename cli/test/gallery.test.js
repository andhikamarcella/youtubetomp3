import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(directory, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

test('YTConv prerelease is version 1.6.0-beta.1 on the beta tag', () => {
  assert.equal(manifest.version, '1.6.0-beta.1');
  assert.equal(manifest.publishConfig.tag, 'beta');
});

test('beta package includes account device features docs installers and iSH frontend', () => {
  const required = [
    'bin/ytconv-auth.js', 'src/auth.js', 'src/beta-defaults.js', 'src/gallery-beta.js', 'src/user-data.js',
    'ish/ytconv.py', 'ish/ytconv-beta.py', 'ish/VERSION', 'scripts/install-ish.sh',
    'scripts/install-windows.ps1', 'scripts/install-windows.cmd',
    'scripts/install-termux.sh', 'scripts/install-unix.sh',
    'CHANGELOG.md', 'docs/AUTH.md', 'docs/BETA.md', 'docs/BETA-1.6.md',
    'docs/COMMANDS.md', 'docs/TROUBLESHOOTING.md', 'docs/INSTALL.md', 'docs/SHELLS.md', 'docs/LINUX.md',
  ];
  for (const item of required) assert.equal(fs.existsSync(path.join(packageRoot, item)), true, item);
  assert.ok(manifest.files.includes('ish'));
  assert.ok(manifest.files.includes('docs'));
  assert.ok(manifest.files.includes('scripts'));
});
