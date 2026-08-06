import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(here, '..');
const repoRoot = path.resolve(cliRoot, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(cliRoot, 'package.json'), 'utf8'));
const readme = fs.readFileSync(path.join(cliRoot, 'README.md'), 'utf8');

function repoFile(...parts) {
  return path.join(repoRoot, ...parts);
}

test('1.7.1 exposes complete pinned identity and security metadata', () => {
  assert.equal(manifest.name, 'ytconv');
  assert.equal(manifest.version, '1.7.1');
  assert.equal(manifest.license, 'ISC');
  assert.equal(manifest.author.name, 'Andhika Marcella');
  assert.equal(manifest.publisher.name, 'Andhika Marcella');
  assert.equal(manifest.repository.url, 'git+https://github.com/andhikamarcella/YTConv.git');
  assert.equal(manifest.homepage, 'https://github.com/andhikamarcella/YTConv/tree/release/ytconv-1.7.1/cli#readme');
  assert.equal(manifest.bugs.url, 'https://github.com/andhikamarcella/YTConv/issues');
  assert.equal(manifest.releaseDate, '2026-08-06');
  assert.match(manifest.releaseNotes, /Figlet/u);
  assert.match(manifest.releaseNotes, /Commander/u);
  assert.match(manifest.releaseNotes, /subtitles off by default/iu);
  assert.equal(manifest.engines.node, '>=22.14.0');
  assert.equal(manifest.dependencies.commander, '14.0.2');
  assert.equal(manifest.dependencies.figlet, '1.10.0');
  assert.equal(manifest.dependencies.which, '6.0.0');
  assert.equal(manifest.dependencies.isexe, '4.0.0');
  assert.equal(manifest.scripts.preinstall, undefined);
  assert.equal(manifest.scripts.install, undefined);
  assert.equal(manifest.scripts.postinstall, undefined);
  assert.equal(manifest.security.noShellExecution, true);
  assert.equal(manifest.security.childProcessEnvironment, 'allowlisted-minimal');
});

test('published npm allowlist remains CLI only', () => {
  const files = manifest.files;
  assert.ok(files.includes('src'));
  assert.ok(files.includes('bin'));
  assert.ok(files.includes('docs'));
  assert.ok(files.includes('SECURITY.md'));
  assert.ok(!files.some((entry) => /web|next-app|android-app|packaging/iu.test(entry)));
});

test('native package sources cover desktop Linux Android Termux and iSH', () => {
  const required = [
    'packaging/build-native-packages.sh',
    'packaging/build-portable-archives.sh',
    'packaging/build-windows-exe.ps1',
    'packaging/build-android-apk.sh',
    'packaging/build-alpine-apk.sh',
    'packaging/build-flatpak.sh',
    'packaging/build-appimage.sh',
    'packaging/build-snap.sh',
    'packaging/build-termux-deb.sh',
    'packaging/nfpm/deb.yaml',
    'packaging/nfpm/rpm.yaml',
    'packaging/nfpm/arch.yaml',
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
  assert.match(gradle, /versionCode\s*=?\s*10701/u);
  assert.match(gradle, /versionName\s*=?\s*'1\.7\.1'/u);
  assert.match(activity, /© 2026 YTConv Project/u);
  assert.match(activity, /Browser login/u);
  assert.match(activity, /--cookies/u);
  assert.match(activity, /--no-write-subs/u);
  assert.match(activity, /Downloading/u);
  assert.match(activity, /Converting/u);
});

test('README presents the 1.7.1 identity and browser-login behavior', () => {
  assert.match(readme, /1\.7\.1/u);
  assert.match(readme, /Figlet/u);
  assert.match(readme, /browser login/iu);
  assert.match(readme, /subtitles.*off/iu);
});

test('npm test remains restricted to the YTConv CLI test directory', () => {
  assert.equal(manifest.scripts.test, 'node ./scripts/test-cli.js');
  const source = fs.readFileSync(path.join(cliRoot, 'scripts', 'test-cli.js'), 'utf8');
  assert.match(source, /test\/\*\.test\.js/u);
  assert.doesNotMatch(source, /\.\.\/server/u);
  assert.doesNotMatch(source, /\.\.\/test/u);
});

test('published documentation is English-only', () => {
  const documentationFiles = [
    'README.md',
    'CHANGELOG.md',
    'SECURITY.md',
    'docs/README.md',
    'docs/INSTALLATION.md',
    'docs/COMMANDS.md',
    'docs/CONFIGURATION.md',
    'docs/AUTHENTICATION.md',
    'docs/TROUBLESHOOTING.md',
    'docs/PLATFORMS.md',
    'docs/ARCHITECTURE.md',
    'docs/DEVELOPMENT.md',
    'docs/RELEASES.md',
    'docs/TRUSTED-PUBLISHING.md',
    'docs/FAQ.md',
    'docs/NODEJS.md',
    'docs/PACKAGES.md',
    'docs/MIGRATION-1.7.0.md',
    'docs/MIGRATION-1.7.1.md',
    'docs/HELP-CENTER.md',
  ];
  const forbidden = /\b(?:unduh|pengguna|gunakan|instalasi|perintah|buka|masuk|keluar|gagal|berhasil|bahasa|semua|cara|berkas|folder|perbaiki|jalankan)\b/iu;
  for (const relative of documentationFiles) {
    const content = fs.readFileSync(path.join(cliRoot, relative), 'utf8');
    assert.doesNotMatch(content, forbidden, `${relative} must remain English-only`);
  }
});
