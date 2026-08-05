# Changelog

## 1.7.0 — 2026-08-05

### Repository and release integrity

- Migrated canonical source, issue, documentation, installer, checksum, SBOM, and release URLs to `andhikamarcella/YTConv`.
- Added npm Trusted Publishing through GitHub Actions OpenID Connect; the canonical release workflow no longer requires a long-lived npm token.
- Refreshed version identity across npm, iSH, Android, Windows, Linux, Alpine, Nix, Snap, Flatpak, Termux, portable archives, and CI matrices.

### Documentation and validation

- Added a comprehensive documentation hub covering installation, commands, configuration, authentication, troubleshooting, platforms, architecture, development, releases, trusted publishing, FAQ, and migration.
- Added `npm run docs:check` to reject stale repository URLs, missing guides, broken local Markdown links, and package-version drift.

### Compatibility

- Preserves existing commands, secure argument-array child processes, secret-stripped environments, browser-login recovery, animated progress, public-first access, and subtitles disabled by default.
- No existing command was intentionally removed or renamed.

# YTConv CLI changelog

## 1.6.8 - 2026-08-05

- Refreshed CLI, Android, installer, package, and native-build metadata for 1.6.8.
- Preserved the tested Figlet/Commander interface, animated progress, browser-login recovery, and subtitles-off defaults.
- Revalidated the npm package boundary, security suite, iSH checksums, desktop platforms, and native package matrix.

## 1.6.7 - 2026-08-05

### Terminal identity and progress

- Restored the responsive Figlet YTConv logo with compact fallbacks for narrow terminals.
- Added Commander-powered top-level help, examples, social-platform options, and browser-login guidance.
- Added animated link inspection, download, merge, extraction, remux, thumbnail, and conversion status.
- Added a clearer media card, progress bar, ETA/speed summary, completion screen, and retry/login recovery screens.

### Runtime discovery and security

- Restored exact pinned `which` and `isexe` runtime dependencies for executable discovery.
- Kept all child processes shell-free and restricted to executable plus argument arrays.
- Kept npm installation free of `preinstall`, `install`, and `postinstall` hooks.
- Added identity, progress, subtitle-default, dependency-lock, and Android metadata tests.

### Social platforms and browser login

- Preserved AUTO routing across YouTube, Instagram, Facebook, TikTok, X/Twitter, Pinterest, Reddit, Threads, Twitch, SoundCloud, Vimeo, Bilibili, Telegram, LinkedIn, Bluesky, and other yt-dlp/gallery-dl providers.
- Public access remains the first attempt.
- Official browser login is offered only after an authentication-related provider failure.
- Temporary browser cookie exports remain local and are removed after use.
- Subtitles remain disabled by default and require an explicit option or Ctrl+S.

### Android 2026 refresh

- Updated the Android application to version 1.6.7 and version code 10607.
- Replaced the old YouTube-only presentation with a social-media downloader interface.
- Added AUTO, MP4, and MP3 modes, visible download/conversion progress, cancellation, and output verification.
- Added a local WebView login flow for providers that require authentication.
- Added explicit `--no-write-subs` behavior so Android subtitles are not enabled automatically.
- Updated visible copyright and release metadata to 2026.

## 1.6.6 - 2026-08-05

- Added shell-free local command resolution and removed unnecessary dependency chains.
- Preserved the managed-browser loopback bridge and security capability documentation.
- Added cross-platform command-resolution and supply-chain tests.

## 1.6.5 - 2026-08-04

- Added Windows, Linux, Android, Termux, iSH, AppImage, Snap, Flatpak, Nix, DEB, RPM, Arch, and Alpine package automation.
- Repaired stale iSH and Alpine update paths and added checksum verification.
