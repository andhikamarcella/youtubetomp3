# Changelog

YTConv follows Semantic Versioning.

## 1.5.0-beta.2 — persistent workflow beta

### Added

- Persistent validated defaults in `~/.ytconv/config.json`.
- Named profiles with `profile set`, `list`, `show`, `use`, `clear`, and `delete`.
- One-run profile selection through `--profile NAME`.
- One-run clean execution through `--no-config`.
- Privacy-limited JSONL history for headless and batch runs.
- `history`, `history --json`, `history --limit`, and `history clear`.
- Shell-completion generation for Bash, Zsh, Fish, and PowerShell.
- `quickstart` beginner setup command.
- Tests that isolate config/history operations in temporary home directories.

### Beta defaults

- Subtitles enabled for video when not explicitly configured.
- SponsorBlock enabled in non-destructive `mark` mode.
- Separate automatic yt-dlp and gallery-dl archives per output profile.
- Opt-out flags: `--no-subtitles`, `--no-sponsorblock`, and `--no-archive`.

### Privacy and safety

- Config accepts only a documented allowlist of validated non-secret settings.
- History never stores cookie contents, tokens, or browser session data.
- Config writes use a temporary file and user-only permissions before an atomic rename.
- History is capped at 500 records.
- Cache cleanup preserves config, profiles, history, and download archives.
- Beta publishing stays on the npm `beta` tag and must not move `latest`.

### Changed

- All release documentation, installers, command help, validation, diagnostics, and primary runtime messages are English.
- Beta.2 is built from the 1.4.0 stable tree so it includes the stable Linux guide and cross-platform fixes.

## 1.4.0 — stable multi-platform release

### Added

- Complete English documentation and user-facing release guidance.
- Distribution-specific Linux instructions for apt, dnf, pacman, zypper, apk, xbps, emerge, Nix, and Homebrew systems.
- CMD, PowerShell, Linux, macOS, Alpine/musl, SSH/headless, Termux, and native iSH workflows.
- Playlist, batch, retry, resume, optional archives, metadata, cookies, format inspection, JSON automation, and diagnostics.

### Changed

- npm `latest` targets 1.4.0.
- Stable subtitles, SponsorBlock, and archives are opt-in.
- Unix npm installation uses a user prefix instead of `sudo npm install -g`.

### Fixed

- Windows self-update avoids directly spawning `npm.cmd`.
- PowerShell guidance uses `.cmd` shims where execution policy may interfere.
- Alpine/musl can use system FFmpeg.
- Output templates stay inside the selected output directory.
- JSON output is not mixed with update notices.
- Cache cleanup preserves archives.

## Earlier releases

- **1.3.0:** playlist, batch, retry, resume, metadata, cookies-from-browser, JSON automation, diagnostics, and broader distribution support.
- **1.2.3:** headless/SSH mode, repair, self-test, shell information, and platform fixes.
- **1.2.1:** Windows updater hotfix for `spawnSync npm.cmd EINVAL`.
- **1.2.0:** presets, SponsorBlock, subtitles, clipping, sidecars, proxy/rate controls, and broader formats.
- **1.1.x:** advanced formats, embedded cover art, YouTube Music square artwork, and early npm/Termux releases.
