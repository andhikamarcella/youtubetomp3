# Architecture

YTConv separates command parsing, provider and engine orchestration, process execution, authentication recovery, progress rendering, configuration, history, and packaging.

## Security boundaries

- Child processes are launched with executable-and-argument arrays and `shell: false`.
- Sensitive environment variables are removed before child processes start.
- Network access is limited to user-requested provider URLs, npm metadata, and allowlisted HTTPS engine endpoints.
- Cookie exports are temporary and should be private to the current user.
- Telemetry is disabled.

## Engines

yt-dlp, gallery-dl, and FFmpeg provide provider extraction and media processing. YTConv validates their presence and coordinates them, but it does not replace provider authorization.

## State

User configuration, profiles, history, caches, archives, and temporary authentication material are kept under user-scoped locations. Secrets must never be written into repository files or diagnostic reports.

## Packaging

The repository contains npm, native Linux, Alpine, Nix, Snap, Flatpak, Termux, Windows, portable, Android, and iSH packaging paths. Release workflows must keep every version identity synchronized.
