import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cliDirectory = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const releaseBranch = 'release/ytconv-1.6.4-security-types';
const docsBase = `https://github.com/andhikamarcella/youtubetomp3/blob/${releaseBranch}/cli/docs/`;
const releaseBase = `https://github.com/andhikamarcella/youtubetomp3/blob/${releaseBranch}/cli/`;

test('1.6.4 exposes complete secure typed package metadata', () => {
  assert.equal(manifest.version, '1.6.4');
  assert.equal(manifest.publisher, 'Andhika Marcella Fernanda');
  assert.match(manifest.author, /Andhika Marcella Fernanda/u);
  assert.equal(manifest.organization.name, 'YTConv Project');
  assert.equal(manifest.organization.url, 'https://github.com/andhikamarcella/youtubetomp3');
  assert.equal(manifest.license, 'ISC');
  assert.equal(manifest.releaseDate, '2026-08-04');
  assert.match(manifest.releaseNotes, /removes npm install-time execution/u);
  assert.match(manifest.releaseNotes, /TypeScript declaration/u);
  assert.match(manifest.releaseNotes, /public YouTube MP4/u);
  assert.equal(manifest.main, './src/index.js');
  assert.equal(manifest.types, './types/index.d.ts');
  assert.equal(manifest.exports['.'].types, './types/index.d.ts');
  assert.equal(manifest.exports['.'].import, './src/index.js');
  assert.equal(manifest.installer.type, 'Tarball');
  assert.equal(manifest.installer.url, 'https://registry.npmjs.org/ytconv/-/ytconv-1.6.4.tgz');
  assert.match(manifest.installer.sha256Url, /ytconv-v1\.6\.4\/SHA256SUMS\.txt$/u);
  assert.equal(manifest.documentation.url, `https://github.com/andhikamarcella/youtubetomp3/tree/${releaseBranch}/cli/docs`);
  assert.equal(manifest.documentation.nodejs, `${docsBase}NODEJS.md`);
  assert.equal(manifest.documentation.security, `${releaseBase}SECURITY.md`);
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['figlet', 'ink', 'react', 'which', 'ws']);
  assert.deepEqual(manifest.devDependencies, {
    '@types/node': '22.20.1',
    typescript: '5.9.3',
  });
  assert.equal(Object.values(manifest.dependencies).every((version) => /^\d+\.\d+\.\d+$/u.test(version)), true);
  assert.equal(Object.values(manifest.devDependencies).every((version) => /^\d+\.\d+\.\d+$/u.test(version)), true);
  assert.equal(manifest.publishConfig.provenance, true);
  assert.equal(manifest.engines.node, '>=22.14.0');
  assert.equal(manifest.optionalDependencies, undefined);
  assert.equal(manifest.scripts.preinstall, undefined);
  assert.equal(manifest.scripts.install, undefined);
  assert.equal(manifest.scripts.postinstall, undefined);
});

test('published package allowlist contains typed CLI and security assets only', () => {
  assert.deepEqual(manifest.files, [
    'bin/*.js', 'src/*.js', 'types/*.d.ts', 'scripts/*.js', 'scripts/*.sh',
    'scripts/*.cmd', 'scripts/*.ps1', 'ish/VERSION', 'ish/*.py', 'docs/*.md',
    'README.md', 'SECURITY.md', 'CHANGELOG.md', 'LICENSE',
  ]);
  assert.equal(
    manifest.files.some((entry) => /(?:html|css|jsx|tsx|next-app|public-ui|web)/iu.test(entry)),
    false,
  );
});

test('published README uses only absolute versioned release links', () => {
  assert.doesNotMatch(readme, /\]\((?:\.\/)?docs\//u);
  assert.doesNotMatch(readme, /\]\((?:\.\/)?(?:LICENSE|SECURITY\.md)\)/u);
  const links = [...readme.matchAll(/\]\((https:\/\/github\.com\/andhikamarcella\/youtubetomp3\/blob\/release\/ytconv-1\.6\.4-security-types\/cli\/docs\/([A-Z0-9-]+\.md)(?:#[^)]+)?)\)/gu)];
  assert.ok(links.length >= 14, 'the public README must expose the complete absolute documentation index');
  for (const [, url, fileName] of links) {
    assert.ok(url.startsWith(docsBase), `unexpected documentation branch in ${url}`);
    assert.equal(fs.existsSync(path.join(cliDirectory, 'docs', fileName)), true, `missing documentation target: ${fileName}`);
  }
  assert.match(readme, new RegExp(`${releaseBase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}SECURITY\\.md`, 'u'));
  assert.match(readme, new RegExp(`${releaseBase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}LICENSE`, 'u'));
});

test('npm test remains restricted to the YTConv CLI test directory', () => {
  assert.equal(manifest.scripts.test, 'node ./scripts/test-cli.js');
  assert.equal('express' in manifest.dependencies, false);
  assert.equal('express' in (manifest.devDependencies ?? {}), false);
  assert.equal(
    fs.existsSync(new URL('../../.github/workflows/ytconv-auth.yml', import.meta.url)),
    false,
    'the 1.6.4 release branch must not contain the web account-server workflow',
  );
});

test('published documentation is English-only', () => {
  const documentation = [
    readme,
    fs.readFileSync(new URL('../SECURITY.md', import.meta.url), 'utf8'),
    ...fs.readdirSync(new URL('../docs/', import.meta.url))
      .filter((name) => name.endsWith('.md'))
      .map((name) => fs.readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8')),
  ].join('\n');
  const Indonesian = /\b(?:akun|belum|berhasil|dapat|dengan|diperlukan|gagal|gunakan|halaman|hanya|jika|jalankan|masih|memakai|meminta|mencoba|mengunduh|menyimpan|otomatis|panduan|pembaruan|pengguna|penyimpanan|pilih|publik|resmi|selesai|sudah|tautkan|tidak|unduh|untuk)\b/iu;
  assert.doesNotMatch(documentation, Indonesian);
});
