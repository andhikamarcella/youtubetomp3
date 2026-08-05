import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cliDirectory = fileURLToPath(new URL('../', import.meta.url));
const repositoryDirectory = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const releaseBranch = 'release/ytconv-1.6.6-socket-hardening';
const docsBase = `https://github.com/andhikamarcella/youtubetomp3/blob/${releaseBranch}/cli/docs/`;
const releaseBase = `https://github.com/andhikamarcella/youtubetomp3/blob/${releaseBranch}/cli/`;

test('1.6.6 exposes complete secure typed multi-package metadata', () => {
  assert.equal(manifest.version, '1.6.6');
  assert.equal(manifest.publisher, 'Andhika Marcella Fernanda');
  assert.match(manifest.author, /Andhika Marcella Fernanda/u);
  assert.equal(manifest.organization.name, 'YTConv Project');
  assert.equal(manifest.organization.url, 'https://github.com/andhikamarcella/youtubetomp3');
  assert.equal(manifest.license, 'ISC');
  assert.equal(manifest.releaseDate, '2026-08-05');
  assert.match(manifest.releaseNotes, /Windows EXE/u);
  assert.match(manifest.releaseNotes, /Alpine APK/u);
  assert.match(manifest.releaseNotes, /Android packaging/u);
  assert.match(manifest.releaseNotes, /iSH and Alpine update paths/u);
  assert.equal(manifest.main, './src/index.js');
  assert.equal(manifest.types, './types/index.d.ts');
  assert.equal(manifest.exports['.'].types, './types/index.d.ts');
  assert.equal(manifest.exports['.'].import, './src/index.js');
  assert.equal(manifest.installer.type, 'Multi-format release');
  assert.equal(manifest.installer.npm, 'https://registry.npmjs.org/ytconv/-/ytconv-1.6.6.tgz');
  assert.equal(manifest.installer.release, 'https://github.com/andhikamarcella/youtubetomp3/releases/tag/ytconv-v1.6.6');
  assert.match(manifest.installer.sha256Url, /ytconv-v1\.6\.6\/SHA256SUMS\.txt$/u);
  assert.equal(manifest.documentation.url, `https://github.com/andhikamarcella/youtubetomp3/tree/${releaseBranch}/cli/docs`);
  assert.equal(manifest.documentation.nodejs, `${docsBase}NODEJS.md`);
  assert.equal(manifest.documentation.packages, `${docsBase}PACKAGES.md`);
  assert.equal(manifest.documentation.security, `${releaseBase}SECURITY.md`);
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['ink', 'react', 'ws']);
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

test('published npm allowlist contains typed CLI and verified iSH assets only', () => {
  assert.deepEqual(manifest.files, [
    'bin/*.js', 'src/*.js', 'types/*.d.ts', 'scripts/*.js', 'scripts/*.sh',
    'scripts/*.cmd', 'scripts/*.ps1', 'ish/VERSION', 'ish/*.py', 'ish/SHA256SUMS',
    'docs/*.md', 'README.md', 'SECURITY.md', 'CHANGELOG.md', 'LICENSE',
  ]);
  assert.equal(
    manifest.files.some((entry) => /(?:html|css|jsx|tsx|next-app|public-ui|web)/iu.test(entry)),
    false,
  );
});

test('native package sources cover Windows Linux Android Termux and iSH', () => {
  const required = [
    'packaging/build-windows-exe.ps1',
    'packaging/build-native-packages.sh',
    'packaging/build-alpine-apk.sh',
    'packaging/build-appimage.sh',
    'packaging/build-snap.sh',
    'packaging/build-flatpak.sh',
    'packaging/build-termux-deb.sh',
    'packaging/build-android-apk.sh',
    'packaging/nfpm.yaml',
    'packaging/alpine/APKBUILD',
    'packaging/flatpak/io.github.andhikamarcella.YTConv.yml',
    'packaging/snap/snap.yaml',
    'packaging/nix/ytconv.nix',
    'flake.nix',
    'android-app/app/build.gradle',
    'android-app/app/src/main/AndroidManifest.xml',
    'android-app/app/src/main/java/io/github/andhikamarcella/ytconv/MainActivity.java',
  ];
  for (const relative of required) {
    assert.equal(fs.existsSync(path.join(repositoryDirectory, relative)), true, `missing ${relative}`);
  }
  assert.equal(fs.readFileSync(new URL('../ish/VERSION', import.meta.url), 'utf8').trim(), '1.6.6');
  assert.match(fs.readFileSync(new URL('../scripts/install-ish.sh', import.meta.url), 'utf8'), /release\/ytconv-1\.6\.6-socket-hardening/u);
  assert.match(fs.readFileSync(new URL('../scripts/install-unix.sh', import.meta.url), 'utf8'), /VERSION="1\.6\.6"/u);
  assert.match(fs.readFileSync(new URL('../scripts/install-termux.sh', import.meta.url), 'utf8'), /VERSION="1\.6\.6"/u);
});

test('published README uses only absolute versioned release links', () => {
  assert.doesNotMatch(readme, /\]\((?:\.\/)?docs\//u);
  assert.doesNotMatch(readme, /\]\((?:\.\/)?(?:LICENSE|SECURITY\.md)\)/u);
  const links = [...readme.matchAll(/\]\((https:\/\/github\.com\/andhikamarcella\/youtubetomp3\/blob\/release\/ytconv-1\.6\.6-socket-hardening\/cli\/docs\/([A-Z0-9-]+\.md)(?:#[^)]+)?)\)/gu)];
  assert.ok(links.length >= 15, 'the public README must expose the complete absolute documentation index');
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
    'the 1.6.6 release branch must not contain the web account-server workflow',
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
