# YTConv – YouTube MP4 & MP3 Downloader CLI

[![npm version](https://img.shields.io/npm/v/ytconv.svg)](https://www.npmjs.com/package/ytconv)
[![Socket Badge](https://badge.socket.dev/npm/package/ytconv/1.6.4)](https://badge.socket.dev/npm/package/ytconv/1.6.4)
[![TypeScript declarations](https://img.shields.io/badge/types-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.npmjs.com/package/ytconv)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js 22.14+](https://img.shields.io/badge/Node.js-22.14%2B-339933?logo=node.js&logoColor=white)](docs/NODEJS.md)

**YTConv 1.6.4** is a secure, typed, CLI-only YouTube MP4/MP3 downloader and media converter for Windows, macOS, Linux, WSL, SSH, Android Termux, and iPhone/iPad through iSH. It uses yt-dlp for video/audio, gallery-dl for galleries and mixed posts, and FFmpeg for verified merging or conversion.

Search terms: **ytconv npm**, **YouTube downloader CLI**, **YouTube MP4 downloader**, **YouTube MP3 converter**, **yt-dlp frontend**, **Termux downloader**, and **typed Node.js media downloader**.

## What changed in 1.6.4

- Removed npm `preinstall`, `install`, and `postinstall` execution. Installing YTConv no longer downloads or executes media engines.
- Added real TypeScript declarations and a small side-effect-free programmatic API.
- Changed the package license to the canonical SPDX-recognized **ISC** license.
- Added stricter supply-chain tests for lifecycle scripts, shell execution, child environments, package contents, verified engine downloads, and public no-cookie YouTube arguments.
- Added a versioned Socket security badge and a detailed capability/security document.
- Kept automatic first-use engine repair, but only after the user starts YTConv; downloaded engines require HTTPS, allowlisted repositories, SHA-256 verification, size limits, private permissions, and atomic writes.
- Improved public YouTube MP4 recovery while keeping explicit user format choices authoritative.

## Install safely

The npm package requires Node.js 22.14.0 or newer and npm 10 or newer.

Windows CMD or PowerShell:

```cmd
node.exe --version
npm.cmd --version
npm.cmd install -g ytconv@latest --ignore-scripts
ytconv.cmd --version
ytconv.cmd doctor
```

Linux, macOS, WSL, SSH, and Termux:

```sh
node --version
npm --version
npm install -g ytconv@latest --ignore-scripts
ytconv --version
ytconv doctor
```

Expected version:

```text
1.6.4
```

The package itself performs no installation-time downloads. On first use, YTConv checks for usable local engines and visibly performs verified repair only when required. Manual repair remains available:

```sh
ytconv repair
```

## Public YouTube MP4 without cookies.txt

For an ordinary public YouTube video:

```sh
ytconv download "https://www.youtube.com/watch?v=VIDEO_ID"
```

AUTO mode resolves regular YouTube to video and defaults to MP4. YTConv prefers AVC/H.264 video plus M4A audio, retains broad stream fallbacks, and uses FFmpeg conversion when the available streams cannot be safely remuxed into MP4.

A public URL does not require a manually exported `cookies.txt`. Private, members-only, age-restricted, region-restricted, or account-only media can still require the official browser-login flow because YTConv does not bypass provider access controls.

```sh
ytconv login youtube
ytconv download "RESTRICTED_URL"
```

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

Choose audio format and quality:

```sh
ytconv download "URL" --mode audio --audio-format mp3 --audio-quality 320
ytconv download "URL" --mode audio --audio-format flac
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

YTConv remains a CLI first, but package consumers can import a small side-effect-free API with bundled declarations:

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

The TypeScript marker is backed by `types/index.d.ts`, package `types` metadata, conditional exports, and CI type-checking. It is not a decorative-only badge.

## Dependencies and dependents

Runtime dependencies are intentionally limited to packages required by the terminal UI, process discovery, and managed browser bridge. TypeScript and Node declarations are development-only dependencies used by CI and are not installed for production with `npm install --omit=dev`.

The npm **Dependents** count is registry data. It increases only when another published package legitimately lists `ytconv` as a dependency. YTConv does not create fake dependent packages or manipulate registry statistics.

A package can depend on the typed API with:

```sh
npm install ytconv
```

```json
{
  "dependencies": {
    "ytconv": "^1.6.4"
  }
}
```

## Supply-chain security

Socket and similar scanners correctly detect capabilities that are inherent to a media downloader: network access, filesystem output, environment-based configuration, and child-process execution for yt-dlp/gallery-dl/FFmpeg. YTConv reduces the risk around those capabilities instead of hiding them:

- no npm lifecycle install scripts;
- no `eval`, `Function`, `child_process.exec`, `shell: true`, or string-built shell commands;
- executables receive separate argument arrays;
- child environments remove npm/GitHub tokens and unrelated secrets;
- media-engine downloads are restricted to HTTPS and allowlisted GitHub repositories/assets;
- GitHub-provided SHA-256, declared size, hard size limits, timeouts, retries, and atomic replacement are required;
- YTConv state is stored under `~/.ytconv` with private permissions where supported;
- output writes are limited to the selected output directory;
- no telemetry, analytics, credential collection, or hidden remote configuration;
- npm releases use provenance, SBOM generation, registry tarball checksum verification, pinned GitHub Actions, and an immutable version/tag policy.

See [SECURITY.md](SECURITY.md) for the exact threat model and explanation of scanner findings.

## No false success

YTConv verifies paths reported by yt-dlp against the filesystem. Exit code zero is not accepted as success unless a real mode-matching output file exists.

When an archive contains a URL but the previous output was deleted, YTConv retries once without that archive entry. If no real file is produced, the command fails clearly.

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

On Windows:

```cmd
ytconv.cmd download "URL" --no-config --no-archive --mode video --video-format mp4
```

## Output folders

Desktop:

```text
~/Downloads/YTConv
```

Termux:

```text
~/storage/downloads/YTConv
```

iSH:

```text
~/Downloads/YTConv
```

## Documentation

- [Install Node.js first](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/NODEJS.md)
- [Complete installation](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/INSTALL.md)
- [Windows](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/WINDOWS.md)
- [Linux and macOS](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/LINUX.md)
- [Android Termux](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/TERMUX.md)
- [iPhone and iPad through iSH](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/ISH.md)
- [Commands and examples](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/COMMANDS.md)
- [Configuration and profiles](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/CONFIGURATION.md)
- [Dependencies](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/DEPENDENCIES.md)
- [Official browser login](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/AUTH.md)
- [Security model](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/SECURITY.md)
- [Shells and PATH](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/SHELLS.md)
- [Troubleshooting](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/TROUBLESHOOTING.md)
- [Publishing](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/PUBLISHING.md)
- [Release verification](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.4-security-types/cli/docs/RELEASE.md)

## License

YTConv 1.6.4 is distributed under the [ISC License](LICENSE).

Download only media that you are authorized to access and store.
