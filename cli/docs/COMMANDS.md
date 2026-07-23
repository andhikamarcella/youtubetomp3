# YTConv 1.4.0 Command Reference

## General syntax

```text
ytconv [COMMAND] [URL] [OPTIONS]
```

The legacy form remains valid:

```text
ytconv URL [OPTIONS]
```

## Commands

```text
download URL                 Download one media item
playlist URL                 Enable playlist/collection processing
batch FILE                   Read one URL per line from a UTF-8 file
info URL                     Inspect metadata without downloading
formats URL                  List source formats
subtitles URL                List available subtitle tracks
doctor                       Diagnose the installation
repair                       Repair yt-dlp, gallery-dl, and FFmpeg
clean                        Clear update/error caches
update                       Update the active npm channel
examples                     Show common examples
```

Aliases include `dl`, `get`, `pl`, `subs`, `inspect`, and `setup`.

## Presets

```text
--preset balanced|music|lossless|mobile|hd|archive
--list-presets
```

Explicit command-line options override preset values.

## Mode

```text
--auto
--video
--audio
--image | --images | --gallery
--stories
--all-media
--platform PLATFORM
```

A forced mode is never silently replaced. AUTO may fall back between yt-dlp and gallery-dl.

## Audio

```text
--audio-format mp3|m4a|aac|opus|vorbis|flac|alac|wav
--audio-quality best|320|256|192|128|96
--bitrate RATE
--normalize-audio
--keep-video
```

`--bitrate` is an alias for `--audio-quality`. Converting a lossy source to FLAC/ALAC/WAV does not restore lost source detail.

## Video

```text
--video-format auto|mp4|mkv|webm
--container FORMAT
--resolution best|2160|1440|1080|720|480|360|240|144
```

Resolution is a maximum limit. YTConv selects the closest available source format.

## Subtitles

```text
--subtitles
--subtitle-only
--subtitle-langs "en,id"
--list-subs
```

Manual and automatic subtitles are attempted, live chat is excluded by default, and subtitles can be converted to SRT and embedded when the container supports it.

## SponsorBlock

```text
--sponsorblock off|mark|remove
--sponsorblock-mode off|mark|remove
--remove-sponsors
--sponsorblock-categories "sponsor,selfpromo"
```

`mark` creates chapters. `remove` cuts matching segments. Segment data is not available for every video or site.

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
--retries N
--fragment-retries N
--file-access-retries N
--retry-sleep "linear=1:10:2"
--resume
--no-resume
--cleanup-part
--archive FILE
```

Resume is enabled by default. The archive prevents previously recorded media from being downloaded again.

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

## Cookies

```text
--cookies FILE
--cookies-from-browser chrome
--cookies-from-browser "firefox:default-release"
```

Supported browser specifications depend on yt-dlp. Typical browsers include Chrome, Chromium, Edge, Firefox, Brave, Opera, Vivaldi, Safari, and Whale.

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

JSON output is intended for scripts, bots, websites, and other programs. Avoid printing unrelated text to stdout when consuming JSON.

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

Stable 1.4.0 updates through:

```bash
npm install -g ytconv@latest
```

## Stable defaults

```text
Subtitles        OFF
SponsorBlock     OFF
Download archive OFF
Resume           ON
```

Enable optional features explicitly:

```bash
ytconv download "URL" --subtitles --sponsorblock mark --archive downloaded.txt
```

## Exit codes

```text
0    Success
1    Download or conversion failed
2    Invalid URL or invalid option
3    Required dependency missing
4    Authentication required
5    Temporary network/site failure
130  Cancelled by the user
```
