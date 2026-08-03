import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const cliDirectory = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const releaseBranch = 'release/ytconv-1.6.3-cli-only-final';
const docsBase = `https://github.com/andhikamarcella/youtubetomp3/blob/${releaseBranch}/cli/docs/`;

test('1.6.3 exposes complete package-manager publisher output and documentation metadata', () => {
  assert.equal(manifest.version, '1.6.3');
  assert.equal(manifest.publisher, 'Andhika Marcella Fernanda');
  assert.match(manifest.author, /Andhika Marcella Fernanda/u);
  assert.equal(manifest.organization.name, 'YTConv Project');
  assert.equal(manifest.organization.url, 'https://github.com/andhikamarcella/youtubetomp3');
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.releaseDate, '2026-08-03');
  assert.match(manifest.releaseNotes, /invalid yt-dlp retry-sleep arguments/u);
  assert.match(manifest.releaseNotes, /saved profiles/u);
  assert.match(manifest.releaseNotes, /legacy configurations/u);
  assert.equal(manifest.installer.type, 'Tarball');
  assert.equal(manifest.installer.url, 'https://registry.npmjs.org/ytconv/-/ytconv-1.6.3.tgz');
  assert.match(manifest.installer.sha256Url, /ytconv-v1\.6\.3\/SHA256SUMS\.txt$/u);
  assert.equal(manifest.documentation.url, `https://github.com/andhikamarcella/youtubetomp3/tree/${releaseBranch}/cli/docs`);
  assert.equal(manifest.documentation.nodejs, `${docsBase}NODEJS.md`);
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['figlet', 'ink', 'react', 'which', 'ws']);
  assert.equal(Object.values(manifest.dependencies).every((version) => /^\d+\.\d+\.\d+$/u.test(version)), true);
  assert.equal(manifest.publishConfig.provenance, true);
  assert.equal(manifest.engines.node, '>=22.14.0');
  assert.equal(manifest.optionalDependencies, undefined);
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

test('published README uses only absolute versioned documentation links', () => {
  assert.doesNotMatch(readme, /\]\((?:\.\/)?docs\//u);
  const links = [...readme.matchAll(/\]\((https:\/\/github\.com\/andhikamarcella\/youtubetomp3\/blob\/release\/ytconv-1\.6\.3-cli-only-final\/cli\/docs\/([A-Z0-9-]+\.md)(?:#[^)]+)?)\)/gu)];
  assert.ok(links.length >= 15, 'the public README must expose the complete absolute documentation index');
  for (const [, url, fileName] of links) {
    assert.ok(url.startsWith(docsBase), `unexpected documentation branch in ${url}`);
    assert.equal(fs.existsSync(path.join(cliDirectory, 'docs', fileName)), true, `missing documentation target: ${fileName}`);
  }
  assert.equal(fs.existsSync(path.join(cliDirectory, 'docs', 'NODEJS.md')), true);
  assert.equal(fs.existsSync(path.join(cliDirectory, 'docs', 'ISH.md')), true);
});

test('npm test is restricted to the YTConv CLI test directory', () => {
  assert.equal(manifest.scripts.test, 'node ./scripts/test-cli.js');
  assert.equal('express' in manifest.dependencies, false);
  assert.equal('express' in (manifest.devDependencies ?? {}), false);
  assert.equal(
    fs.existsSync(new URL('../../.github/workflows/ytconv-auth.yml', import.meta.url)),
    false,
    'the 1.6.3 release branch must not contain the web account-server workflow',
  );
});

test('published documentation is English-only', () => {
  const documentation = [
    readme,
    ...fs.readdirSync(new URL('../docs/', import.meta.url))
      .filter((name) => name.endsWith('.md'))
      .map((name) => fs.readFileSync(new URL(`../docs/${name}`, import.meta.url), 'utf8')),
  ].join('\n');
  const Indonesian = /\b(?:akun|belum|berhasil|dapat|dengan|diperlukan|gagal|gunakan|halaman|hanya|jika|jalankan|masih|memakai|meminta|mencoba|mengunduh|menyimpan|otomatis|panduan|pembaruan|pengguna|penyimpanan|pilih|publik|resmi|selesai|sudah|tautkan|tidak|unduh|untuk)\b/iu;
  assert.doesNotMatch(documentation, Indonesian);
});
