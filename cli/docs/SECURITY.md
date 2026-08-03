# YTConv 1.6.0 Security Guide

YTConv is a local CLI. It does not operate an account server, proxy media through a YTConv service, or promise that every upstream site is safe or available. No release can honestly guarantee “100% security” or zero bugs. Version 1.6.0 uses reproducible controls that can be tested and audited.

## Security boundaries

YTConv processes untrusted URLs, titles, filenames, extractor output, browser cookies, and downloaded media. Treat every source site and media file as untrusted. Use a normal unprivileged user account, keep the OS and Node.js supported, and do not run YTConv as root unless an iSH package installation explicitly requires it.

YTConv does not bypass DRM, paywalls, private-account permissions, geographic restrictions, or operating-system browser sandboxes.

## Supported runtime baseline

- Node.js `22.14.0` or newer is required for the npm CLI.
- npm `10` or newer is required; the release workflow pins npm `11.19.0`.
- Python is an optional fallback on desktop and is required by Termux/iSH.
- FFmpeg is required. ffprobe is recommended for deeper diagnostics.
- A local JavaScript runtime is passed to yt-dlp. YTConv disables remote JavaScript components.

Run:

```sh
ytconv --self-test
ytconv --shell-info
ytconv doctor
```

## Verified engine downloads

Desktop fallback engines are accepted only when all checks pass:

1. the release API belongs to the expected GitHub repository;
2. the asset URL uses HTTPS and the expected repository release path;
3. GitHub supplies a `sha256:` digest;
4. the downloaded bytes match both the digest and declared size;
5. minimum and maximum size limits pass;
6. compressed FFmpeg output stays below its expansion limit;
7. the file is written privately to a random temporary name;
8. atomic replacement completes; and
9. the executable passes its version command.

Verified engines live under `~/.ytconv/engines`. YTConv refuses unverifiable release assets instead of silently trusting them.

## Extractor isolation

yt-dlp runs with:

```text
--ignore-config
--no-colors
--no-remote-components
```

This prevents a system/user yt-dlp configuration from silently changing YTConv behavior and prevents runtime component downloads. gallery-dl also ignores external configuration. Child output is stripped of terminal escape sequences before display.

## Terminal safety and color policy

Normal output is monochrome. Only error states may be red on an interactive terminal. Redirected output, `NO_COLOR`, `FORCE_COLOR=0`, and `TERM=dumb` disable error color.

ANSI/OSC control sequences, C0/C1 controls, and bidirectional override controls are removed from external text before display. This reduces terminal-link spoofing, cursor movement, and misleading filename/title rendering.

## Browser-session model

For account-required desktop media, YTConv opens the provider’s official login URL in a dedicated Chromium profile or uses a supported local browser profile.

- DevTools binds to `127.0.0.1` on an ephemeral port.
- WebSocket commands refuse non-loopback endpoints.
- Extensions, browser sync, and background mode are disabled for the managed profile.
- Passwords and OTP/2FA codes are entered only in the provider’s browser page.
- Only cookies matching the chosen provider’s domain allowlist are exported.
- Provider authentication cookies must exist before the session is called verified.
- A random `0600` temporary cookie file is used for one attempt and its directory is removed in cleanup.
- Persistent YTConv state stores only the provider/browser reference; it is not a cookie database.

Android and iOS sandbox browser data from Termux and iSH. YTConv does not circumvent that boundary.

## Local profile migration

`ytconv account login` creates an optional token-free local display profile. Version 1.6.0 deletes legacy cloud bearer-token sessions and removes stored email/token fields during migration. Public downloads and social-site login do not require this profile.

Local state:

```text
~/.ytconv/auth.json             optional token-free profile
~/.ytconv/social-sessions.json provider/browser references
~/.ytconv/browser-profiles/     dedicated managed browser profiles
~/.ytconv/engines/              verified executables
~/.ytconv/archives/             download archives
```

Directories use user-only permissions where the OS supports Unix modes. Sensitive temporary filenames contain cryptographically random values.

## Secret handling

Do not put cookies, passwords, OTP codes, npm tokens, GitHub tokens, or authenticated URLs in bug reports. Browser child processes do not receive common `NPM_TOKEN`, `NODE_AUTH_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN`, or legacy YTConv bearer-token environment variables.

For CI, use repository/environment secrets and least-privilege permissions. The release workflow requests `contents: write` and `id-token: write` only for publishing and release provenance. CI verification uses `contents: read`.

## npm supply-chain controls

- Production dependencies use exact versions.
- `npm audit --omit=dev` must pass.
- Registry signatures are audited in the release workflow.
- npm publication uses `--provenance` and GitHub OIDC.
- GitHub Actions use full commit SHA pins.
- A CycloneDX SBOM, SHA-256 list, release metadata, and exact npm tarball are attached to the GitHub Release.
- The npm tarball allowlist rejects web/server assets.

Provenance proves where and how a package was built; it does not prove that all source code is bug-free or non-malicious.

## Safe reporting

Before reporting a problem:

```sh
NO_COLOR=1 ytconv --version
NO_COLOR=1 ytconv --shell-info
NO_COLOR=1 ytconv doctor
```

Redact home paths, usernames, media URLs, proxy addresses, cookie paths, and account names. Never attach `auth.json`, `social-sessions.json`, browser profiles, cookies, or environment dumps.

Security reports should use the repository’s private security-reporting channel when available. For ordinary bugs, open a GitHub issue with a minimal public URL and sanitized diagnostic output.
