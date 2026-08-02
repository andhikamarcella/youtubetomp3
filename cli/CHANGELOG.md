# Changelog

YTConv follows Semantic Versioning.

## 1.5.7 — reliable FFmpeg repair and English documentation

### Fixed

- `ytconv repair` now reruns the package-owned `ffmpeg-static` installer when the executable is missing, truncated, or fails its version check.
- Windows repair invokes the installer through Node.js, avoiding PowerShell execution-policy and `.cmd` spawning problems.
- Repair verifies the restored FFmpeg executable before reporting that setup is complete.
- Post-install and first-run setup retry the same verified repair path automatically.

### Changed

- All CLI runtime messages, setup prompts, social-login guidance, errors, and documentation are written in English.
- Troubleshooting now explains automatic repair first and provides a precise reinstall fallback only when automatic recovery fails.
- Stable release CI removes the installed Windows FFmpeg binary and proves that YTConv downloads and restores it.

### Packaging

- The npm tarball remains CLI-only and contains no HTML, CSS, JSX, TSX, web application, API server, or deployment asset.
- Stable remains on the npm `latest` tag; `1.6.0-beta.1` remains on `beta`.

## 1.5.6 — automatic setup, updates, and official social login

### Added

- `ytconv login instagram`, `facebook`, `x`, `tiktok`, `youtube`, `pinterest`, `reddit`, `threads`, `twitch`, and other supported providers.
- Official login pages open in a locally detected browser; saved provider bindings are selected automatically for matching links.
- `ytconv social status`, `ytconv logout PROVIDER`, and `ytconv social logout --all` for local account-binding management.
- Automatic stable-channel update checks and installation for interactive sessions, with a safe one-time relaunch after success.
- Human-readable login hints derived from the failed media URL.

### Changed

- FFmpeg is now a required npm dependency instead of an optional dependency, preventing incomplete Windows installs when optional packages are omitted.
- Direct, headless, and interactive downloads all attempt dependency repair automatically before reporting a missing-engine error.
- A YTConv cloud profile is optional; the CLI can download public media or use linked browser sessions without a web account server.
- The setup screen names the exact missing engines and provides a direct repair command.

### Security and privacy

- Passwords, OTP codes, OAuth secrets, access tokens, and raw cookies are never collected or uploaded by YTConv.
- Site sessions remain in the official browser database and are protected by the browser/operating-system encryption.
- `~/.ytconv/social-sessions.json` stores only the provider name and browser/profile reference and uses user-only permissions on Unix-like systems.
- Social login does not bypass private-account permissions, DRM, paywalls, or source-site access controls.

## 1.5.5 — reliable login fallback and complete package metadata

### Added

- A private local CLI profile fallback when the configured cloud account endpoint is unavailable or not deployed.
- `ytconv login --local` to select local mode immediately and `ytconv login --cloud-only` to require remote authentication.
- Automatic return to the interactive YTConv interface after a successful terminal login; `--no-launch` keeps command-only behavior.
- Account and authentication mode badges in the TUI.
- Explicit publisher, author, license, release date, release notes, installer URL, checksum location, artifact metadata location, engine requirements, and dependency metadata.
- A release artifact record containing the packed tarball URL, SHA-256, SHA-512 integrity, packed size, unpacked size, dependency list, and release notes.

### Changed

- Refreshed terminal focus, progress, success, error, setup, help, and diagnostics styling.
- npm homepage and documentation now point to the CLI release instead of the web converter.
- The published package is explicitly CLI-only and is validated to contain no HTML, CSS, JSX, TSX, or web frontend assets.
- Account documentation now covers CLI behavior only.

### Fixed

- Stable self-test incorrectly expected `1.5.0-beta.2` and the npm `beta` update channel.
- Stable examples and help still used beta labels and hard-coded beta version text.
- A missing `/api/cli-auth/device` deployment previously prevented every new user from entering the CLI.
- Login previously exited to the shell instead of returning to the TUI.

### Preserved

- Cloud device-code authentication remains supported when a valid account API is configured.
- Existing downloads, conversion engines, profiles, history, playlists, batch mode, retry/resume, metadata, cookies, subtitles, SponsorBlock, and cross-platform installers remain intact.

## 1.5.0 — account-protected stable release

### Added

- Required browser-based device login before any download or conversion.
- Shared login flow for Windows, Linux, macOS, Termux, SSH, and native iSH/Python shells.
- `ytconv login`, `ytconv auth status`, `ytconv whoami`, and `ytconv logout`.
- Google sign-in and a dedicated `/cli-login` device approval page.
- Secure device-code, token exchange, validation, and revocation API endpoints.
- Server-side access-token hashing, AES-256-GCM protection for temporary token delivery, expiry, and device metadata.
- Account session storage in `~/.ytconv/auth.json` with user-only permissions on Unix-like systems.
- Complete account setup and deployment documentation in `docs/AUTH.md`.

### Fixed

- Public X/Twitter media now tries yt-dlp before gallery-dl instead of stopping after an empty gallery result.
- gallery-dl exit code 0 with zero new files is no longer reported as a successful conversion unless an archive intentionally skipped an existing item.
- Login-only X/Twitter posts now produce clearer cookies guidance while retaining yt-dlp/gallery-dl fallback behavior.

### Preserved from 1.5.0-beta.2

- Persistent validated defaults in `~/.ytconv/config.json`.
- Named profiles, history, shell completion, quickstart, playlist, batch, retry, resume, archives, subtitles, SponsorBlock, metadata, and multi-platform installers.
- Subtitles enabled by default for video, SponsorBlock in non-destructive mark mode, and separate archives per output profile.

### Security

- Device codes expire after ten minutes and access tokens after ninety days.
- Long-lived raw tokens are not stored in the database.
- Help, version, diagnostics, repair, update, configuration, profiles, and history remain available before login.
- `logout` revokes the server token and deletes the local session.

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
