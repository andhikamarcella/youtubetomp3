# Migration to YTConv 1.7.6

YTConv 1.7.6 is a backward-compatible quality, archive, cleanup, and terminal-theme fix. Existing download, conversion, donation, login, profile, history, documentation, and configuration commands remain available.

## Upgrade

```bash
npm install --global ytconv@1.7.6
ytconv --version
ytconv clean
ytconv doctor
```

The expected version is `1.7.6`. The one-time `clean` removes only YTConv-managed archives/caches and the yt-dlp extractor cache; it preserves downloaded media, settings, profiles, history, and custom archive paths.

## Native quality changes

Requests for a specific height now prioritize an exact-height stream before bounded compatibility fallbacks. For example, a native 2160p VP9/AV1 stream outranks a 1080p AVC stream when `--resolution 2160` is selected. This is normal source selection and does not use `--upscale`.

Default output names and automatic archive paths now include the requested mode, format, and quality. A 1080p download therefore cannot make a later 2160p request look complete or reuse the 1080p filename.

```bash
ytconv download "URL" --mode video --video-format mp4 --resolution 1080
ytconv download "URL" --mode video --video-format mp4 --resolution 2160
```

Custom `--output-template` and `--archive FILE` values remain explicit overrides.

## Cleanup and colors

`ytconv clean` now matches its name: it removes managed download archives plus update, error, and yt-dlp extractor caches. It never removes downloaded media or custom archive files.

The interactive interface restores Windows, macOS, Termux, and Linux-family accent colors after normal launch and auto-update relaunch. `--no-color`, `NO_COLOR`, non-TTY output, and dumb terminals remain monochrome.

See [Format guide](FORMAT-GUIDE.md), [Commands](COMMANDS.md), [Troubleshooting](TROUBLESHOOTING.md), [Installation](INSTALLATION.md), and [Safety and legal use](SAFETY-LEGAL.md).
