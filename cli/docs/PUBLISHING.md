# Publishing YTConv 1.6.2 to npm

This document is for maintainers. YTConv has one active npm channel: `latest`.

## Identity

| Field | Value |
|---|---|
| npm package | `ytconv` |
| version | `1.6.2` |
| npm dist-tag | `latest` |
| GitHub repository | `andhikamarcella/youtubetomp3` |
| release branch | `release/ytconv-1.6.2-cli-only-final` |
| Git tag | `ytconv-v1.6.2` |
| publisher/maintainer | Andhika Marcella Fernanda |
| project label | YTConv Project |

`YTConv Project` is a project label in package metadata, not a claim that a separate GitHub organization owns the repository. The repository remains under the named personal account unless an ownership transfer is completed and verified.

## Required protections

- Review changes through a pull request based on the last stable CLI release.
- Keep website/server code outside the npm package scope.
- Require all cross-platform CI jobs to pass.
- Require the published README to use absolute versioned documentation links.
- Verify that every documentation target exists in the packed tarball.
- Pin third-party GitHub Actions to full commit SHAs.
- Restrict normal CI permissions and limit release writes to the protected release job.
- Keep `NPM_TOKEN` in the protected `npm` environment when trusted publishing is not configured.
- Publish with public provenance.
- Publish and verify the exact tarball inspected by CI.

## Local verification

From `cli`:

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run check:ish
npm run security
npm audit --omit=dev
npm audit signatures
npm pack --dry-run
```

The allowlist must contain CLI JavaScript, the Python iSH files, installers, English Markdown, changelog, and license only. It must not contain HTML, CSS, Express, server routes, deployment configuration, secrets, browser profiles, cookies, caches, or downloaded engines.

Documentation verification must prove:

- `docs/NODEJS.md` exists;
- `docs/ISH.md` exists;
- the public README has no relative `docs/` links;
- every absolute documentation URL uses `release/ytconv-1.6.2-cli-only-final`;
- every linked Markdown target is packed.

## Exact package artifact

```sh
npm pack --json --pack-destination /tmp/ytconv-release
sha256sum /tmp/ytconv-release/ytconv-1.6.2.tgz
npm sbom --omit=dev --sbom-format cyclonedx > /tmp/ytconv-release/ytconv-1.6.2.cdx.json
```

Record:

- tarball filename and byte count;
- unpacked size and file count;
- SHA-1, SHA-256, and npm integrity;
- commit SHA;
- publisher and repository;
- test/CI results;
- Node/npm versions;
- timestamp.

## Clean installation proof

```sh
npm install -g /tmp/ytconv-release/ytconv-1.6.2.tgz --prefix TEMP_PREFIX --force
TEMP_PREFIX/bin/ytconv --version
TEMP_PREFIX/bin/ytconv --self-test
TEMP_PREFIX/bin/ytconv doctor
```

Windows must also prove the CMD and PowerShell launchers. CI must prove browser-session recovery, verified FFmpeg repair, native iSH compilation, and the documentation targets inside the installed tarball.

## GitHub Actions publication

The protected workflow runs from `release/ytconv-1.6.2-cli-only-final` or an explicit manual dispatch with confirmation `PUBLISH-STABLE`.

The workflow:

1. checks out the final release commit;
2. installs Node.js 24 and npm 11.19.0;
3. verifies package identity and documentation metadata;
4. installs dependencies without lifecycle scripts;
5. runs syntax checks,  tests, iSH checks, npm audit, and signature verification;
6. builds one exact CLI-only tarball, metadata file, checksum, and SBOM;
7. performs a dry-run using that tarball;
8. publishes that same tarball as `ytconv@1.6.2` with `latest` and provenance;
9. downloads the public registry tarball and requires its SHA-256 to equal the tested tarball;
10. creates `ytconv-v1.6.2` and attaches the tarball, checksum, metadata, and SBOM;
11. verifies that npm `latest` is exactly `1.6.2`.

## Registry verification

```sh
npm view ytconv@latest version --prefer-online
npm view ytconv@1.6.2 dist.integrity dist.shasum dist.tarball --json
npm view ytconv@1.6.2 documentation --json
npm view ytconv dist-tags --json
```

Required stable tag:

```json
{
  "latest": "1.6.2"
}
```

## GitHub Release verification

Confirm:

- tag `ytconv-v1.6.2` points to the final tested commit;
- the release is not a prerelease;
- `ytconv-1.6.2.tgz`, `SHA256SUMS.txt`, metadata JSON, and CycloneDX SBOM are attached;
- the release checksum matches the npm registry tarball;
- the README documentation URLs open successfully;
- release notes describe platform and security limitations honestly.

## Recovery

### Publication fails before npm accepts the version

Fix the workflow on the final branch, rerun every check, and publish the same reviewed tree.

### npm accepts 1.6.2 but GitHub Release fails

Do not republish npm. Rerun the idempotent verification and GitHub Release steps against the exact public registry tarball.

### Wrong `latest` tag

Move `latest` only to a known valid stable version:

```sh
npm dist-tag add ytconv@1.6.2 latest
```

### Artifact mismatch

Stop the release, preserve logs and artifacts, investigate the commit, package lock, npm version, and provenance, and rotate any potentially exposed token. Do not attach a different tarball to the same release identity.

### Documentation link returns 404

Do not point npm README links at relative paths. Fix the URL in a new patch version, verify the target in CI, and publish a new immutable npm version.

## Publisher changes

Before adding an npm maintainer or transferring the repository:

1. verify the exact account or organization;
2. enforce 2FA and least privilege;
3. update repository and package metadata in one reviewed PR;
4. reconfigure trusted publishing or the protected npm environment;
5. verify npm owners after the change;
6. document the transfer in release notes.
