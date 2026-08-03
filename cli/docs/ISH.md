# YTConv 1.6.2 on iPhone and iPad with iSH

## Important Node.js exception

Node.js is required before YTConv on npm platforms, but **it is intentionally not required for iSH**. iSH runs an emulated Alpine Linux environment with tighter compatibility, memory, and background limits. The supported YTConv iSH edition therefore uses Python, yt-dlp, gallery-dl, and FFmpeg instead of the Node.js/Ink terminal interface.

Do not force a desktop Node.js tutorial into iSH.

## What iSH can and cannot do

- Public media URLs are supported when the upstream extractor supports them.
- iSH cannot read Safari, Chrome, or another iOS application's private browser database.
- Signing into a website in Safari does not sign iSH into that website.
- Large playlists, high-resolution merges, and background conversions may exceed iOS or iSH limits.

## Step 1: install packages

Inside iSH:

```sh
apk update
apk upgrade
apk add --no-cache python3 py3-pip ffmpeg curl ca-certificates
update-ca-certificates
python3 -m pip install -U --no-cache-dir --break-system-packages 'yt-dlp[default]' gallery-dl
```

## Step 2: install YTConv

Download the reviewed 1.6.2 installer from the final release branch:

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/release/ytconv-1.6.2-cli-only-final/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
```

The installer:

- confirms that it is running as root inside iSH/Alpine;
- installs Python, FFmpeg, certificates, yt-dlp, and gallery-dl;
- downloads `ish/ytconv.py` and `ish/ytconv-core.py` from the same reviewed 1.6.2 branch;
- validates Python syntax;
- installs files under `/usr/local/lib/ytconv-ish`;
- creates `/usr/local/bin/ytconv`;
- verifies the installed version.

## Step 3: verify

```sh
ytconv --version
ytconv --diagnose
```

Expected version:

```text
1.6.2
```

## Use

```sh
ytconv "URL"
ytconv download "URL"
ytconv playlist "URL"
ytconv batch links.txt --continue-on-error
ytconv info "URL"
ytconv formats "URL"
```

Default output:

```text
~/Downloads/YTConv
```

The folder can be accessed through Files → iSH.

## Stable behavior

The iSH core uses:

- public access first;
- ignored external extractor configuration;
- no remote JavaScript components;
- monochrome output;
- bounded retries;
- safe filenames;
- subtitle and archive behavior where the native frontend supports it.

Use `ytconv --help` for the exact iSH options.

## Safari login limitation

iOS sandboxing prevents iSH from reading browser cookies or starting the desktop managed-browser bridge. Use a supported desktop system for media that requires an authenticated browser session.

Do not export a long-lived browser cookie database into iSH as a workaround.

## Performance

- Prefer audio or 360p/720p on older devices.
- Process one URL at a time.
- Keep iSH in the foreground.
- Keep enough free storage for both source and converted files.
- Avoid large playlists and 4K merges.
- Resume an interrupted `.part` download by running the same command again when the upstream engine supports resume.

## Update

```sh
apk update
apk upgrade
python3 -m pip install -U --no-cache-dir --break-system-packages 'yt-dlp[default]' gallery-dl
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/release/ytconv-1.6.2-cli-only-final/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
```

## Troubleshooting

### `404 - page not found`

Use the absolute 1.6.2 documentation and installer links in this guide. Do not reuse a commit-specific link from an older npm README.

### `No space left on device`

Remove unwanted iSH files, lower media quality, and avoid formats that require simultaneous input and output copies.

### `Killed`

iOS likely reclaimed memory or background time. Keep iSH in the foreground and use a smaller item.

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

## More documentation

- [Node.js platform guide and iSH exception](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/NODEJS.md#iphone-and-ipad-with-ish)
- [Installation guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/INSTALL.md)
- [Troubleshooting](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/TROUBLESHOOTING.md)
