# YTConv 1.6.0 on iPhone and iPad with iSH

## What iSH is

iSH runs an emulated Alpine Linux userland inside an iOS application. It is not a native iOS terminal with access to Safari data. Performance, memory, background execution, and filesystem integration are more limited than desktop or Termux.

YTConv’s iSH path uses Python, yt-dlp, gallery-dl, and FFmpeg without the Node/Ink TUI.

## Install packages

Inside iSH:

```sh
apk update
apk add --no-cache python3 py3-pip ffmpeg curl ca-certificates
update-ca-certificates
python3 -m pip install -U --no-cache-dir --break-system-packages 'yt-dlp[default]' gallery-dl
```

Install the stable YTConv wrapper using the repository’s `install-ish.sh` instructions from the GitHub Release. The installer downloads `ish/ytconv.py` and `ish/ytconv-core.py`, validates Python syntax, installs them under `/usr/local/lib/ytconv-ish`, and creates `/usr/local/bin/ytconv`.

Verify:

```sh
ytconv --version
ytconv --diagnose
```

Expected version: `1.6.0`.

## Use

```sh
ytconv "URL"
ytconv download "URL"
ytconv playlist "URL"
ytconv batch links.txt --continue-on-error
ytconv info "URL"
ytconv formats "URL"
```

Output defaults to:

```text
~/Downloads/YTConv
```

## Stable defaults

The iSH core uses the same intent as the npm CLI:

- public access;
- external extractor configuration ignored;
- no remote JavaScript components;
- monochrome engine output;
- subtitles and safe archive behavior where supported;
- bounded retries and safe filenames.

Use `--help` for the exact Python launcher flags.

## Safari login limitation

iOS sandboxes Safari, Chrome, and other apps from iSH. The terminal cannot read their cookies or start the desktop managed-browser bridge. Signing into Instagram in Safari does not make that session visible in iSH. Public URLs are supported; use a desktop for account-required media.

Do not export or paste a long-lived browser cookie database into iSH as a workaround.

## Performance

- Prefer audio or 360p/720p on older devices.
- Process one URL at a time.
- Keep iSH in the foreground.
- Ensure enough free iOS and iSH filesystem storage for both source and conversion files.
- Avoid large playlists and 4K merges.
- A `.part` file after interruption can normally resume on the next attempt.

## Update

```sh
apk update
apk upgrade
python3 -m pip install -U --no-cache-dir --break-system-packages 'yt-dlp[default]' gallery-dl
```

Then rerun the stable iSH installer and verify `ytconv --version`.

## Troubleshooting

### `No space left on device`

Remove unwanted files from the iSH filesystem, lower media quality, and avoid conversion formats that need both input and output copies.

### `Killed`

iOS likely reclaimed memory or background time. Keep iSH foreground, use a smaller item, and avoid parallel work.

### Certificate errors

```sh
apk add --no-cache ca-certificates curl
update-ca-certificates
```

### Extractor errors

```sh
python3 -m pip install -U --no-cache-dir --break-system-packages 'yt-dlp[default]' gallery-dl
ytconv --diagnose
```

Site changes can occur after a YTConv release; updating Python engines is often the correct first step.
