# YTConv security policy

## Supported release

Security fixes are applied to the current npm `latest` release. YTConv versions and GitHub release tags are immutable; a fix is published as a new patch version.

## Reporting a vulnerability

Open a private GitHub security advisory when available. Never place credentials, browser cookies, npm tokens, private media URLs, or personal data in a public issue. Include the affected YTConv version, operating system, Node.js version, reproduction steps, and the smallest safe proof of concept.

## Expected capabilities

Automated scanners may report network, filesystem, environment, URL, and child-process capabilities. They are expected for a local media downloader but are intentionally bounded.

### Network access

YTConv accesses:

- the media URL supplied by the user;
- npm registry metadata for optional update checks;
- allowlisted HTTPS release endpoints for verified media-engine repair;
- official provider login pages after an explicit login command or an authentication-related provider failure.

YTConv contains no telemetry, analytics, advertisements, credential collection, or hidden remote configuration.

### Child-process access

YTConv launches verified yt-dlp, gallery-dl, FFmpeg, ffprobe, Python, an operating-system package manager during explicit repair, and the user's browser during login recovery.

Executables are resolved with pinned `which` and `isexe` packages and launched with separate argument arrays. The source and supply-chain tests reject:

- `child_process.exec`;
- `shell: true`;
- `eval` or `new Function`;
- dynamically constructed shell command strings;
- unfiltered `process.env` forwarding.

### Filesystem access

Filesystem writes are limited to:

- the user-selected output directory;
- YTConv configuration, history, cache, and verified engine storage;
- short-lived cookie exports used for one authenticated media attempt;
- package-manager files during explicit repair or native package installation.

Temporary cookie files are created with restricted permissions where the platform supports them and are deleted after use.

### Environment-variable access

YTConv reads documented `YTCONV_*`, `NO_COLOR`, terminal, home-directory, and platform variables. Secrets are not placed in command arguments and are removed from child-process environments unless a specific operation requires them.

## Browser login model

Public access is always attempted first in AUTO mode. Browser login is not opened for every download.

When a provider reports an authentication-related failure:

1. YTConv opens the provider's official login page in the user's normal browser or the Android application's local WebView.
2. Passwords, OTP codes, and 2FA responses remain inside that browser surface.
3. YTConv verifies the exact requested media URL with a temporary cookie export.
4. The temporary export is deleted after the attempt.

Users should keep browser profiles and cookie files private. Cookie files must never be committed to Git, uploaded to public issues, or shared with support staff.

## Android WebView model

The Android 1.7.1 login window enables JavaScript and DOM storage because modern provider login pages require them. It loads only the provider login URL derived from the user's media URL. Cookies are exported to the application cache, passed to yt-dlp for the requested operation, and removed when the activity closes.

## Subtitles

Subtitles are disabled by default in interactive, headless, iSH, Termux, and Android flows. They are enabled only by an explicit user option such as `--subtitles` or Ctrl+S.

## Runtime dependencies in 1.7.1

All runtime dependencies use exact versions in both `package.json` and `package-lock.json`:

- Commander 14.0.3 for top-level command help;
- Figlet 1.11.4 for the responsive terminal identity;
- Ink 7.1.1 and React 19.2.8 for the terminal interface;
- which 6.0.0 and isexe 3.1.5 for executable discovery and validation;
- ws 8.21.1 for the loopback-only managed-browser DevTools bridge.

These dependencies do not add npm lifecycle installation hooks. The release pipeline runs syntax checking, TypeScript checking, CLI tests, iSH checks, security tests, npm audit, package-content validation, and native package builds.

## npm installation policy

The package does not define `preinstall`, `install`, or `postinstall` scripts. `prepack` runs validation only and does not download or execute third-party installers.

## Release integrity

Official release automation produces:

- an npm tarball with provenance;
- CycloneDX SBOM data;
- SHA-256 checksums;
- native package artifacts built from the same source commit;
- registry-byte verification after publication.

Do not treat third-party mirrors or repackaged binaries as official YTConv releases.
