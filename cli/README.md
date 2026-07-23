# YTConv CLI 1.5.0 Beta 2

YTConv is a beginner-friendly media downloader and converter for Windows CMD, PowerShell, Linux distributions, macOS, SSH/headless servers, Android Termux, and iPhone/iPad through the native iSH frontend. It uses **yt-dlp**, **gallery-dl**, and **FFmpeg** for video, audio, images, carousels, Stories, Reels, mixed posts, and playlists.

> Download only media that you own, that is openly licensed, or that you are allowed to save. YTConv does not bypass DRM, paywalls, private-account access, regional restrictions, or copyright controls.

## Release channels

```text
Stable: 1.4.0          npm install -g ytconv@latest
Beta:   1.5.0-beta.2   npm install -g ytconv@beta
```

Installing the beta must not replace the npm `latest` tag.

## Beta defaults

```text
Subtitles        ON for video
SponsorBlock     ON in safe mark mode
Download archive ON with separate output profiles
Resume           ON
```

Disable any beta default for one run:

```bash
ytconv download "URL" --no-subtitles
ytconv download "URL" --no-sponsorblock
ytconv download "URL" --no-archive
```

`SponsorBlock mark` adds chapter markers and does not cut media. Cutting still requires `--sponsorblock remove`.

## New in beta.2

### Persistent configuration

```bash
ytconv config list
ytconv config path
ytconv config set output "$HOME/Downloads/YTConv"
ytconv config set audioQuality 192
ytconv config get output
ytconv config unset audioQuality
ytconv config reset
```

Configuration is stored with user-only file permissions in:

```text
~/.ytconv/config.json
```

Supported saved settings are validated before writing. Cookie contents, tokens, and browser sessions are never stored by the config command.

Ignore saved settings for one run:

```bash
ytconv --no-config download "URL"
```

### Named profiles

```bash
ytconv profile set music preset=music audioQuality=320
ytconv profile set phone preset=mobile resolution=720
ytconv profile list
ytconv profile show music
ytconv profile use phone
ytconv download "URL"
ytconv --profile music download "URL"
ytconv profile clear
ytconv profile delete phone
```

Explicit command-line options override saved defaults.

### Download history

Headless and batch runs write a small privacy-limited history entry:

```bash
ytconv history
ytconv history --json
ytconv history --limit 50
ytconv history clear
```

History includes time, version, command, URLs, mode, preset, profile, output directory, and exit code. It excludes cookies, tokens, proxy credentials, and browser session data. The file is capped at 500 entries.

### Shell completion

```bash
ytconv completion bash
ytconv completion zsh
ytconv completion fish
ytconv completion powershell
```

Copy the generated line into the matching shell profile.

### Beginner quick start

```bash
ytconv quickstart
```

## Install beta.2

### Windows CMD

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
ytconv.cmd quickstart
```

### Windows PowerShell

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
ytconv.cmd quickstart
```

Use `ytconv.cmd` when PowerShell execution policy blocks `ytconv.ps1`.

### Linux, macOS, and SSH

Install the operating-system requirements using [docs/LINUX.md](docs/LINUX.md). Replace `ytconv@latest` with `ytconv@beta` for the prerelease:

```bash
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@beta --force
ytconv --version
ytconv --self-test
ytconv doctor
ytconv quickstart
```

Expected version:

```text
1.5.0-beta.2
```

### Android Termux

```bash
pkg update
pkg install -y nodejs python ffmpeg curl ca-certificates
termux-setup-storage
python -m pip install -U --no-cache-dir yt-dlp gallery-dl
npm install -g ytconv@beta --omit=optional --force
ytconv repair
ytconv --self-test
ytconv doctor
```

Default output: `~/storage/downloads/YTConv`.

### iPhone/iPad through iSH

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/release/ytconv-1.5.0-beta.2/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
ytconv doctor
```

The native iSH frontend provides the media workflow and beta defaults. The Node-specific config/profile/completion layer is documented separately when unavailable in the older iSH runtime.

## Media commands

```bash
ytconv download "URL"
ytconv playlist "PLAYLIST_URL"
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
ytconv info "URL" --json
ytconv formats "URL"
ytconv subtitles "URL"
```

## Formats and quality

```bash
ytconv download "URL" --audio-format mp3 --audio-quality 192
ytconv download "URL" --audio-format flac
ytconv download "URL" --video-format mp4 --resolution 1080
ytconv formats "URL" --json
```

MP3 at 320 kbps is an encoder target and cannot create detail that was absent from the source.

## Metadata and cover art

```bash
ytconv download "URL" --preset music
ytconv download "URL" --metadata --thumbnail --metadata-files
ytconv download "URL" --artist "Artist" --title "Title" --album "Album" --track 3 --year 2026 --genre "Pop"
```

## Playlist, retry, resume, and archive

```bash
ytconv playlist "URL" --playlist-items "1-10"
ytconv playlist "URL" --max-downloads 25 --skip-playlist-after-errors 5
ytconv download "URL" --retries 20 --fragment-retries 30
ytconv download "URL" --resume
```

The beta creates separate yt-dlp text archives and gallery-dl SQLite archives under `~/.ytconv/archives` unless `--no-archive` is used.

## Cookies

```bash
ytconv download "URL" --cookies cookies.txt
ytconv download "URL" --cookies-from-browser chrome
ytconv download "URL" --cookies-from-browser "firefox:default-release"
```

Cookies are sensitive credentials. Never include them in screenshots, logs, issues, or chat messages.

## Diagnostics

```bash
ytconv doctor
ytconv repair
ytconv --self-test
ytconv --shell-info
ytconv clean
```

`clean` preserves configuration, profiles, download history, and download archives.

## Return to stable

```bash
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
```

## Documentation

- [Complete stable installation guide](docs/INSTALL.md)
- [Linux distribution guide](docs/LINUX.md)
- [Beta channel and test guide](docs/BETA.md)
- [Shell guide](docs/SHELLS.md)
- [Command reference](docs/COMMANDS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Release checklist](docs/RELEASE.md)
- [Changelog](CHANGELOG.md)

## Limitations

No downloader can guarantee every URL, site, device, architecture, and distribution forever. Sites can change APIs, require login, remove posts, return HTTP 429, restrict regions, or use DRM. YTConv provides fallback engines, retries, repair tools, diagnostics, and actionable errors, but it cannot create access that is technically or legally unavailable.

## License

MIT. yt-dlp, gallery-dl, FFmpeg, and other dependencies keep their own licenses.
