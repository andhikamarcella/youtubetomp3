# YTConv 1.7.0 Command Reference

## General syntax

```text
ytconv [COMMAND] [URL] [OPTIONS]
```

The legacy form remains valid:

```text
ytconv URL [OPTIONS]
```

## Media and system commands

```text
download URL                 Download one media item
playlist URL                 Enable playlist or collection processing
batch FILE                   Read one URL per line from a UTF-8 file
info URL                     Inspect metadata without downloading
formats URL                  List source formats
subtitles URL                List available subtitle tracks
doctor                       Diagnose the installation
repair                       Repair yt-dlp, gallery-dl, and FFmpeg
clean                        Clear update and old error caches
update                       Update the active npm channel
examples                     Show common examples
quickstart                   Show a five-step beginner setup
```

Aliases include `dl`, `get`, `pl`, `subs`, `inspect`, and `setup`.

## YouTube AUTO policy

When mode is AUTO:

```text
music.youtube.com                           audio, MP3 by default
youtube.com / youtu.be / youtube-nocookie  video, MP4 by default
```

Examples:

```sh
ytconv download "https://music.youtube.com/watch?v=MUSIC_ID"
ytconv download "https://www.youtube.com/watch?v=VIDEO_ID"
```

Explicit mode and format options always override the URL-based default:

```sh
ytconv download "YOUTUBE_URL" --mode audio --audio-format mp3
ytconv download "YOUTUBE_MUSIC_URL" --mode video --video-format mp4
ytconv download "YOUTUBE_URL" --mode video --video-format mkv
ytconv download "YOUTUBE_URL" --mode video --video-format webm
```

## Persistent configuration

```text
ytconv config list
ytconv config path
ytconv config get KEY
ytconv config set KEY VALUE
ytconv config unset KEY
ytconv config reset
```

Configuration is stored at `~/.ytconv/config.json`. Allowed settings:

```text
preset
output
audioFormat
audioQuality
videoFormat
resolution
subtitleLanguages
subtitles
sponsorBlock
archive
concurrentFragments
rateLimit
restrictFilenames
normalizeAudio
retries
fragmentRetries
```

The command validates every value before saving it. It does not accept cookie contents, tokens, or browser sessions.

Ignore saved settings for one execution:

```text
--no-config
```

## Named profiles

```text
ytconv profile list
ytconv profile show NAME
ytconv profile set NAME key=value [key=value ...]
ytconv profile use NAME
ytconv profile clear
ytconv profile delete NAME
```

Use one profile without changing the active profile:

```text
--profile NAME
```

Example:

```sh
ytconv profile set music preset=music audioQuality=320
ytconv --profile music download "URL"
```

Explicit command-line values override saved defaults and profile values.

## History

```text
ytconv history
ytconv history --json
ytconv history --limit N
ytconv history clear
```

Headless and batch history is stored at `~/.ytconv/history.jsonl` and capped at 500 records. Cookie contents, tokens, and browser session data are excluded.

## Shell completion

```text
ytconv completion bash
ytconv completion zsh
ytconv completion fish
ytconv completion powershell
```

Copy the generated script into the matching shell profile.

## Presets

```text
--preset balanced|music|lossless|mobile|hd|archive
--list-presets
```

## Mode

```text
--auto
--mode auto|video|audio|image
--video
--audio
--image | --images | --gallery
--stories
--all-media
--platform PLATFORM
```

A forced mode is never silently replaced. AUTO may fall back between yt-dlp and gallery-dl only where the platform supports mixed media.

## Audio

```text
--audio-format mp3|m4a|aac|opus|vorbis|flac|alac|wav
--audio-quality best|320|256|192|128|96
--bitrate RATE
--normalize-audio
--keep-video
```

MP3 320 kbps is an encoder target and cannot add detail missing from the source.

## Video

```text
--video-format auto|mp4|mkv|webm
--container FORMAT
--resolution best|2160|1440|1080|720|480|360|240|144
```

Resolution is a maximum limit. YTConv selects the closest available source format.

For MP4, YTConv prefers AVC/H.264 video plus M4A audio. If those streams are unavailable, YTConv uses a broader source fallback and FFmpeg recoding so the final file is a real MP4 rather than an incompatible remux.

## Verified output

YTConv 1.7.0 verifies that the final path exists and matches the requested mode:

```text
video mode       a real video file such as MP4, MKV, or WebM
audio mode       a real audio file such as MP3, M4A, FLAC, or Opus
image/gallery    a real image or gallery video
subtitle-only    a real subtitle file
```

A thumbnail, metadata JSON file, archive text file, log, or partial file does not count as a completed video/audio conversion.

