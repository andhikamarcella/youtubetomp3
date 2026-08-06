import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(directory, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

test('YTConv stable is version 1.7.1 on the latest tag with provenance', () => {
  assert.equal(manifest.version, '1.7.1');
  assert.equal(manifest.publishConfig.tag, 'latest');
  assert.equal(manifest.publishConfig.provenance, true);
});

test('stable package includes identity social login installers iSH and documentation', () => {
  const required = [
    'bin/ytconv-auth.js', 'src/auth.js', 'src/social-auth.js', 'src/social-sessions.js',
    'src/branding.js', 'src/command-program.js', 'src/progress-ui.js',
    'src/defaults.js', 'src/gallery-routing.js', 'src/user-data.js', 'src/youtube-output.js',
    'src/verified-download.js', 'src/terminal-style.js', 'src/engine-storage.js',
    'ish/ytconv.py', 'ish/ytconv-core.py', 'ish/VERSION', 'ish/SHA256SUMS', 'scripts/install-ish.sh',
    'scripts/install-windows.ps1', 'scripts/install-windows.cmd',
    'scripts/install-termux.sh', 'scripts/install-unix.sh',
    'CHANGELOG.md', 'docs/PACKAGES.md', 'docs/NODEJS.md', 'docs/AUTH.md', 'docs/SECURITY.md',
    'docs/COMMANDS.md', 'docs/TROUBLESHOOTING.md', 'docs/INSTALL.md',
    'docs/SHELLS.md', 'docs/LINUX.md', 'docs/TERMUX.md', 'docs/ISH.md',
  ];
  for (const item of required) assert.equal(fs.existsSync(path.join(packageRoot, item)), true, item);
  assert.ok(manifest.files.includes('ish/VERSION'));
  assert.ok(manifest.files.includes('ish/*.py'));
  assert.ok(manifest.files.includes('ish/SHA256SUMS'));
  assert.ok(manifest.files.includes('docs/*.md'));
  assert.ok(manifest.files.includes('scripts/*.sh'));
  assert.ok(manifest.files.includes('scripts/*.cmd'));
  assert.ok(manifest.files.includes('scripts/*.ps1'));
});
