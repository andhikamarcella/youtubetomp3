# YTConv CLI 1.5.5

YTConv is a cross-platform media downloader and converter for Windows CMD/PowerShell, Linux, macOS, SSH/headless servers, Android Termux, and iPhone/iPad through iSH. It uses **yt-dlp**, **gallery-dl**, and **FFmpeg** for supported video, audio, images, carousels, Stories, Reels, mixed posts, and playlists.

> Download only media that you own, that is openly licensed, or that you are allowed to save. YTConv does not bypass DRM, paywalls, private-account access, regional restrictions, or copyright controls.

## What is new in 1.5.5

- Cloud device sign-in remains available when the YTConv account service is online.
- If cloud sign-in is unavailable, `ytconv login` creates a private local CLI profile so downloads are never trapped behind a broken web endpoint.
- After interactive login, YTConv returns directly to the polished terminal interface; use `--no-launch` when only a session should be created.
- `ytconv login`, `ytconv auth status`, `ytconv whoami`, and `ytconv logout`.
- `ytconv login --local` skips cloud sign-in, while `ytconv login --cloud-only` disables fallback.
- The terminal interface now has clearer account state, focus borders, progress, completion, error, and setup states.
- Stable self-tests, updater-channel checks, version output, installer identities, and package metadata are corrected for 1.5.5.
- The npm tarball is CLI-only: no HTML, CSS, React web app, Next.js page, or other web frontend asset is published.
- Public X/Twitter posts try yt-dlp before gallery-dl, and an empty gallery result is no longer reported as a successful conversion.
- Persistent config, named profiles, privacy-limited history, shell completion, playlist/batch, retry/resume, subtitles, SponsorBlock mark mode, and separate archives remain available.

## Install stable 1.5.5

### Windows

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd login
```

Use `ytconv.cmd` when PowerShell execution policy blocks the generated `ytconv.ps1` shim.

### Linux, macOS, or SSH

```sh
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
ytconv login
```

The included `scripts/install-unix.sh` can install the operating-system dependencies on supported package managers without using `sudo npm install -g`.

### Android Termux

```sh
pkg update
pkg install -y nodejs python ffmpeg curl ca-certificates
termux-setup-storage
python -m pip install -U --no-cache-dir yt-dlp gallery-dl
npm install -g ytconv@latest --omit=optional --force
ytconv repair
ytconv login
```

Default output: `~/storage/downloads/YTConv`.

### iPhone/iPad through iSH

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/release/ytconv-1.5.5/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
ytconv login
```

The browser can be opened on the same device or another device. Enter the eight-character code shown in the terminal and approve the CLI session.

## Account and fallback commands

```sh
ytconv login
ytconv login --local
ytconv login --cloud-only
ytconv auth status
ytconv whoami
ytconv logout
```

Cloud login opens a device-approval page when the configured account endpoint is available. If that endpoint is missing, offline, or unhealthy, YTConv automatically creates a local-only profile and continues into the CLI. A local profile never claims to be a verified cloud identity.

The profile is stored in `~/.ytconv/auth.json`. On Unix-like systems it is written with user-only permissions. Never share that file, browser cookies, access tokens, or device codes.

Help, version, diagnostics, repair, update, configuration, profile, and history commands remain available before login. Media downloads and conversions do not.

## Media commands

```sh
ytconv download "URL"
ytconv playlist "PLAYLIST_URL"
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
ytconv info "URL" --json
ytconv formats "URL"
ytconv subtitles "URL"
```

## Persistent configuration and profiles

```sh
ytconv config list
ytconv config set output "$HOME/Downloads/YTConv"
ytconv config set audioQuality 192
ytconv profile set music preset=music audioQuality=320
ytconv profile set phone preset=mobile resolution=720
ytconv profile use phone
ytconv --profile music download "URL"
```

Explicit command-line options override saved defaults. Use `--no-config` for a clean one-run session.

## Default media behavior

```text
Subtitles         enabled for video
SponsorBlock      enabled in non-destructive mark mode
Download archives enabled per output profile
Resume            enabled
```

One-run opt-outs:

```sh
ytconv download "URL" --no-subtitles
ytconv download "URL" --no-sponsorblock
ytconv download "URL" --no-archive
```

SponsorBlock `mark` adds chapter markers; it does not cut the media. Cutting requires the explicit `--sponsorblock remove` option.

## Formats, metadata, cookies, and diagnostics

```sh
ytconv download "URL" --audio-format mp3 --audio-quality 320
ytconv download "URL" --audio-format flac
ytconv download "URL" --video-format mp4 --resolution 1080
ytconv download "URL" --preset music
ytconv download "URL" --metadata --thumbnail --metadata-files
ytconv download "URL" --cookies cookies.txt
ytconv download "URL" --cookies-from-browser chrome
ytconv doctor
ytconv repair
ytconv --self-test
ytconv --shell-info
```

Cookies are account credentials. Use them only for media you are authorized to access and never include them in screenshots, logs, issues, or chat messages.

## History and shell completion

```sh
ytconv history
ytconv history --json
ytconv history --limit 50
ytconv history clear
ytconv completion bash
ytconv completion zsh
ytconv completion fish
ytconv completion powershell
```

History is capped and excludes cookies, tokens, proxy credentials, and browser session data.

## Release channels

```text
Stable: 1.5.5          npm install -g ytconv@latest
Beta:   1.6.0-beta.1   npm install -g ytconv@beta
```

The guarded beta workflow preserves the stable npm `latest` tag.

## Documentation

- [Account login and local fallback](docs/AUTH.md)
- [Complete installation guide](docs/INSTALL.md)
- [Linux distribution guide](docs/LINUX.md)
- [Command reference](docs/COMMANDS.md)
- [Shell guide](docs/SHELLS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
