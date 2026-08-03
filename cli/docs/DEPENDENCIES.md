# YTConv 1.6.0 Dependency Guide

## Required and recommended components

| Component | Status | Purpose | Detection |
|---|---|---|---|
| Node.js 22.14+ | Required for npm CLI | CLI, TUI, local JavaScript runtime | `node --version`, `ytconv doctor` |
| npm 10+ | Required for installation/update | Installs `ytconv@latest` | `npm --version` |
| yt-dlp | Required | Video/audio extraction | executable, Python module, or verified YTConv engine |
| gallery-dl | Required | Images, posts, galleries, mixed media | executable, Python module, or verified YTConv engine |
| FFmpeg | Required | Conversion, merging, remuxing, metadata | system executable or verified YTConv engine |
| ffprobe | Recommended | Media inspection | system executable |
| Python 3 | Fallback; required on Termux/iSH | Python engine modules | `python3`/`python`/Windows `py` |
| Desktop browser | Optional | Account-required official login | detected Chrome, Edge, Firefox, Brave, Chromium, and supported variants |
| Deno/Bun/QuickJS | Optional | Alternative local JS runtime | PATH detection |

## Automatic desktop setup

Run:

```sh
ytconv repair
ytconv doctor
```

YTConv prefers valid system executables, then Python modules, then verified desktop release assets where available. Executables are stored in `~/.ytconv/engines`, not inside the npm installation.

## Python fallback

```sh
python3 -m pip install --user -U --no-cache-dir 'yt-dlp[default]' gallery-dl
```

On an externally managed Python environment, use an OS package, `pipx`, a virtual environment, or the documented distribution-specific `--break-system-packages` fallback only when you understand that Python policy.

## JavaScript runtime

Current yt-dlp extraction for major sites can require JavaScript. The npm CLI uses its supported Node.js executable as a local runtime and passes its exact path to yt-dlp. YTConv does not enable yt-dlp remote components.

## Interpreting doctor

`Status: ready to use.` means yt-dlp, gallery-dl, and FFmpeg are usable. Recommended items such as ffprobe, Python fallback, or a desktop browser can be missing without blocking public URLs.

Use:

```sh
ytconv --shell-info
ytconv --self-test
ytconv doctor
```

These commands report the resolved executable path, version, engine mode, distro, package manager, and setup suggestion. If a path is unexpected, fix PATH and rerun with a clean terminal.

## Update dependencies

```sh
npm install -g ytconv@latest --force
ytconv repair
ytconv doctor
```

Termux/iSH update their Python modules separately:

```sh
python -m pip install -U 'yt-dlp[default]' gallery-dl
```
