# YTConv CLI changelog

## 1.6.1 — documentation integrity and beginner installation repair

Released: 2026-08-03

### Documentation integrity

- Fixed the 404 errors caused when npm or GitHub rewrote relative README documentation links to a commit that did not contain the requested file.
- Replaced every published README documentation link with an absolute, versioned link to `release/ytconv-1.6.1-cli-only-final`.
- Added automated tests that reject relative `docs/` links, wrong release branches, and missing documentation targets.
- Added complete package metadata for the documentation index and beginner Node.js guide.
- Kept all documentation and runtime help in English.

### Beginner installation

- Added `docs/NODEJS.md` with beginner-first setup for Windows, macOS, Linux, WSL, SSH servers, Termux, Chromebook Linux, and the supported iSH exception.
- Made Node.js installation and verification the first step on every npm platform.
- Documented the supported baseline of Node.js 22.14.0 or newer and npm 10 or newer.
- Explained the Windows `.cmd` workaround without weakening PowerShell execution policy.
- Documented per-user npm prefixes instead of recommending `sudo npm install -g`.
- Clarified that iSH intentionally uses the maintained Python frontend and does not require Node.js.

### Platform fixes

- Updated Windows, Linux/macOS, Termux, iSH, universal Unix, CMD, and PowerShell installation paths to version 1.6.1.
- Pointed the iSH installer and its downloaded Python files to the reviewed 1.6.1 final branch.
- Preserved CLI-only packaging, monochrome normal output, red-only actionable errors, verified engine downloads, and cross-platform diagnostics.

## 1.6.0 — stable, verified, monochrome release

Released: 2026-08-03

### User interface

- Removed cyan, green, and yellow styling from the CLI and installers.
- Kept red exclusively for actual error states, with `NO_COLOR` support.
- Added responsive terminal calculations for 20–120+ columns and short iSH/Termux screens.
- Stacked URL input and conversion controls on narrow screens.
- Added live resize handling and sanitized untrusted terminal text.
- Fixed the resolution shortcut so one keypress advances exactly one value.

### Engines and dependencies

- Replaced the `ffmpeg-static` install script with an internal verified fallback downloader.
- Added GitHub Release digest, declared-size, repository URL, output-size, timeout, retry, private-mode, and atomic-write checks.
- Moved verified yt-dlp, gallery-dl, and FFmpeg executables to `~/.ytconv/engines`.
- Added automatic gallery-dl executable support for macOS.
- Preferred system FFmpeg when available and kept the verified static build as a fallback.
- Changed Python installation to `yt-dlp[default]` plus gallery-dl.
- Pinned all production npm dependencies to exact versions.
- Raised the npm CLI baseline to Node.js 22.14.0 and npm 10.
- Expanded dependency detection to Node.js, npm, Python, JavaScript runtimes, media engines, ffprobe, browsers, distribution, and package manager.

### Security

- Disabled external yt-dlp configuration and remote JavaScript components.
- Forced media-engine child output to monochrome mode.
- Added red-only error styling that is disabled for non-TTY output.
- Removed legacy cloud bearer-token storage and migrated profiles to a token-free local schema.
- Preserved the loopback-only managed browser, provider-domain filtering, user-only temporary cookie files, and cleanup on success/error.
- Added terminal escape and bidirectional-control sanitization.
- Added exact dependency, static-source, managed-browser, digest, package audit, and UI-style tests.
- Added npm provenance, SBOM generation, action SHA pinning, restricted workflow permissions, concurrency controls, and release verification.

### Release channel and documentation

- Made `latest` the only active updater and installer channel.
- Removed the old prerelease guide and prerelease publishing workflow from the stable source.
- Added complete English guides for Windows, Linux/macOS, Termux, iSH, dependencies, authentication, security, shells, troubleshooting, publishing, and release verification.
- Documented publisher identity without claiming a nonexistent organization.

### Compatibility

- Windows CMD, PowerShell, and Windows Terminal.
- macOS terminals.
- Debian/Ubuntu, Fedora/RHEL family, Arch family, openSUSE, Alpine, Void, Gentoo, NixOS, and other distributions with compatible Node/Python/FFmpeg packages.
- Android Termux for public URLs.
- iPhone/iPad iSH for public URLs through its Alpine/Python runtime.
- SSH, CI, cron, redirected output, and headless batch automation.

## 1.5.9 — managed Chromium browser bridge

- Added a dedicated provider login profile and a loopback-only DevTools bridge.
- Exported provider-domain cookies only to private temporary files.
- Verified the exact failed URL before persisting a browser reference.
- Added real Windows browser-bridge CI coverage and reliable browser shutdown.

## 1.5.8 — verified social login retry

- Opened official provider login pages automatically after authentication failures.
- Detected browser profiles, retried the exact URL, and saved the relationship only after success.
- Added mixed-media fallback for posts and carousels.

## 1.5.7 — automatic FFmpeg repair

- Added automatic FFmpeg recovery and Windows repair testing.
- Standardized runtime and documentation output in English.

## Earlier stable releases

Earlier releases introduced the Ink TUI, headless mode, batch execution, profiles, history, completion, Linux installers, gallery routing, subtitles, SponsorBlock, archives, metadata, and cross-platform shell support. Git history and immutable npm records retain their full audit trail.
