# Troubleshooting YTConv 1.4.0

Start with this safe sequence:

```bash
ytconv clean
ytconv repair
ytconv --self-test
ytconv doctor
ytconv --shell-info
```

Do not include cookies, tokens, private URLs, or proxy credentials when sharing diagnostics.

## The wrong npm version is being published

From the `cli` directory:

```bash
node -p "require('./package.json').version"
node -p "require('./package.json').publishConfig.tag"
git branch --show-current
git status --short
```

For the stable release, expected values are:

```text
1.4.0
latest
release/ytconv-1.4.0
```

npm never allows a published version number to be overwritten.

## `spawnSync npm.cmd EINVAL` on Windows

Older updater code attempted to spawn a `.cmd` file directly. Install the current stable version manually:

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
```

The current updater uses the npm CLI through Node.js, with `cmd.exe` only as a controlled fallback.

## PowerShell says scripts are disabled

Use the CMD shim:

```powershell
ytconv.cmd --version
ytconv.cmd doctor
```

Optionally enable local/signed scripts for the current user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## `ytconv: command not found`

Windows:

```cmd
where ytconv
where npm
npm.cmd prefix -g
```

Linux/macOS:

```bash
command -v ytconv
type -a ytconv
npm prefix -g
export PATH="$HOME/.local/bin:$PATH"
```

Persist the PATH line in the shell profile.

## npm reports `EACCES` or permission denied

Do not use `sudo npm install -g`. Configure a user prefix:

```bash
npm config set prefix "$HOME/.local"
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force
```

## Node.js is too old

YTConv requires Node.js 18 or newer:

```bash
node --version
```

Install Node.js 18, 20, or 22, reopen the terminal, and reinstall YTConv.

## FFmpeg or ffprobe is missing

```bash
ytconv --shell-info
ytconv repair
ytconv doctor
```

FFmpeg is required for merging, conversion, embedded cover art, clipping, and some subtitle operations. ffprobe is optional for part of the diagnostics.

## Alpine reports that FFmpeg cannot execute

Alpine uses musl. Install system FFmpeg and omit the optional bundled binary:

```sh
apk add --no-cache ffmpeg
npm install -g ytconv@latest --omit=optional --force
```

## The URL works in a browser but fails in YTConv

Possible causes:

- login is required
- cookies expired or are locked by the browser
- private or deleted media
- regional restriction
- extractor changes
- DRM or a paywall
- HTTP 429 rate limiting

Try:

```bash
ytconv info "URL"
ytconv download "URL" --cookies-from-browser chrome
ytconv download "URL" --cookies cookies.txt
```

Close the browser completely before reading browser cookies.

## Browser cookies cannot be read

Desktop example:

```bash
ytconv download "URL" --cookies-from-browser chrome
ytconv download "URL" --cookies-from-browser "firefox:default-release"
```

When browser extraction fails, export a Netscape-format cookie file legally and use `--cookies`. Termux and iSH cannot directly access private Android/iOS browser databases.

## HTTP 429 / Too Many Requests

Reduce concurrency and wait before retrying:

```bash
ytconv download "URL" --concurrent-fragments 1 --retry-sleep "linear=2:20:3"
ytconv batch links.txt --jobs 1 --continue-on-error
```

Aggressive retries can extend the restriction.

## Timeout, DNS, certificate, or proxy error

```bash
ytconv doctor
ytconv --shell-info
```

Verify the system clock, CA certificates, DNS, and proxy URL. Supported forms include:

```text
http://host:port
socks5://host:port
```

## Requested format is not available

Inspect real source formats:

```bash
ytconv formats "URL"
ytconv formats "URL" --json
```

Then lower the resolution or use automatic/MKV output:

```bash
ytconv download "URL" --video-format auto --resolution 720
```

## MP3 320 kbps sounds unchanged

That is expected. 320 kbps is an encoder target, not a source-quality upgrade. Inspect the original streams with:

```bash
ytconv formats "URL"
```

## Metadata is missing in the player

```bash
ytconv download "URL" --audio-format mp3 --artist "Artist" --title "Title" --album "Album"
```

Some players hide fields even when the file contains them.

## Thumbnail or cover art failed

```bash
ytconv doctor
ytconv repair
```

WAV does not use the same embedded-cover path. MP3 attempts both a separate JPG and embedded artwork.

## YouTube Music artwork is not square

Use a `music.youtube.com` URL and ensure FFmpeg is available. Standard YouTube URLs are intentionally not always cropped.

## Subtitles are missing

```bash
ytconv subtitles "URL"
ytconv download "URL" --subtitle-only --subtitle-langs "en,id"
```

Not every video has manual or automatic subtitles. Live chat is excluded by default.

## SponsorBlock did not mark or remove anything

```bash
ytconv download "URL" --sponsorblock mark
```

Community segment data may not exist. SponsorBlock is mainly useful on YouTube.

## Batch stops too early

```bash
ytconv batch links.txt --continue-on-error --jobs 2 --result-json report.json
```

The final exit code remains nonzero when one or more items fail.

## A `.part` file remains

Resume is enabled by default:

```bash
ytconv download "URL" --resume
```

To remove newly created partial files after a failure:

```bash
ytconv download "URL" --cleanup-part
```

Cleanup is disabled during parallel batch work so one worker cannot delete another worker's files.

## Output template is rejected

Templates must be relative, must not contain `..`, and must include `%(ext)s`:

```bash
ytconv download "URL" --output-template "%(uploader)s/%(title)s.%(ext)s"
```

## iSH is slow or runs out of memory

Use a smaller preset and one batch worker:

```sh
ytconv download "URL" --preset mobile
ytconv batch links.txt --jobs 1 --continue-on-error
```

## Exit codes

```text
0    Success
1    Processing failed
2    Invalid URL or option
3    Missing dependency
4    Authentication required
5    Temporary failure
130  Cancelled
```

## Logs

```bash
ytconv download "URL" --log-file ytconv.log
```

Before sharing logs, remove private URLs, usernames, sensitive paths, proxy details, and account information. Never include cookie contents.
