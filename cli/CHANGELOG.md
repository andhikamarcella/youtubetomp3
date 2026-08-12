# Changelog

## 1.7.5 - 2026-08-12

- Refreshed the complete npm package manifest for the 1.7.5 release while preserving the CLI-only package boundary.
- Synchronized version-pinned repository, documentation, installer, checksum, SBOM, iSH, Android, and native-package metadata.
- Preserved exact production dependency pins, TypeScript declarations, npm Trusted Publishing provenance, and the ISC license.
- Preserved the optional Ko-fi and Saweria funding links as plain allowlisted HTTPS URLs.
- Added 1.7.5 migration guidance and release checks for the normalized author, maintainer, funding, documentation, and security metadata.
- Kept the 1.7.4 archive-recovery, authentication-classification, and Chromium-discovery fixes without changing runtime behavior.

## 1.7.4 - 2026-08-12

- Fixed the interactive terminal path so a default archive configured through the CLI environment participates in missing-file recovery.
- Fixed the archive recovery retry so an explicit empty archive setting overrides the environment instead of silently re-enabling the same archive.
- Added recovery when yt-dlp exits successfully with no matching file while an archive is active, even if quiet output hides the archive-skip message.
- Prevented the non-authentication explanation “cookies are not required” from being classified as a reason to open Google or provider login.
- Tightened authentication classification to require a positive login, cookie, private-media, or access-restriction signal.
- Added browser discovery through installed Chromium executables when a regular profile directory does not exist yet.
- Added deterministic regression coverage for the exact interactive failure: first pass exits `0` with no file, second pass runs without `--download-archive`, and a real MP4 is verified.
- Preserved public-first, no-cookie behavior for public media and kept login recovery for genuine account-only responses.

## 1.7.3 - 2026-08-12

- Added `ytconv donate` and the `N` interactive shortcut under the title **Donate — just pay what you can**.
- Added Ko-fi for global users and Saweria for users in Indonesia using two fixed, credential-free HTTPS URLs.
- Added a shell-free default-browser handoff for Windows, macOS, Linux, and Termux, followed by an automatic return to the YTConv home screen after five seconds.
- Added clipboard and complete-link fallbacks for terminals, iSH, headless sessions, and devices without a supported browser opener.
- Added npm `funding` metadata, a README section, a full donation guide, GitHub Pages instructions, and matching Wiki source.
- Expanded deterministic MP4, MKV, WebM, MP3, M4A, AAC, Opus, Vorbis, FLAC, ALAC, WAV, and 4K checks to ten repetitions in release CI.
- Added ten no-cookie metadata resolutions for the requested public YouTube URL and ten real public MP4 plus MP3 short-clip downloads for the release smoke test.
- Fixed misleading login advice after FFmpeg, codec, or network failures; account guidance now appears only for authentication-related responses.
- Preserved public-first access and safe browser-session recovery. Public media is not forced to use cookies, and account restrictions are not bypassed.

## 1.7.2 - 2026-08-10

- Fixed video selection for metadata-free direct and social formats while retaining bounded resolution preferences.
- Added a real FFmpeg integration matrix that converts eleven audio/video choices twice and verifies the 2160p path twice.
- Added `extract`/`content` and `transcript`/`text` commands for available subtitle and metadata output.
- Added optional local 720p, 1080p, 1440p, and 2160p/4K Lanczos upscaling without misrepresenting it as AI detail recovery.
- Preferred supported Deno runtimes for yt-dlp JavaScript execution with an explicit Node.js fallback.
- Added Windows, macOS, Termux, and Linux-family terminal accents plus support/footer information.
- Added cookies.txt, format, extraction, Deno, upscaling, distro, iSH, and support guides.
- Hardened the auto-update relaunch so sensitive environment values are stripped before starting the child process.
- Replaced the obsolete FFmpeg 6.1.1 fallback with the current SHA-256-verified `yt-dlp/FFmpeg-Builds` FFmpeg/ffprobe pair on supported Linux and Windows architectures.
- Updated the pinned Termux gallery-dl wheel to 1.32.9 and retained the current yt-dlp 2026.07.04 wheel with exact PyPI hashes.
- Fixed the Android build by using the current stable AppCompat 1.7.1 artifact; AppCompat 1.7.2 does not exist.
- Expanded the release-pinned installation, cookies, safety, Linux-family, iSH, GitHub Pages, and Wiki source documentation.

## 1.7.1 - 2026-08-06

- Restored stable `blob/HEAD/cli/docs/...` compatibility links on the repository default branch.
- Added `ytconv docs`, `ytconv docs --list`, topic aliases, and responsive documentation panels.
- Added `ytconv about` and `ytconv shortcuts` for clearer project discovery and interactive guidance.
- Added dedicated help-center documentation and migration guidance.
- Added automated help-center tests and expanded documentation validation.
- Refreshed CLI and native package identities to 1.7.1 without removing established commands.

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
