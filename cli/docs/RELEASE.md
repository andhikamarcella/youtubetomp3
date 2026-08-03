# YTConv 1.6.2 Stable Release Checklist

## 1. Confirm scope and base

- Base is the published 1.6.0 stable CLI release.
- Version is exactly `1.6.1` with no prerelease suffix.
- Scope is the CLI package, stable CLI workflows, documentation, installers, tests, and release metadata.
- No website, API server, Express route, credentials, cookies, browser profiles, or generated engines are included.

## 2. Confirm the documentation repair

- `docs/NODEJS.md` exists and is packed.
- `docs/ISH.md` exists and is packed.
- The public README contains no relative `docs/` links.
- Every public documentation URL uses `release/ytconv-1.6.2-cli-only-final`.
- Every linked Markdown target exists locally.
- Windows, macOS, Linux, WSL, SSH, and Termux install Node.js before YTConv.
- iSH clearly documents the supported Python exception.

## 3. Review identity and metadata

```sh
node -e "const p=require('./package.json'); console.log(p.version,p.publisher,p.publishConfig,p.repository,p.documentation)"
```

Required:

- version `1.6.2`;
- npm tag `latest`;
- provenance enabled;
- repository `andhikamarcella/youtubetomp3`, directory `cli`;
- accurate publisher and maintainer;
- project label that does not claim a nonexistent repository owner;
- Node.js `>=22.14.0` and npm `>=10`;
- versioned absolute documentation metadata;
- installer URL for `ytconv-1.6.2.tgz`.

## 4. Review the diff

```sh
git status --short
git diff --check
git diff --stat
git diff -- cli .github/workflows
```

Search for accidental credentials, web/server files, stale versions, relative documentation links, non-English runtime text, unsafe shell execution, remote extractor components, and non-red normal UI colors.

## 5. Install deterministically

```sh
npm ci --ignore-scripts
npm ls --all
npm audit --omit=dev
npm audit signatures
```

All production dependency versions must be exact and the lockfile must match.

## 6. Run static and unit tests

```sh
npm run check
npm test
npm run check:ish
npm run security
```

Required coverage includes:

- parser and argument precedence;
- stable defaults and opt-outs;
- yt-dlp/gallery routing;
- social login validation and cleanup;
- managed Chromium loopback bridge;
- token-free profile migration;
- terminal control sanitization;
- red-only errors and monochrome normal output;
- responsive layouts;
- stable-only updater;
- engine URL, size, and SHA-256 verification;
- package metadata and English documentation;
- absolute documentation link targets;
- Node.js beginner guide and iSH guide inside the package.

## 7. Cross-platform CI

Required jobs:

- Node.js 22.14, 24, and 26;
- Windows CMD and PowerShell;
- real managed-browser bridge and verified FFmpeg repair on Windows;
- macOS;
- Ubuntu/Debian;
- Fedora family;
- Arch family;
- openSUSE;
- Alpine/musl;
- Gentoo;
- NixOS;
- iSH Python compilation and smoke test;
- Termux installer syntax and package plan checks.

Each job must have a timeout and least-privilege token.

## 8. Package proof

```sh
npm pack --dry-run
npm pack --json --pack-destination /tmp/ytconv-release
```

Inspect every packaged file. Reject HTML, CSS, JSX, TSX, server folders, web folders, and deployment bundles. Confirm that `docs/NODEJS.md` and `docs/ISH.md` are present.

Generate:

```sh
sha256sum /tmp/ytconv-release/ytconv-1.6.2.tgz
npm sbom --omit=dev --sbom-format cyclonedx > /tmp/ytconv-release/ytconv-1.6.1.cdx.json
```

## 9. Clean installation proof

Install the exact tarball into an empty prefix with lifecycle scripts enabled. Verify version, self-test, doctor, and the presence of documentation files.

## 10. Pull request and locked merge

- Open a PR against `release/ytconv-1.6.0-cli-only-final`.
- Wait for every required job.
- Fix failures using complete logs.
- Mark ready only when the tested head SHA is unchanged.
- Merge with the expected head SHA.

## 11. Publish final branch

- Create `release/ytconv-1.6.2-cli-only-final` from the merged commit.
- Trigger the stable npm workflow.
- Publish the exact tarball validated by CI.
- Do not claim success until npm `latest` reports 1.6.1.

## 12. Verify public state

```sh
npm view ytconv@latest version --prefer-online
npm view ytconv dist-tags --json --prefer-online
npm view ytconv@1.6.1 dist.integrity dist.shasum dist.tarball --json --prefer-online
npm view ytconv@1.6.1 documentation --json --prefer-online
```

Required:

- `latest = 1.6.1`;
- registry tarball SHA-256 matches the tested tarball;
- GitHub tag `ytconv-v1.6.2` exists;
- the GitHub Release is not a prerelease;
- tarball, SHA256SUMS, metadata, and SBOM are attached;
- README documentation links open without 404 errors.

## 13. Download-back test

Download the public npm tarball into a new directory. Verify SHA-256, file count, CLI-only allowlist, version `1.6.2`, clean install, self-test, doctor, `docs/NODEJS.md`, and `docs/ISH.md`.

## 14. Post-release instructions

Publish beginner upgrade commands for CMD, PowerShell, Linux/macOS, Termux, and iSH. State Android/iOS browser-session limitations and avoid universal-site or zero-bug guarantees.

## 15. Rollback

If a serious defect appears, preserve the audit trail and publish a corrected patch version. Do not overwrite or silently replace 1.6.1 artifacts.
