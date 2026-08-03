# YTConv 1.6.0 Stable Release Checklist

## 1. Confirm scope and base

- Base is the published 1.5.9 stable CLI release.
- Version is exactly `1.6.0` with no prerelease suffix.
- Only `cli/`, stable CLI workflows, and release metadata are changed.
- No website, API server, Express route, credentials, cookies, browser profiles, or generated engines are included.

## 2. Review identity and metadata

```sh
node -e "const p=require('./package.json'); console.log(p.version,p.publisher,p.publishConfig,p.repository)"
```

Required:

- version `1.6.0`;
- tag `latest`;
- provenance enabled;
- repository `andhikamarcella/youtubetomp3`, directory `cli`;
- personal publisher/maintainer accurately named;
- Node.js `>=22.14.0` or compatible manifest range plus explicit self-test baseline;
- no active prerelease channel documentation.

## 3. Review the diff

```sh
git status --short
git diff --check
git diff --stat
git diff -- cli .github/workflows release-metadata ytconv-release-metadata.json
```

Search for accidental credentials, web/server files, stale versions, non-English runtime text, unsafe shell execution, remote extractor components, and non-red UI colors.

## 4. Install deterministically

```sh
npm ci --ignore-scripts
npm ls --all
npm audit --omit=dev
npm audit signatures
```

All production versions must be exact and the lockfile must match.

## 5. Run static and unit tests

```sh
npm run check
npm test
npm run check:ish
npm run security
```

Required coverage includes:

- parser and explicit precedence;
- stable defaults and opt-outs;
- yt-dlp/gallery routing;
- social login validation and cleanup;
- managed Chromium loopback bridge;
- token-free profile migration;
- terminal control sanitization;
- red-only styling;
- responsive layouts at 20, 40, 56, 80, and 120 columns;
- stable-only updater;
- engine asset mapping, URL restriction, size, and SHA-256 verification;
- package metadata and English documentation.

## 6. Cross-platform CI

Required jobs:

- Windows CMD, PowerShell, and real managed-browser bridge;
- macOS;
- Node.js 22 and 24;
- Ubuntu/Debian;
- Fedora/RHEL family;
- Arch family;
- openSUSE;
- Alpine/musl;
- Void;
- Gentoo;
- NixOS;
- iSH Python compilation and smoke test;
- Termux static/simulated compatibility checks.

Each job has a timeout and least-privilege token. A platform limitation must be documented rather than hidden by a false success.

## 7. Real engine proof

Using an empty `YTCONV_ENGINE_DIR`:

1. download the current yt-dlp release asset;
2. require GitHub SHA-256 and exact size;
3. execute `--version`;
4. repeat for gallery-dl;
5. remove fallback FFmpeg, download and gunzip it, verify digest, execute `-version`;
6. confirm temporary `.download` files are absent;
7. confirm Unix files are not group/world writable.

Do not mutate the user’s normal engine directory during CI.

## 8. Package proof

```sh
npm pack --dry-run
npm publish --dry-run --access public --provenance
npm pack --json
```

Inspect every packaged file. Record the exact tarball SHA-256. Generate CycloneDX SBOM and metadata. Install the tarball into an empty prefix with postinstall enabled; verify version, self-test, and doctor.

## 9. Pull request and locked merge

- Push one intentional release branch.
- Open a draft PR against the last stable release branch.
- Wait for every required job.
- Fix failures based on complete logs and rerun all affected jobs.
- Mark ready only when the tested head SHA is unchanged.
- Merge with the head SHA locked to prevent a race.

## 10. Publish final branch

- Create `release/ytconv-1.6.0-cli-only-final` from the merged commit.
- Trigger only CLI CI and stable npm publish workflows.
- Do not claim release completion while the registry still reports an older `latest`.

## 11. Verify public state

```sh
npm view ytconv@latest version --prefer-online
npm view ytconv dist-tags --json --prefer-online
npm view ytconv@1.6.0 dist.integrity dist.shasum --json --prefer-online
```

Required:

- `latest = 1.6.0`;
- no active prerelease dist-tag;
- public integrity/hash match the tested tarball;
- GitHub tag and Release exist;
- Release is not marked prerelease;
- artifacts and SBOM are downloadable.

## 12. Download-back test

Download the public npm tarball into a new directory. Verify SHA-256, file count, package allowlist, CLI-only scope, `1.6.0`, clean install, self-test, and doctor. This is the final release gate.

## 13. Post-release instructions

Publish upgrade commands for CMD, PowerShell, Linux/macOS, Termux, and iSH. State account-session limitations on Android/iOS and avoid zero-bug or universal-site guarantees.

## 14. Rollback

If a serious defect is discovered, preserve the release audit trail, move `latest` back only when necessary, and publish a corrected patch version. Do not overwrite 1.6.0 or silently replace its artifact.
