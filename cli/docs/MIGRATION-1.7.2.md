# Migrating to YTConv 1.7.2

## Upgrade

```bash
npm install -g ytconv@1.7.2
ytconv --version
ytconv --diagnose
```

## Stable documentation links

Version 1.7.2 keeps the compatibility path below on the repository default branch:

```text
https://github.com/andhikamarcella/YTConv/blob/HEAD/cli/docs/MIGRATION-1.7.0.md
```

Maintained CLI documentation remains release-pinned so it cannot accidentally follow the web branch:

```text
https://github.com/andhikamarcella/YTConv/tree/release/ytconv-1.7.2/cli/docs
```

## What changed

- fixed metadata-free direct/social video fallbacks;
- repeat-tested MP4, MKV, WebM, MP3, M4A, AAC, Opus, Vorbis, FLAC, ALAC, and WAV;
- added `extract` and `transcript` commands;
- added optional 720p–4K FFmpeg upscaling;
- prefers a supported Deno runtime and falls back to Node.js;
- added platform-aware terminal accents and a compact support footer;
- added beginner cookies, distro, runtime, format, and troubleshooting guides.

## Terminal help center

```bash
ytconv docs --list
ytconv docs migration
ytconv about
ytconv shortcuts
```

No established download, conversion, authentication, batch, profile, or package command is removed.
