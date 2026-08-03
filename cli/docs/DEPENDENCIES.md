# YTConv 1.6.2 Dependency Guide

## Install Node.js before YTConv

On Windows, macOS, desktop Linux, WSL, SSH servers, and Termux, install and verify Node.js before running any npm installation command.

Beginner tutorial: [Install Node.js Before YTConv](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/NODEJS.md).

Required baseline:

```text
Node.js 22.14.0 or newer
npm 10 or newer
```

Verify:

```sh
node --version
npm --version
```

iSH is the supported exception. It uses the native Python frontend and does not require Node.js.

## Required and recommended components

| Component | Status | Purpose | Detection |
|---|---|---|---|
| Node.js 22.14+ | Required for npm CLI | CLI, TUI, local JavaScript runtime | `node --version`, `ytconv doctor` |
| npm 10+ | Required for npm installation and updates | Installs `ytconv@latest` | `npm --version` |
| yt-dlp | Required | Video and audio extraction | executable, Python module, or verified YTConv engine |
| gallery-dl | Required | Images, posts, galleries, mixed media | executable, Python module, or verified YTConv engine |
| FFmpeg | Required | Conversion, merging, remuxing, metadata | system executable or verified YTConv engine |
| ffprobe | Recommended | Media inspection | system executable |
| Python 3 | Fallback; required on Termux and iSH | Python engine modules and native iSH frontend | `python3`, `python`, or Windows `py` |
| Desktop browser | Optional | Official account-required login | Chrome, Edge, Firefox, Brave, Chromium, and supported variants |
| Deno, Bun, or QuickJS | Optional | Alternative local JavaScript runtime | PATH detection |

## Automatic desktop setup

After YTConv is installed:

```sh
ytconv repair
ytconv doctor
```

YTConv prefers valid system executables, then Python modules, then verified desktop release assets where available. Verified executables are stored under `~/.ytconv/engines`, outside the npm package directory.

## Python fallback

```sh
python3 -m pip install --user -U --no-cache-dir 'yt-dlp[default]' gallery-dl
```

For an externally managed Python environment, use a distribution package, pipx, virtual environment, or the documented `--break-system-packages` fallback only when appropriate for that environment.

## JavaScript runtime

Some extraction paths require local JavaScript execution. The npm CLI uses its supported Node.js executable and passes the exact local runtime path to yt-dlp. YTConv does not enable yt-dlp remote components.

## Interpreting `doctor`

`Status: ready to use.` means yt-dlp, gallery-dl, and FFmpeg are usable. Recommended components such as ffprobe, a Python fallback, or a desktop browser can be absent without blocking every public URL.

```sh
ytconv --shell-info
ytconv --self-test
ytconv doctor
```

These commands report the resolved executable path, version, engine mode, distribution, package manager, and setup suggestion.

## Update dependencies

Desktop npm platforms:

```sh
npm install -g ytconv@latest --force
ytconv repair
ytconv doctor
```

Termux:

```sh
pkg update
pkg upgrade -y
python -m pip install -U 'yt-dlp[default]' gallery-dl
npm install -g ytconv@latest --omit=optional --force
```

iSH:

```sh
apk update
apk upgrade
python3 -m pip install -U --no-cache-dir --break-system-packages 'yt-dlp[default]' gallery-dl
```

Then rerun the absolute 1.6.2 iSH installer documented in the [iSH guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/ISH.md).
