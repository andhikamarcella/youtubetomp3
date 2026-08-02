# YTConv CLI 1.6.0-beta.1

YTConv is a cross-platform media downloader and converter for Windows CMD/PowerShell, Linux, macOS, SSH/headless servers, Android Termux, and iPhone/iPad through iSH. It uses **yt-dlp**, **gallery-dl**, and **FFmpeg** for supported video, audio, images, carousels, Stories, Reels, mixed posts, and playlists.

> Download only media that you own, that is openly licensed, or that you are allowed to save. YTConv does not bypass DRM, paywalls, private-account access, regional restrictions, or copyright controls.

## What is new in 1.6.0-beta.1

This beta includes everything from the account-protected 1.5.0 release, plus:

- `ytconv auth devices` to list signed-in CLI devices.
- `ytconv auth devices --json` for scripts and automation.
- `ytconv auth revoke TOKEN_ID` to revoke a lost or unused device.
- `ytconv auth revoke all` to revoke every other device while keeping the current terminal active.
- `ytconv auth refresh` to rotate the current device token immediately.
- Automatic token rotation when seven days or less remain.
- Device-management parity for the native iSH/Python frontend.
- A clearer account table and improved browser-login feedback.

The stable foundation still requires account login before downloads/conversions, keeps the X/Twitter yt-dlp-first fallback, and includes persistent config, profiles, history, shell completion, playlist/batch, retry/resume, subtitles, SponsorBlock mark mode, and separate archives.

## Install the beta

### Windows

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
ytconv.cmd --version
ytconv.cmd login
```

### Linux, macOS, or SSH

```sh
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@beta --force
ytconv --version
ytconv login
```

### Android Termux

```sh
pkg update
pkg install -y nodejs python ffmpeg curl ca-certificates
termux-setup-storage
python -m pip install -U --no-cache-dir yt-dlp gallery-dl
npm install -g ytconv@beta --omit=optional --force
ytconv repair
ytconv login
```

### iPhone/iPad through iSH

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/release/ytconv-1.6.0-beta/cli/scripts/install-ish.sh -o /tmp/ytconv-ish-beta.sh
sh /tmp/ytconv-ish-beta.sh
ytconv --version
ytconv login
```

Expected version:

```text
1.6.0-beta.1
```

## Login and device management

```sh
ytconv login
ytconv auth status
ytconv auth status --json
ytconv auth devices
ytconv auth devices --json
ytconv auth revoke TOKEN_ID
ytconv auth revoke all
ytconv auth refresh
ytconv logout
```

The local token is stored in `~/.ytconv/auth.json` with user-only permissions on Unix-like systems. Never share that file, device codes, cookies, or browser sessions.

## Media commands

```sh
ytconv download "URL"
ytconv playlist "PLAYLIST_URL"
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
ytconv info "URL" --json
ytconv formats "URL"
ytconv subtitles "URL"
```

## Configuration, profiles, and history

```sh
ytconv config list
ytconv config set output "$HOME/Downloads/YTConv"
ytconv config set audioQuality 192
ytconv profile set music preset=music audioQuality=320
ytconv profile set phone preset=mobile resolution=720
ytconv profile use phone
ytconv --profile music download "URL"
ytconv history
ytconv history --json
ytconv history clear
```

Explicit command-line options override saved defaults. `--no-config` ignores saved settings for one run.

## Default media behavior

```text
Subtitles         enabled for video
SponsorBlock      enabled in non-destructive mark mode
Download archives enabled per output profile
Resume            enabled
```

Opt out for one run:

```sh
ytconv download "URL" --no-subtitles
ytconv download "URL" --no-sponsorblock
ytconv download "URL" --no-archive
```

## Formats, cookies, and diagnostics

```sh
ytconv download "URL" --audio-format mp3 --audio-quality 320
ytconv download "URL" --audio-format flac
ytconv download "URL" --video-format mp4 --resolution 1080
ytconv download "URL" --preset music
ytconv download "URL" --cookies cookies.txt
ytconv download "URL" --cookies-from-browser chrome
ytconv doctor
ytconv repair
ytconv --self-test
ytconv --shell-info
```

Cookies are account credentials. Use them only for media you are authorized to access and never publish them in logs, screenshots, issues, or chat messages.

## Shell completion

```sh
ytconv completion bash
ytconv completion zsh
ytconv completion fish
ytconv completion powershell
```

## Account-server deployment

The Next.js account server needs:

```text
DATABASE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
NEXTAUTH_SECRET
NEXTAUTH_URL
CLI_AUTH_ENCRYPTION_KEY (recommended)
```

See [docs/AUTH.md](docs/AUTH.md) and [docs/BETA-1.6.md](docs/BETA-1.6.md).

## Return to stable

```sh
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
```

For iSH, rerun the installer from `release/ytconv-1.5.0`.

## Release channels

```text
Stable: 1.5.0          npm install -g ytconv@latest
Beta:   1.6.0-beta.1   npm install -g ytconv@beta
```

The beta publishing workflow verifies that npm `latest` is not changed.

## Documentation

- [1.6 beta guide](docs/BETA-1.6.md)
- [Account login and deployment](docs/AUTH.md)
- [Complete installation guide](docs/INSTALL.md)
- [Linux distribution guide](docs/LINUX.md)
- [Command reference](docs/COMMANDS.md)
- [Shell guide](docs/SHELLS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
