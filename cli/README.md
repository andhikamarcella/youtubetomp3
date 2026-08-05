# YTConv – Social Media Downloader and Converter CLI

[![npm version](https://img.shields.io/npm/v/ytconv.svg)](https://www.npmjs.com/package/ytconv)
[![Socket Badge](https://badge.socket.dev/npm/package/ytconv/1.6.7)](https://badge.socket.dev/npm/package/ytconv/1.6.7)
[![TypeScript declarations](https://img.shields.io/badge/types-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.npmjs.com/package/ytconv)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.7-identity-ui/cli/LICENSE)
[![Node.js 22.14+](https://img.shields.io/badge/Node.js-22.14%2B-339933?logo=node.js&logoColor=white)](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.7-identity-ui/cli/docs/NODEJS.md)

**YTConv 1.6.7** restores the recognizable Figlet terminal identity, adds Commander-powered command help, animated download and conversion progress, verified `which`/`isexe` executable discovery, browser-login recovery for private or age-restricted media, and a refreshed 2026 Android application.

The npm package is a CLI only. It contains no web application, no telemetry, and no `preinstall`, `install`, or `postinstall` hooks.

## Highlights in 1.6.7

- Responsive Figlet branding with compact fallbacks for narrow terminals.
- Commander-based `ytconv --help` with clear examples and privacy guidance.
- Animated phases for link inspection, download, merge, audio extraction, remux, thumbnail processing, and conversion.
- Exact pinned runtime dependencies: Figlet 1.11.4, Commander 14.0.3, which 6.0.0, isexe 3.1.5, Ink 7.1.1, React 19.2.8, and ws 8.21.1.
- Shell-free executable discovery and child-process execution.
- Public access first. Browser cookies are requested only after an authentication-related provider failure.
- Subtitles are **off by default** in interactive, headless, and Android flows. Use `--subtitles` or Ctrl+S to enable them.
- Android version 1.6.7 uses current 2026 metadata, visible download/conversion progress, and a local browser-login window for providers that require a session.

## Supported sites

YTConv combines yt-dlp and gallery-dl and can process media from many providers, including:

- YouTube and YouTube Music
- Instagram, Facebook, TikTok, X/Twitter, Threads, Snapchat
- Pinterest, Reddit, Tumblr, Imgur, Flickr, DeviantArt, Pixiv
- Twitch, Kick, Rumble, Vimeo, Dailymotion, Streamable, Odysee
- SoundCloud, Bandcamp, Mixcloud
- Bilibili, Weibo, VK, Telegram, LinkedIn, Bluesky, Mastodon

Provider support follows the installed media engines and may change when a website changes its delivery or authentication system. YTConv reports the selected engine and offers browser-login recovery when an authenticated session is required.

## Install from npm

```bash
npm install --global ytconv@1.6.7
ytconv --version
```

Requirements:

- Node.js 22.14.0 or newer
- npm 10 or newer
- Internet access for media requests and verified engine downloads

YTConv automatically checks for verified yt-dlp, gallery-dl, FFmpeg, and optional browser support. Run the following when setup is incomplete:

```bash
ytconv repair
ytconv doctor
```

## Basic use

Launch the interactive terminal application:

```bash
ytconv
```

Download a public video:

```bash
ytconv "https://www.youtube.com/watch?v=..." --video
```

Download audio:

```bash
ytconv "https://music.youtube.com/watch?v=..." --audio --audio-format mp3
```

Download an Instagram reel with automatic platform detection:

```bash
ytconv "https://www.instagram.com/reel/..."
```

Download images or a gallery:

```bash
ytconv "https://www.pinterest.com/pin/..." --image --image-format jpg
```

Enable subtitles explicitly:

```bash
ytconv "https://www.youtube.com/watch?v=..." --subtitles
```

## Interactive controls

| Key | Action |
|---|---|
| Enter | Inspect, download, and convert the current URL |
| Ctrl+M | Cycle AUTO, VIDEO, AUDIO, and IMAGE modes |
| Ctrl+A | Cycle audio formats and switch to AUDIO |
| Ctrl+T | Cycle video containers and switch to VIDEO |
| Ctrl+Q | Cycle video resolution |
| Ctrl+F | Cycle image formats and switch to IMAGE |
| Ctrl+G | Cycle AUTO and supported social platforms |
| Ctrl+B | Cycle automatic, public, file, and browser access |
| Ctrl+S | Toggle subtitles; default is off |
| Ctrl+P | Toggle playlist mode |
| Ctrl+V | Paste a URL from the clipboard |
| H / D | Help / diagnostics |
| Esc / Ctrl+C | Cancel safely |

## Browser login and cookies

YTConv never asks for a password or OTP inside the CLI.

The normal flow is:

1. Try the URL without cookies.
2. Try an explicitly configured cookie file when one exists.
3. Try a previously linked local browser profile.
4. When the provider reports an authentication failure, open the provider's official login page in the user's browser.
5. Verify the same media URL with a short-lived local cookie export.
6. Delete the temporary cookie export after the attempt.

Link a browser session manually:

```bash
ytconv login instagram
ytconv login facebook
ytconv login tiktok
ytconv login x
```

Select a browser explicitly:

```bash
ytconv "https://www.instagram.com/reel/..." --cookies-browser chrome
```

Use a Netscape-format cookie file:

```bash
ytconv "https://example.com/media" --cookies ./cookies.txt
```

Keep cookie files private. Do not commit them to Git or upload them to support tickets.

## Android APK

The Android application is version **1.6.7** with version code **10607** and 2026 UI metadata.

It provides:

- AUTO, MP4, and MP3 modes
- visible download and conversion progress
- Stop/cancel support
- output in `Download/YTConv`
- subtitles disabled by default
- local WebView login for supported providers
- temporary cookie storage in the application cache
- automatic cookie deletion when the activity closes

The browser window loads the provider's official page. Credentials and OTP codes stay inside Android WebView and are not passed as YTConv command-line arguments.

Native package documentation is available in [`docs/PACKAGES.md`](docs/PACKAGES.md).

## Headless and automation

```bash
ytconv --headless "https://youtu.be/..."
ytconv --stdin < urls.txt
ytconv --batch-file urls.txt --continue-on-error
```

JSON result output:

```bash
ytconv --headless --result-json result.json "https://youtu.be/..."
```

## Diagnostics

```bash
ytconv doctor
ytconv self-test
ytconv examples
ytconv shell-info
```

The diagnostics output includes engine versions, paths, platform information, selected social provider, subtitle state, output directory, browser availability, and cookie source.

## Security

- No npm lifecycle installation hooks.
- No `shell: true`, `eval`, or dynamically constructed shell commands.
- Executables are resolved with pinned `which` and `isexe` packages and run with argument arrays.
- Verified engine downloads use allowlisted HTTPS release endpoints and integrity checks.
- Browser login is an explicit recovery step after public access fails.
- Temporary cookies are stored locally with restricted permissions and removed after use.
- No telemetry.

Read the complete policy in [`SECURITY.md`](SECURITY.md) and [`docs/SOCKET-SECURITY.md`](docs/SOCKET-SECURITY.md).

## Package formats

Release automation supports:

- npm tarball with provenance
- Windows installer EXE and portable ZIP
- Android debug and unsigned release APKs plus source archive
- DEB and RPM for x86_64 and ARM64
- Arch package
- Alpine APK
- AppImage
- Snap
- Flatpak
- Nix and flake metadata
- Termux DEB
- portable Linux archives
- iSH Python package

## Update

```bash
ytconv check-update
ytconv update
```

## License

ISC License. See [`LICENSE`](LICENSE).
