import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'cli');
const oldBranch = 'release/ytconv-1.6.4-security-types';
const newBranch = 'release/ytconv-1.6.6-socket-hardening';

function updateFile(file) {
  let text = fs.readFileSync(file, 'utf8').replace(/\r\n/gu, '\n');
  text = text.replaceAll(oldBranch, newBranch);
  text = text.replaceAll('ytconv-v1.6.4', 'ytconv-v1.6.6');
  text = text.replaceAll('ytconv-1.6.4.tgz', 'ytconv-1.6.6.tgz');
  text = text.replaceAll('YTConv 1.6.4', 'YTConv 1.6.6');
  text = text.replaceAll('version 1.6.4', 'version 1.6.6');
  fs.writeFileSync(file, text);
}

for (const name of fs.readdirSync(path.join(cli, 'docs'))) {
  if (name.endsWith('.md')) updateFile(path.join(cli, 'docs', name));
}
updateFile(path.join(cli, 'SECURITY.md'));

const changelogPath = path.join(cli, 'CHANGELOG.md');
let changelog = fs.readFileSync(changelogPath, 'utf8').replace(/\r\n/gu, '\n');
if (!changelog.includes('## 1.6.6 — native packages and repaired iSH/Alpine updates')) {
  const entry = `## 1.6.6 — native packages and repaired iSH/Alpine updates\n\nReleased: 2026-08-04\n\n### Installable release artifacts\n\n- Added a user-level Windows EXE installer and portable ZIP with a verified bundled Node.js runtime.\n- Added DEB, RPM, Arch package, Alpine APK, AppImage, Snap, Flatpak, Nix, Homebrew, Void, Gentoo, Termux DEB, and portable Linux archives.\n- Added a native Android application with bundled Android-compatible yt-dlp and FFmpeg engines, real output verification, AUTO MP4/MP3 routing, progress, and cancellation.\n- Added per-artifact SHA-256 files, release-wide checksums, source archives, SBOM generation, and installation smoke tests.\n\n### iSH and Alpine\n\n- Fixed stale installer URLs that still pointed to the 1.6.2 release branch.\n- Synchronized wrapper, core, remote version, installer URL, and update channel to 1.6.6.\n- Added versioned SHA-256 verification before iSH/Alpine Python files are installed.\n- Removed the unnecessary Node.js dependency from the maintained Python frontend.\n- Added general, fragment, and file-access retry expressions plus resource-leak and real-file regression tests.\n\n### Security and licensing\n\n- Kept npm installation free of lifecycle install hooks.\n- Bundled official runtimes only after upstream checksum verification.\n- Kept the standalone CLI under ISC. The Android module is GPL-3.0-only because it links to GPL-3.0 youtubedl-android, with complete corresponding source included.\n\n`;
  changelog = changelog.replace('# YTConv CLI changelog\n', `# YTConv CLI changelog\n\n${entry}`);
}
fs.writeFileSync(changelogPath, changelog);
console.log('Synchronized YTConv 1.6.6 documentation and changelog.');
