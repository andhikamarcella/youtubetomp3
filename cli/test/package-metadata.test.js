import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const cliDirectory = fileURLToPath(new URL('../', import.meta.url));
const repositoryDirectory = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const releaseBranch = 'release/ytconv-1.6.8-stable';

function repoFile(relative) {
  return path.join(repositoryDirectory, relative);
}

test('1.6.8 exposes complete pinned identity and security metadata', () => {
  assert.equal(manifest.version, '1.6.8');
  assert.equal(manifest.publisher, 'Andhika Marcella Fernanda');
  assert.equal(manifest.organization.name, 'YTConv Project');
  assert.equal(manifest.license, 'ISC');
  assert.equal(manifest.releaseDate, '2026-08-05');
  assert.match(manifest.releaseNotes, /Figlet/u);
  assert.match(manifest.releaseNotes, /Commander/u);
  assert.match(manifest.releaseNotes, /subtitles off by default/iu);
  assert.equal(manifest.main, './src/index.js');
  assert.equal(manifest.types, './types/index.d.ts');
  assert.equal(manifest.exports['.'].types, './types/index.d.ts');
  assert.equal(manifest.installer.npm, 'https://registry.npmjs.org/ytconv/-/ytconv-1.6.8.tgz');
  assert.equal(manifest.installer.release, 'https://github.com/andhikamarcella/youtubetomp3/releases/tag/ytconv-v1.6.8');
  assert.match(manifest.documentation.url, new RegExp(releaseBranch.replaceAll('.', '\\.'), 'u'));
  assert.deepEqual(manifest.dependencies, {
    commander: '14.0.3',
    figlet: '1.11.4',
    ink: '7.1.1',
    isexe: '3.1.5',
    react: '19.2.8',
    which: '6.0.0',
    ws: '8.21.1',
  });
  assert.equal(Object.values(manifest.dependencies).every((version) => /^\d+\.\d+\.\d+$/u.test(version)), true);
  assert.equal(manifest.publishConfig.provenance, true);
  assert.equal(manifest.engines.node, '>=22.14.0');
  assert.equal(manifest.scripts.preinstall, undefined);
  assert.equal(manifest.scripts.install, undefined);
  assert.equal(manifest.scripts.postinstall, undefined);
});

test('published npm allowlist remains CLI only', () => {
  assert.deepEqual(manifest.files, [
    'bin/*.js', 'src/*.js', 'types/*.d.ts', 'scripts/*.js', 'scripts/*.sh',
    'scripts/*.cmd', 'scripts/*.ps1', 'ish/VERSION', 'ish/*.py', 'ish/SHA256SUMS',
    'docs/*.md', 'README.md', 'SECURITY.md', 'CHANGELOG.md', 'LICENSE',
  ]);
  assert.equal(manifest.files.some((entry) => /(?:html|css|jsx|tsx|next-app|public-ui|web)/iu.test(entry)), false);
});

test('native package sources cover desktop Linux Android Termux and iSH', () => {
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
  for (const relative of required) assert.equal(fs.existsSync(repoFile(relative)), true, `missing ${relative}`);
});

test('Android package is current and keeps subtitles off by default', () => {
  const gradle = fs.readFileSync(repoFile('android-app/app/build.gradle'), 'utf8');
  const activity = fs.readFileSync(repoFile('android-app/app/src/main/java/io/github/andhikamarcella/ytconv/MainActivity.java'), 'utf8');
  assert.match(gradle, /versionCode 10608/u);
  assert.match(gradle, /versionName '1\.6\.8'/u);
  assert.match(activity, /© 2026 YTConv Project/u);
  assert.match(activity, /Browser login/u);
  assert.match(activity, /--cookies/u);
  assert.match(activity, /--no-write-subs/u);
  assert.match(activity, /Downloading/u);
  assert.match(activity, /Converting/u);
});

test('README presents the 1.6.8 identity and browser-login behavior', () => {
  assert.match(readme, /1\.6\.8/u);
  assert.match(readme, /Figlet/u);
  assert.match(readme, /browser login/iu);
  assert.match(readme, /subtitles.*off/iu);
});

test('npm test remains restricted to the YTConv CLI test directory', () => {
  assert.equal(manifest.scripts.test, 'node ./scripts/test-cli.js');
  assert.equal('express' in manifest.dependencies, false);
  assert.equal(fs.existsSync(new URL('../../.github/workflows/ytconv-auth.yml', import.meta.url)), false);
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
