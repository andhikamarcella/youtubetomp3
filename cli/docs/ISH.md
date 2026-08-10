# iPhone and iPad with iSH

iSH uses YTConv's Python frontend. Node.js and the Ink interface are intentionally excluded because of iOS/iSH memory and compatibility limits.

## Install

Inside iSH:

```sh
apk update
apk upgrade
apk add --no-cache python3 py3-pip ffmpeg curl ca-certificates
update-ca-certificates
python3 -m pip install -U --no-cache-dir --break-system-packages 'yt-dlp[default]' gallery-dl
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/YTConv/release/ytconv-1.7.2/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
ytconv --diagnose
```

## If FFmpeg is not found

Run these exact checks:

```sh
apk update
apk add --no-cache ffmpeg
hash -r
command -v ffmpeg
ffmpeg -version
ytconv --diagnose
```

If `apk` cannot find FFmpeg, inspect `/etc/apk/repositories`, enable the normal Alpine main/community repositories for the iSH Alpine release, run `apk update`, and retry. Do not download an unverified glibc desktop binary; iSH uses Alpine/musl packages.

## Use

```sh
ytconv "URL"
ytconv playlist "URL"
ytconv info "URL"
ytconv formats "URL"
```

Output defaults to `~/Downloads/YTConv`, visible through Files → iSH.

## Limits

- iSH cannot read Safari/Chrome private session databases.
- Keep iSH in the foreground; iOS may stop background work.
- Prefer audio or 360p/720p and one item at a time.
- Avoid 4K conversion and large playlists on low-memory devices.
- Public media still depends on upstream extractor support and provider availability.
