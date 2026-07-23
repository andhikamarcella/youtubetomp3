# Changelog

YTConv follows Semantic Versioning.

## 1.4.0 — stable multi-platform release

### Added

- Complete English documentation and user-facing release guidance.
- Distribution-specific Linux installation instructions for apt, dnf, pacman, zypper, apk, xbps, emerge, Nix, and Homebrew systems.
- Verified workflows for CMD, PowerShell, Linux, macOS, Alpine/musl, SSH/headless, Termux simulation, and native iSH.
- Beginner-friendly `download`, `playlist`, `batch`, `info`, `formats`, `subtitles`, `doctor`, `repair`, `clean`, and `update` commands.
- Playlist ranges, maximum-download limits, skip-after-errors, batch workers, JSON reports, retry controls, resume, and download archives.
- Transparent source-format inspection with codec, resolution, FPS, bitrate, protocol, and estimated size when available.
- Metadata overrides for artist, title, album, track, year, and genre.
- Browser-cookie support for desktop browsers supported by yt-dlp.
- Stable exit codes for scripting and automation.

### Changed

- The npm `latest` channel now targets YTConv 1.4.0.
- Stable defaults are conservative: subtitles, SponsorBlock, and download archives are opt-in.
- Update failures never block normal use or remove the previous installation.
- npm global installation instructions use a user prefix on Unix systems instead of `sudo npm install -g`.

### Fixed

- Windows self-update avoids spawning `npm.cmd` directly.
- PowerShell documentation consistently uses `npm.cmd` and `ytconv.cmd` where execution policy may interfere.
- Test discovery uses Node's built-in runner and works across Windows and Unix shells.
- Alpine/musl uses system FFmpeg when a bundled glibc binary is incompatible.
- Output templates are constrained to the selected output directory.
- JSON automation output is kept separate from update notices.
- Cache cleanup preserves download archives.

## 1.3.0

- Playlist, batch, retry, resume, metadata, cookies-from-browser, JSON automation, diagnostics, and expanded distribution support.

## 1.2.3

- Headless/SSH mode, dependency repair, self-test, shell information, clearer errors, and CMD/PowerShell/Termux/iSH improvements.

## 1.2.1

- Windows updater hotfix for `spawnSync npm.cmd EINVAL`.

## 1.2.0

- Presets, SponsorBlock, subtitles, clipping, metadata sidecars, proxy/rate controls, validated output templates, and broader format support.

## 1.1.x

- Advanced audio/video formats, thumbnail and cover embedding, YouTube Music square artwork, Termux fixes, and initial npm releases.
