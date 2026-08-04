# AGENTS.md

## Scope

These instructions apply to the YTConv CLI release source. YTConv is a Node.js ESM CLI with a maintained Python frontend for iSH. Keep the published npm package CLI-first, cross-platform, and free of unrelated web application code.

## Runtime and compatibility

- Support Node.js 22.14.0 or newer on Windows, macOS, Linux, WSL, SSH, Chromebook Linux, and Termux.
- Keep the iSH Python frontend compatible with Python 3 and Alpine Linux.
- Preserve Windows CMD and PowerShell behavior as well as POSIX shells.
- Do not introduce a required cloud account, telemetry, analytics, advertisements, or remote configuration.

## Supply-chain security

- Do not add npm lifecycle hooks such as `preinstall`, `install`, or `postinstall` to the published package.
- Never use `eval`, `Function`, `child_process.exec`, `shell: true`, or string-built shell commands.
- Use `spawn`, `spawnSync`, `execFile`, or `execFileSync` with an executable and a separate argument array.
- Never pass the complete ambient environment to a child process. Use the scrubbed child environment helper and explicitly remove package tokens, repository tokens, credentials, and proxy secrets that are not required.
- Keep runtime network access limited to:
  - the media URL explicitly supplied by the user through yt-dlp or gallery-dl;
  - npm registry metadata used for an optional update check;
  - allowlisted GitHub release APIs and release assets used for verified media-engine repair;
  - official provider pages opened for an explicit user-requested browser login.
- Engine downloads must use HTTPS, an allowlisted repository, an exact expected asset name, GitHub-provided SHA-256 verification, declared-size validation, strict maximum-size limits, timeouts, retries, private file modes, and atomic replacement.
- Never download or execute code during `npm install`. Dependency preparation belongs to explicit `ytconv repair` or first-use runtime repair with visible status.
- Do not read browser passwords, OTP codes, npm tokens, GitHub tokens, SSH keys, or arbitrary files outside YTConv state and the user-selected output path.
- Public media must not require a cookies.txt file. Restricted, private, age-gated, or account-only media may require the official browser-login flow; do not claim that authentication can always be bypassed.
- Keep the canonical ISC license text in `cli/LICENSE` and `license: ISC` in package metadata.

## Filesystem boundaries

- Store YTConv-managed state under `~/.ytconv` with user-only permissions where supported.
- Write downloads only under the resolved user-selected output directory.
- Validate paths before deletion, replacement, archive recovery, cache cleanup, or engine installation.
- Use atomic temporary files for downloaded executables and sensitive state.

## MP4 behavior

- Regular public YouTube AUTO mode resolves to video and defaults to MP4.
- YouTube Music AUTO mode resolves to MP3 audio.
- Explicit audio, video, image, container, format, and resolution selections always win.
- MP4 selection must prefer AVC/H.264 video plus M4A audio, retain broad fallbacks, and use FFmpeg conversion when the selected streams cannot be safely remuxed.
- Exit code zero is not success unless a real mode-matching output file exists.
- Add deterministic tests for selectors, container arguments, public no-cookie arguments, archive recovery, and zero-output rejection whenever this path changes.

## TypeScript declarations

- Runtime source may remain modern JavaScript ESM.
- Keep the public programmatic API intentionally small and side-effect free.
- Update `cli/types/index.d.ts`, package `types`/`exports`, and type-check tests whenever a public export changes.
- Do not add declarations solely to display a badge; declarations must match real JavaScript exports.

## Required validation

Run from `cli/` after code changes:

```sh
npm install --ignore-scripts
npm run check
npm run typecheck
npm test
npm run check:ish
npm run test:ish
npm run security
npm pack --ignore-scripts --dry-run
```

Also verify on the supported CI matrix:

- Node.js 22.14, 24, and current;
- Ubuntu, macOS, and Windows;
- Alpine/iSH compatibility;
- a real public YouTube MP4 smoke test without cookies;
- package contents, license recognition, provenance, SBOM, and registry tarball checksum.

## Release policy

- Published npm versions and GitHub tags are immutable.
- Use a new patch version for every published fix.
- Update package metadata, lockfile, README, changelog, iSH version files, installers, tests, CI, publish workflow, tarball URLs, and versioned documentation links together.
- Prefer npm trusted publishing with OIDC and provenance over long-lived write tokens. Keep release builds uncached and require an npm deployment environment approval when configured.
- Do not promise zero bugs or permanent compatibility with third-party services. State verified behavior and known external limitations precisely.
