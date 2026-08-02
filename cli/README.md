# YTConv CLI 1.5.7

YTConv is a cross-platform media downloader and converter for Windows CMD/PowerShell, Linux, macOS, SSH/headless servers, Android Termux, and iPhone/iPad through iSH. It uses **yt-dlp**, **gallery-dl**, and **FFmpeg** for supported video, audio, images, carousels, Stories, Reels, mixed posts, and playlists.

> Download only media that you own, that is openly licensed, or that you are allowed to save. YTConv does not bypass DRM, paywalls, private-account access, regional restrictions, or copyright controls.

## What's new in 1.5.7

- `ytconv repair` now reruns the bundled `ffmpeg-static` installer and verifies the downloaded executable before reporting success.
- A clean Windows CI test removes FFmpeg and proves that YTConv restores it automatically.
- Runtime messages, setup screens, social-login guidance, errors, and documentation are now consistently written in English.
- yt-dlp and gallery-dl still bootstrap automatically, and interactive stable updates remain enabled.
- Official browser login remains available for Instagram, Facebook, X, TikTok, YouTube, Pinterest, Reddit, Threads, Twitch, and other supported providers.
- Passwords, OTP codes, and raw cookies remain in the browser; YTConv stores only a browser/profile reference.
- The npm package remains CLI-only and does not depend on a website or account-server deployment.

## Install stable 1.5.7

### Windows

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd doctor
```

Use `ytconv.cmd` when PowerShell execution policy blocks the generated `ytconv.ps1` shim.

### Linux, macOS, or SSH

```sh
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
ytconv doctor
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
ytconv doctor
```

Default output: `~/storage/downloads/YTConv`.

### iPhone/iPad through iSH

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/release/ytconv-1.5.7-cli-only-final/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
ytconv doctor
```

The browser can be opened on the same device or another device. Enter the eight-character code shown in the terminal and approve the CLI session.

## Official Instagram, Facebook, X, and social-media login

```sh
ytconv login instagram
ytconv login facebook --browser edge
ytconv login x --browser "chrome:Profile 1"
ytconv social status
ytconv logout instagram
```

The flow is intentionally simple:

1. YTConv detects available browsers and asks you to choose one when needed.
2. The provider's official login page opens. Enter passwords and OTP codes only on that official page.
3. After sign-in, return to the terminal and press Enter.
4. YTConv stores the provider and browser/profile reference in `~/.ytconv/social-sessions.json`.
5. When public access fails because login is required, the linked browser session is tried automatically.

Session cookies remain in the browser database under browser/OS encryption, such as DPAPI on Windows or Keychain on macOS. YTConv does not store passwords, OTP codes, access tokens, or raw cookie values, and it does not send social sessions to a YTConv server.

If a session cannot be read, close the browser completely and retry. Firefox is often the most compatible option for local session access. Termux and iSH cannot access private Android/iOS browser databases; use public media or an official authentication method available on the device.

The legacy YTConv cloud account is optional and remains available through `ytconv account login`.

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
ytconv login instagram
ytconv download "URL_INSTAGRAM"
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
Stable: 1.5.7          npm install -g ytconv@latest
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
