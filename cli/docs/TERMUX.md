# YTConv 1.6.2 on Android Termux

## Supported environment

Use a current Termux release from F-Droid or the official Termux GitHub project. Obsolete store builds may have outdated package metadata.

Android application sandboxing prevents Termux from reading private Chrome, Firefox, or other browser databases. Public URLs are supported; account-required social media may require a desktop system.

## Step 1: install Node.js first

```sh
pkg update
pkg upgrade -y
pkg install -y nodejs python ffmpeg curl ca-certificates
node --version
npm --version
```

YTConv requires Node.js 22.14.0 or newer and npm 10 or newer. If the version is too old, update the Termux repositories and packages before continuing.

Full beginner guide: [Node.js on Termux](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/NODEJS.md#android-with-termux).

## Step 2: prepare storage and fallback engines

```sh
termux-setup-storage
python -m pip install -U --no-cache-dir 'yt-dlp[default]' gallery-dl
```

Accept the Android storage permission.

## Step 3: install YTConv

```sh
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --omit=optional --force
ytconv --version
ytconv repair
ytconv --self-test
ytconv --shell-info
ytconv doctor
```

Expected version:

```text
1.6.1
```

## Output directory

Default shared output:

```text
~/storage/downloads/YTConv
```

Configure it explicitly:

```sh
ytconv config set output "$HOME/storage/downloads/YTConv"
```

When storage links are missing:

```sh
termux-setup-storage
ls -la "$HOME/storage/downloads"
```

## Responsive interface

YTConv stacks controls on narrow screens and removes decoration when the terminal height is limited. Use headless mode when the interactive interface is inconvenient:

```sh
ytconv --headless download "URL"
```

Normal output remains monochrome; only actionable errors may be red. Disable color completely:

```sh
NO_COLOR=1 ytconv doctor
```

## Download examples

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

Use one job on memory-constrained devices.

## Keep Termux alive

For a long authorized download:

```sh
termux-wake-lock
ytconv --headless download "URL"
termux-wake-unlock
```

Android may still stop background work under aggressive battery management.

## Update

```sh
pkg update
pkg upgrade -y
python -m pip install -U --no-cache-dir 'yt-dlp[default]' gallery-dl
npm install -g ytconv@latest --omit=optional --force
ytconv --version
ytconv repair
ytconv doctor
```

## Common failures

### `node` or `npm` is not found

```sh
pkg update
pkg upgrade -y
pkg install -y nodejs
hash -r
node --version
npm --version
```

### Shared-storage permission is denied

Run `termux-setup-storage`, accept the Android prompt, and use `~/storage/downloads`.

### npm global permission error

Termux normally uses a user-owned prefix:

```sh
npm config get prefix
command -v npm
command -v ytconv
```

Do not use `sudo` in standard Termux.

### Browser login does not work

This is an Android sandbox boundary. A Chrome login does not expose the browser cookie database to Termux.

### The process is slow or killed

Reduce resolution, use `--jobs 1`, keep enough free storage, avoid simultaneous conversions, and keep Termux in the foreground when possible.

## More documentation

- [Node.js guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/NODEJS.md)
- [Installation guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/INSTALL.md)
- [Troubleshooting](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/TROUBLESHOOTING.md)
