# YTConv CLI 1.4.0

YTConv is a beginner-friendly media downloader and converter for Windows CMD, PowerShell, Linux distributions, macOS, SSH/headless servers, Android Termux, and iPhone/iPad through the native iSH frontend. It uses **yt-dlp**, **gallery-dl**, and **FFmpeg** for video, audio, images, carousels, Stories, Reels, mixed posts, and playlists.

> Download only media that you own, that is openly licensed, or that you are allowed to save. YTConv does not bypass DRM, paywalls, private-account access, regional restrictions, or copyright controls.

## Stable release behavior

YTConv 1.4.0 is the stable `latest` release. Potentially surprising features remain opt-in:

```text
Subtitles       OFF by default
SponsorBlock    OFF by default
Download archive OFF by default
```

Enable them when needed:

```bash
ytconv download "URL" --subtitles
ytconv download "URL" --sponsorblock mark
ytconv playlist "URL" --archive downloaded.txt
```

## Install from npm

### Windows CMD

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

### Windows PowerShell

Use the `.cmd` shim so PowerShell execution policy cannot block the command:

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

### Linux, macOS, and SSH

```bash
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
ytconv --self-test
ytconv doctor
```

The complete Linux guide includes Ubuntu, Debian, Linux Mint, Pop!_OS, Fedora, RHEL, Rocky Linux, AlmaLinux, Arch Linux, CachyOS, Manjaro, EndeavourOS, openSUSE, Alpine, Void Linux, Gentoo, NixOS, and macOS: [docs/LINUX.md](docs/LINUX.md).

### Android Termux

```bash
pkg update
pkg install -y nodejs python ffmpeg
termux-setup-storage
python -m pip install -U --no-cache-dir yt-dlp gallery-dl
npm install -g ytconv@latest --omit=optional --force
ytconv repair
ytconv --self-test
ytconv doctor
```

Default output: `~/storage/downloads/YTConv`.

### iPhone/iPad through iSH

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/release/ytconv-1.4.0/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
ytconv doctor
```

Default output: `~/Downloads/YTConv`.

## Quick commands

```bash
ytconv download "URL"
ytconv playlist "PLAYLIST_URL"
ytconv batch links.txt
ytconv info "URL"
ytconv formats "URL"
ytconv subtitles "URL"
ytconv doctor
ytconv repair
ytconv clean
```

The legacy URL-first syntax remains supported:

```bash
ytconv "URL" --preset music
```

## Presets

```bash
ytconv --list-presets
ytconv download "URL" --preset music
ytconv download "URL" --preset mobile
ytconv playlist "URL" --preset archive
```

Available presets: `balanced`, `music`, `lossless`, `mobile`, `hd`, and `archive`.

## Playlist and batch downloads

```bash
ytconv playlist "URL"
ytconv playlist "URL" --playlist-items "1-10"
ytconv playlist "URL" --max-downloads 25 --skip-playlist-after-errors 5
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

A batch file is UTF-8 text with one URL per line. Blank lines and lines beginning with `#` are ignored.

## Retry, resume, and duplicate prevention

Resume is enabled by default:

```bash
ytconv download "URL" --resume
ytconv download "URL" --retries 20 --fragment-retries 30 --file-access-retries 5
ytconv playlist "URL" --archive downloaded.txt
```

Disable resume with `--no-resume`. The archive prevents downloading the same media again with the same archive file.

## Audio and video formats

```bash
ytconv formats "URL"
ytconv formats "URL" --json
ytconv download "URL" --audio --audio-format mp3 --audio-quality 192
ytconv download "URL" --video --video-format mp4 --resolution 1080
```

MP3 at 320 kbps is an encoder target; it does not create quality that was absent from the source.

## Metadata and cover art

```bash
ytconv download "URL" --preset music
ytconv download "URL" --metadata --thumbnail --metadata-files
ytconv download "URL" --audio-format mp3 --artist "Artist" --title "Title" --album "Album" --track 3 --year 2026 --genre "Pop"
```

MP3 output can include embedded metadata, chapters, a separate JPG thumbnail, and embedded cover art. YouTube Music thumbnails are cropped to a centered square when FFmpeg is available.

## Subtitles

```bash
ytconv subtitles "URL"
ytconv download "URL" --subtitles --subtitle-langs "en,id"
ytconv download "URL" --subtitle-only --subtitle-langs "en,id"
```

Not every source provides manual or automatic subtitles. Missing subtitles should not fail the main media download.

## SponsorBlock

```bash
ytconv download "URL" --sponsorblock mark
ytconv download "URL" --sponsorblock remove
```

`mark` adds chapters when community segment data exists. `remove` cuts matching segments and must be requested explicitly. SponsorBlock data is mainly available for YouTube.

## Cookies and authenticated access

```bash
ytconv download "URL" --cookies cookies.txt
ytconv download "URL" --cookies-from-browser chrome
ytconv download "URL" --cookies-from-browser "firefox:default-release"
```

Cookies are sensitive credentials. Never post them in screenshots, logs, issues, or chat messages.

## Clip a section

```bash
ytconv download "URL" --from 00:01:20 --to 00:03:45
```

Cut accuracy depends on source keyframes and codecs.

## SSH, cron, and automation

```bash
ytconv --headless "URL"
printf '%s\n' "URL1" "URL2" | ytconv --stdin --jobs 2 --continue-on-error
ytconv info "URL" --json
```

Stable exit codes are documented in [docs/COMMANDS.md](docs/COMMANDS.md).

## Diagnostics

```bash
ytconv doctor
ytconv repair
ytconv --self-test
ytconv --shell-info
ytconv clean
```

`doctor` reports the active version, distribution, package manager, output path, yt-dlp, gallery-dl, FFmpeg, ffprobe, cookies, retry settings, and update channel.

## Update and uninstall

Update stable:

```bash
npm install -g ytconv@latest --force
```

Uninstall:

```bash
npm uninstall -g ytconv
```

Downloaded files and archive files are not removed automatically.

## Documentation

- [Complete installation guide](docs/INSTALL.md)
- [Linux distribution guide](docs/LINUX.md)
- [Shell guide](docs/SHELLS.md)
- [Command reference](docs/COMMANDS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Release checklist](docs/RELEASE.md)
- [Changelog](CHANGELOG.md)

## Limitations

No downloader can guarantee every URL, site, distribution, architecture, and device forever. Sites can change APIs, require login, remove posts, return HTTP 429, restrict regions, or use DRM. YTConv provides fallback engines, retries, repair tools, diagnostics, and actionable error messages, but it cannot create access that is technically or legally unavailable.

## License

MIT. yt-dlp, gallery-dl, FFmpeg, and other dependencies keep their own licenses.
