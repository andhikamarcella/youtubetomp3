import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('1.5.5 exposes complete package-manager metadata', () => {
  assert.equal(manifest.version, '1.5.5');
  assert.equal(manifest.publisher, 'Andhika Marcella Fernanda');
  assert.match(manifest.author, /Andhika Marcella Fernanda/u);
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.releaseDate, '2026-08-02');
  assert.match(manifest.releaseNotes, /local CLI fallback/u);
  assert.equal(manifest.installer.type, 'Tarball');
  assert.equal(manifest.installer.url, 'https://registry.npmjs.org/ytconv/-/ytconv-1.5.5.tgz');
  assert.match(manifest.installer.sha256Url, /SHA256SUMS\.txt$/u);
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['figlet', 'ink', 'react', 'which']);
});

test('published package allowlist contains CLI assets only', () => {
  assert.deepEqual(manifest.files, [
    'bin/*.js', 'src/*.js', 'scripts/*.js', 'scripts/*.sh', 'scripts/*.cmd',
    'scripts/*.ps1', 'ish/VERSION', 'ish/*.py', 'docs/*.md', 'README.md',
    'CHANGELOG.md', 'LICENSE',
  ]);
  assert.equal(
    manifest.files.some((entry) => /(?:html|css|jsx|tsx|next-app|public-ui|web)/iu.test(entry)),
    false,
  );
});

test('npm test is restricted to the YTConv CLI test directory', () => {
  assert.equal(manifest.scripts.test, 'node ./scripts/test-cli.js');
  assert.equal('express' in manifest.dependencies, false);
  assert.equal('express' in (manifest.devDependencies ?? {}), false);
  assert.equal(
    fs.existsSync(new URL('../../.github/workflows/ytconv-auth.yml', import.meta.url)),
    false,
    'the 1.5.5 release branch must not contain the web account-server workflow',
  );
});
