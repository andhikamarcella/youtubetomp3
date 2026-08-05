# YTConv – YouTube MP4 & MP3 Downloader CLI

[![npm version](https://img.shields.io/npm/v/ytconv.svg)](https://www.npmjs.com/package/ytconv)
[![Socket Badge](https://badge.socket.dev/npm/package/ytconv/1.6.6)](https://badge.socket.dev/npm/package/ytconv/1.6.6)
[![TypeScript declarations](https://img.shields.io/badge/types-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.npmjs.com/package/ytconv)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/LICENSE)
[![Node.js 22.14+](https://img.shields.io/badge/Node.js-22.14%2B-339933?logo=node.js&logoColor=white)](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/NODEJS.md)

**YTConv 1.6.6** is a secure, typed media downloader for Windows, macOS, Linux, Android, Termux, iSH, WSL, and SSH. It provides npm installation plus native Windows EXE, Android APK, DEB, RPM, Arch, Alpine APK, AppImage, Snap, Flatpak, Nix, Homebrew, Termux, and portable Linux packages.

Search terms: **ytconv npm**, **YouTube downloader CLI**, **YouTube MP4 downloader**, **YouTube MP3 converter**, **YTConv EXE**, **YTConv APK**, **apt install ytconv**, **dnf install ytconv**, **yt-dlp frontend**, and **Termux downloader**.

## What changed in 1.6.6

- Added an installable Windows EXE and portable ZIP with a verified bundled Node.js runtime.
- Added native DEB, RPM, Arch Linux, Alpine APK, AppImage, Snap, Flatpak, Nix, Homebrew, Void, Gentoo, and universal Linux packaging.
- Added a native Android application that uses Android-compatible yt-dlp and FFmpeg engines; it is not a WebView.
- Added a Termux-native DEB with verified bundled Python modules.
- Fixed stale iSH and Alpine installer links that still pointed at 1.6.2 in earlier releases.
- Added versioned SHA-256 verification before iSH/Alpine Python files are installed or updated.
- Removed the unnecessary Node.js requirement from the maintained iSH/Alpine Python frontend.
- Kept npm installation free of `preinstall`, `install`, and `postinstall` hooks.
- Preserved public YouTube AUTO routing: regular YouTube → MP4, YouTube Music → MP3.

## Choose an installation method

Complete beginner instructions for every artifact are in the [native package guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/PACKAGES.md).

### Windows EXE

Download:

```text
YTConv-1.6.6-Setup-x64.exe
```

The user-level installer includes Node.js and does not require administrator access. Verify the release SHA-256 first. The first community build is not Authenticode-signed, so Windows SmartScreen may identify it as an unknown publisher.

After installation:

```cmd
ytconv --version
ytconv doctor
```

### Debian, Ubuntu, and Linux Mint

```sh
sudo apt install ./ytconv_1.6.6_amd64.deb
ytconv --version
```

ARM64 systems use `ytconv_1.6.6_arm64.deb`.

### Fedora, RHEL, Rocky Linux, AlmaLinux, and openSUSE

```sh
sudo dnf install ./ytconv-1.6.6-1.x86_64.rpm
```

openSUSE:

```sh
sudo zypper install ./ytconv-1.6.6-1.x86_64.rpm
```

### Arch Linux, Manjaro, EndeavourOS, and CachyOS

```sh
sudo pacman -U ./ytconv-1.6.6-1-x86_64.pkg.tar.zst
```

### Alpine Linux

```sh
sudo apk add --allow-untrusted ./ytconv-1.6.6-r0.apk
ytconv --version
ytconv --diagnose
```

The Alpine package uses the maintained Python frontend and does not require Node.js.

### Android APK

Download and install:

```text
YTConv-1.6.6-debug.apk
```

The app saves media to `Download/YTConv`. The release also contains an unsigned release APK and complete Android source. The Android module is GPL-3.0-only because it links to GPL-3.0 youtubedl-android; the standalone CLI remains ISC licensed.

### Termux

```sh
pkg install -y ./ytconv_1.6.6_all-termux.deb
termux-setup-storage
ytconv --version
```

### iSH on iPhone and iPad

```sh
apk update
apk add --no-cache curl ca-certificates
curl -fsSL \
  https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/release/ytconv-1.6.6-socket-hardening/cli/scripts/install-ish.sh \
  -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
```

The installer checks both Python files against `ish/SHA256SUMS` before replacing the installed frontend. Future updates use:

```sh
ytconv update
```

### npm

Node.js 22.14.0 or newer and npm 10 or newer are required:

```sh
npm install -g ytconv@latest --ignore-scripts
ytconv --version
ytconv doctor
```

Expected version after 1.6.6 is published:

```text
1.6.6
```

## Public YouTube MP4 without cookies.txt

For an ordinary public YouTube video:

```sh
ytconv download "https://www.youtube.com/watch?v=VIDEO_ID"
```

AUTO mode resolves regular YouTube to video and defaults to MP4. YTConv prefers AVC/H.264 video plus M4A audio, retains broad stream fallbacks, and uses FFmpeg conversion when the available streams cannot be safely remuxed into MP4.

A public URL does not require a manually exported `cookies.txt`. Private, members-only, age-restricted, region-restricted, or account-only media can still require the official browser-login flow because YTConv does not bypass provider access controls.

## YouTube output policy

When mode is AUTO:

- `music.youtube.com` becomes audio and defaults to MP3.
- `youtube.com`, `youtu.be`, and `youtube-nocookie.com` become video and default to MP4.
- Other platforms keep platform-aware routing.

Explicit choices always win:

```sh
ytconv download "YOUTUBE_URL" --mode audio --audio-format mp3
ytconv download "YOUTUBE_MUSIC_URL" --mode video --video-format mp4
ytconv download "YOUTUBE_URL" --mode video --video-format mkv
ytconv download "YOUTUBE_URL" --mode video --video-format webm
```

## Beginner examples

YouTube Music to MP3:

```sh
ytconv download "https://music.youtube.com/watch?v=MUSIC_ID"
```

Choose video quality and container:

```sh
ytconv download "YOUTUBE_URL" --mode video --resolution 1080 --video-format mp4
ytconv download "YOUTUBE_URL" --mode video --resolution 720 --video-format mkv
```

Playlist and batch:

```sh
ytconv playlist "PLAYLIST_URL" --playlist-items 1-10
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

Inspect without downloading:

```sh
ytconv formats "URL"
ytconv info "URL" --json
```

## Typed programmatic API

YTConv remains CLI-first, but package consumers can import a small side-effect-free JavaScript API with bundled TypeScript declarations:

```ts
import {
  effectiveVideoContainer,
  formatVideoSelector,
  normalizeRetrySleep,
  videoContainerArgs,
} from 'ytconv';

const container = effectiveVideoContainer({
  url: 'https://www.youtube.com/watch?v=VIDEO_ID',
  mode: 'video',
  requestedContainer: 'auto',
});

const selector = formatVideoSelector('1080', container);
const args = videoContainerArgs(container);
const retry = normalizeRetrySleep('fragment:http:linear=1::2');
```

Another published npm package can legitimately count as a YTConv dependent by declaring:

```json
{
  "dependencies": {
    "ytconv": "^1.6.6"
  }
}
```

Global CLI installations count as downloads, not npm Dependents.

## Supply-chain security

YTConv does not hide the network, filesystem, environment, and child-process capabilities required by a local media downloader. It restricts them:

- no npm lifecycle install hooks;
- no `eval`, `Function`, `child_process.exec`, `shell: true`, or string-built shell commands;
- executable and argument arrays remain separate;
- child environments remove npm, GitHub, cloud, authorization, cookie, credential, password, session, key, and token values;
- downloaded engines require HTTPS, allowlisted repositories/assets, SHA-256, size limits, retries, timeouts, private permissions, and atomic replacement;
- no telemetry, analytics, advertisements, credential collection, or hidden remote configuration;
- release artifacts include checksums, SBOM, provenance where supported, immutable source tags, and package installation smoke tests.

See [SECURITY.md](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/SECURITY.md) for the threat model.

## No false success

YTConv verifies files reported by yt-dlp against the filesystem. Exit code zero is not accepted as success unless a real mode-matching output exists. If an archive contains a URL but its prior file was deleted, YTConv retries once without the archive and still requires a real file.

## Troubleshooting

```sh
ytconv doctor
ytconv repair
ytconv --self-test
ytconv --shell-info
```

Retry without saved profiles and archives:

```sh
ytconv download "URL" --no-config --no-archive --mode video --video-format mp4
```

## Output folders

Desktop and iSH:

```text
~/Downloads/YTConv
```

Termux:

```text
~/storage/downloads/YTConv
```

Android APK:

```text
Download/YTConv
```

## Documentation

- [Native packages and installers](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/PACKAGES.md)
- [Install Node.js first](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/NODEJS.md)
- [Complete installation](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/INSTALL.md)
- [Windows](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/WINDOWS.md)
- [Linux and macOS](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/LINUX.md)
- [Platforms](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/PLATFORMS.md)
- [Android Termux](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/TERMUX.md)
- [iPhone and iPad through iSH](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/ISH.md)
- [Commands and examples](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/COMMANDS.md)
- [Configuration and profiles](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/CONFIGURATION.md)
- [Dependencies](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/DEPENDENCIES.md)
- [Official browser login](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/AUTH.md)
- [Security model](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/SECURITY.md)
- [Shells and PATH](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/SHELLS.md)
- [Troubleshooting](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/TROUBLESHOOTING.md)
- [Publishing](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/PUBLISHING.md)
- [Release verification](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/docs/RELEASE.md)

## License

The standalone YTConv CLI and npm package are distributed under the [ISC License](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.6-socket-hardening/cli/LICENSE). The Android application module is GPL-3.0-only because of its linked GPL Android media engine; its complete corresponding source is included in the repository and release.

Download only media that you are authorized to access and store.