## Subtitles

```text
--subtitles
--no-subtitles
--subtitles-off
--subtitle-only
--subtitle-langs "en,id"
--list-subs
```

YTConv 1.7.0 keeps subtitles disabled by default unless explicitly requested. Missing subtitles should not fail the main media download.

## SponsorBlock

```text
--sponsorblock off|mark|remove
--sponsorblock-mode off|mark|remove
--remove-sponsors
--sponsorblock-categories "sponsor,selfpromo"
--no-sponsorblock
--sponsorblock-off
```

YTConv 1.7.0 defaults to `mark`, which adds chapters without cutting media. `remove` cuts matching segments and must be requested explicitly.

## Metadata and thumbnails

```text
--thumbnail
--write-thumbnail
--metadata
--metadata-files
--write-info-json
--write-description
--artist VALUE
--title VALUE
--album VALUE
--track VALUE
--year VALUE
--genre VALUE
```

MP3 can receive a separate JPG and embedded cover art. YouTube Music artwork is cropped to a centered square when FFmpeg is available.

## Clip a section

```text
--start TIME | --from TIME
--end TIME   | --to TIME
```

Time accepts seconds, `MM:SS`, or `HH:MM:SS`.

## Playlist and batch

```text
--playlist
--playlist-items "1,3,5-10"
--max-downloads 25
--skip-playlist-after-errors 5
--batch-file FILE
--stdin
--jobs 1..8
--continue-on-error
--result-json FILE
```

The `batch` command automatically enables continue-on-error. The final exit code remains nonzero when any item fails.

## Retry, resume, and archive

```text
--retries N|infinite
--fragment-retries N|infinite
--file-access-retries N|infinite
--retry-sleep "linear=1:10:2"
--resume
--no-resume
--cleanup-part
--archive FILE
--no-archive
```

Resume is enabled by default. YTConv creates separate automatic yt-dlp text archives and gallery-dl SQLite archives under `~/.ytconv/archives`, separated by output profile. `--archive FILE` overrides the yt-dlp archive path for the current execution.

If an archived URL has no real output file, YTConv 1.7.0 retries that item once without the archive. A second zero-file result fails instead of reporting success.

## Network and performance

```text
--rate-limit 2M
--concurrent-fragments 1..16
--proxy http://host:port
--proxy socks5://host:port
--live-from-start
```

Proxy credentials can be visible in terminal history. Do not share them in logs or screenshots.

## Files and output

```text
-o, --output PATH
--output-template "%(uploader)s/%(title)s [%(id)s].%(ext)s"
--restrict-filenames
--overwrite
--log-file FILE
--open-output
```

Output templates must be relative, must not contain `..`, and must include `%(ext)s`.

## Official social-media login

```text
ytconv login instagram
ytconv login facebook --browser edge
ytconv login x --browser "chrome:Profile 1"
ytconv social status
ytconv logout instagram
ytconv social logout --all
```

YTConv opens the provider's official page in a private Chromium profile when regular browser encryption blocks direct access. In the interactive CLI this handoff starts automatically after an authentication failure. The exact failed URL is retried, and the provider link is saved only after that retry succeeds. Passwords and OTP codes never enter YTConv; provider-scoped temporary cookies stay local and are deleted after the attempt.

## Advanced and compatibility cookie options

```text
--cookies FILE
--cookies-from-browser chrome
--cookies-from-browser "firefox:default-release"
```

Typical desktop browsers include Chrome, Chromium, Edge, Firefox, Brave, Opera, Vivaldi, Safari, and Whale. Use these options only as manual overrides; the recommended flow is `ytconv login PROVIDER`. Cookie data is sensitive and must never be shared.

## Inspection, JSON, and automation

```text
--dry-run URL
--json URL
--formats-json URL
--list-formats URL
--list-subs URL
--headless
--non-interactive
--no-color
--yes
```

JSON output is intended for scripts, bots, websites, and other programs.

## Diagnostics and updates

```text
--diagnose | --doctor
--repair | --setup
--shell-info | --where
--self-test
--clear-cache
--check-update
--update
--no-update-check
--version
--help
```

Stable 1.7.0 updates through:

```sh
npm install -g ytconv@latest --force
```

## Stable defaults

```text
Subtitles         OFF unless requested
SponsorBlock      ON in mark mode
Download archive ON per output profile
Resume            ON
YouTube Music AUTO MP3
Regular YouTube AUTO MP4
```

## Exit codes

```text
0    Success with a verified output or successful utility command
1    Download or conversion failed
2    Invalid URL or invalid option
3    Required dependency missing
4    Authentication required
5    Temporary network or site failure
130  Cancelled by the user
```
