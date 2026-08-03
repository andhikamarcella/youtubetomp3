# YTConv 1.6.0 on Android Termux

## Supported environment

Use a current Termux release from F-Droid or the official GitHub repository. Obsolete store builds have outdated package metadata and are not supported.

Termux supports public URLs. Android application sandboxing prevents Termux from reading Chrome, Firefox, or other browser private databases. Account-required social media should be processed on desktop.

## Install

```sh
pkg update && pkg upgrade -y
pkg install -y nodejs python ffmpeg curl ca-certificates
termux-setup-storage
python -m pip install -U --no-cache-dir 'yt-dlp[default]' gallery-dl
npm install -g ytconv@latest --force
```

Accept the Android storage permission. Then:

```sh
ytconv --version
ytconv repair
ytconv --self-test
ytconv --shell-info
ytconv doctor
```

The version must be `1.6.0`. Required dependencies must be ready.

## Output directory

Default shared output:

```text
~/storage/downloads/YTConv
```

Configure another directory:

```sh
ytconv config set output "$HOME/storage/downloads/YTConv"
```

If storage links are missing:

```sh
termux-setup-storage
ls -la "$HOME/storage/downloads"
```

## Responsive interface

YTConv stacks the URL field and conversion button on narrow screens and removes decorative/help rows when terminal height is limited. Rotate the device, pinch terminal font size, or run headless when the TUI is inconvenient:

```sh
ytconv --headless download "URL"
```

Normal output remains monochrome; only errors may be red. Disable even error red:

```sh
NO_COLOR=1 ytconv doctor
```

## Downloads

```sh
ytconv download "URL"
ytconv download "URL" --preset mobile
ytconv download "URL" --mode audio --audio-format mp3
ytconv playlist "URL" --playlist-items 1-10
```

Batch:

```sh
printf '%s\n' "URL1" "URL2" > links.txt
ytconv batch links.txt --jobs 1 --continue-on-error --result-json report.json
```

Use one job on memory-constrained devices. FFmpeg conversion can be CPU-intensive and may be stopped by Android background restrictions.

## Keep Termux alive

For a long authorized download:

```sh
termux-wake-lock
ytconv --headless download "URL"
termux-wake-unlock
```

Exclude Termux from aggressive battery optimization if Android repeatedly kills the process. This is an OS setting, not a YTConv security bypass.

## Update

```sh
pkg update && pkg upgrade -y
python -m pip install -U --no-cache-dir 'yt-dlp[default]' gallery-dl
npm install -g ytconv@latest --force
ytconv repair
ytconv doctor
```

## Common failures

### `Permission denied` under shared storage

Run `termux-setup-storage`, accept permission, and use `~/storage/downloads` rather than guessing an Android filesystem path.

### npm global permission error

Termux normally uses a user-owned prefix. Inspect it:

```sh
npm config get prefix
command -v npm
command -v ytconv
```

Do not use `sudo`; standard Termux does not require it.

### Browser login does not work

This is an Android sandbox boundary. Logging into Chrome does not make its private cookie database readable from Termux. Use public URLs or run the account-required URL on Windows, macOS, or desktop Linux.

### Process is slow or killed

Reduce resolution, use `--jobs 1`, keep free storage, avoid simultaneous conversions, and use a foreground wake lock. Some devices lack enough memory for large playlists or 4K merges.
