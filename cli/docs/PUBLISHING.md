# Publishing YTConv 1.6.0 to npm

This document is for maintainers. YTConv has one active npm channel: `latest`.

## Identity

| Field | Value |
|---|---|
| npm package | `ytconv` |
| version | `1.6.0` |
| npm dist-tag | `latest` |
| GitHub repository | `andhikamarcella/youtubetomp3` |
| release branch | `release/ytconv-1.6.0-cli-only-final` |
| Git tag | `ytconv-v1.6.0` |
| publisher/maintainer | Andhika Marcella Fernanda |

The current GitHub owner is a personal account. Do not insert an organization name into package metadata, provenance, or documentation unless ownership is actually transferred and verified.

## Required protections

- Review changes through a pull request based on the last stable CLI release.
- Keep website/server code outside the npm package scope.
- Require all cross-platform CI jobs to pass.
- Pin third-party GitHub Actions to full commit SHAs.
- Restrict CI to `contents: read`; grant release workflow only `contents: write` and `id-token: write`.
- Use an npm trusted publisher/OIDC when configured; keep token fallback limited to the protected release environment.
- Publish with public provenance.
- Never accept a tarball whose tree differs from the reviewed commit.

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
npm publish --dry-run --access public --provenance
```

Review the allowlist. It must contain CLI JavaScript, Python iSH files, installers, English Markdown, license, and metadata only. It must not contain HTML, CSS, Express, server routes, deployment configuration, secrets, browser profiles, cookies, caches, or downloaded engines.

## Package artifact

```sh
npm pack --json
sha256sum ytconv-1.6.0.tgz
npm sbom --sbom-format=cyclonedx > ytconv-1.6.0.sbom.cdx.json
```

Record:

- tarball filename and byte count;
- unpacked size and file count;
- SHA-1, SHA-256, and npm integrity;
- commit SHA and tree SHA;
- publisher and repository;
- test/CI results;
- Node/npm versions;
- timestamp.

## Clean installation proof

Install the generated tarball into an empty temporary prefix with lifecycle scripts enabled:

```sh
npm install -g ./ytconv-1.6.0.tgz --prefix TEMP_PREFIX --force
TEMP_PREFIX/bin/ytconv --version
TEMP_PREFIX/bin/ytconv --self-test
TEMP_PREFIX/bin/ytconv doctor
```

Windows must also prove CMD and PowerShell launchers. CI must delete the fallback FFmpeg test executable, run repair, execute `ffmpeg -version`, and verify that the GitHub digest path was used.

## GitHub Actions publish inputs

The protected workflow supports an explicit manual dispatch and the final release branch. Manual confirmation must match the exact version. The workflow:

1. checks out the locked commit;
2. installs the supported Node/npm toolchain;
3. installs dependencies without lifecycle scripts;
4. runs syntax, tests, iSH compilation, audit, signatures, and package inspection;
5. generates the tarball, checksum, metadata, and SBOM;
6. publishes `ytconv@1.6.0` with `latest` and provenance if unused;
7. removes the retired prerelease dist-tag;
8. downloads the public registry tarball and compares it byte-for-byte/integrity with the tested artifact;
9. creates `ytconv-v1.6.0` and attaches all release artifacts.

## Registry verification

```sh
npm view ytconv@latest version --prefer-online
npm view ytconv@1.6.0 dist.integrity dist.shasum dist.tarball --json
npm view ytconv dist-tags --json
```

Required result:

```json
{
  "latest": "1.6.0"
}
```

The registry may retain an immutable historical prerelease version record. It must not have an active dist-tag and must not be used by installers or the updater.

## GitHub Release verification

Confirm that:

- tag `ytconv-v1.6.0` points to the final tested commit;
- Release is marked latest and is not a prerelease;
- `ytconv-1.6.0.tgz`, `SHA256SUMS.txt`, metadata JSON, and SBOM are attached;
- the release asset digest shown by GitHub matches the local/public artifact;
- release notes describe security boundaries and platform limitations honestly.

## Recovery

### Publication fails before npm accepts the version

Fix the workflow on the release branch, rerun every check, and publish the same reviewed tree.

### npm accepted 1.6.0 but GitHub Release failed

Do not republish or overwrite npm. Rerun only the idempotent registry-verification and GitHub Release steps using the exact public tarball.

### Wrong `latest` tag

Move `latest` only to a known valid stable version:

```sh
npm dist-tag add ytconv@1.6.0 latest
```

Never delete a valid published version as routine rollback. Correct the dist-tag and publish a new patch version when source changes are required.

### Retired prerelease tag still exists

```sh
npm dist-tag rm ytconv beta
npm view ytconv dist-tags --json
```

### Artifact mismatch

Stop the release, preserve logs/artifacts, rotate any potentially exposed token, and investigate the commit, lockfile, npm environment, and provenance. Do not attach a different tarball under the same release identity.

## Publisher changes

Before adding an npm maintainer or moving to a GitHub organization:

1. verify the exact account and organization;
2. use least privilege and enforced 2FA;
3. update repository/package metadata in one reviewed PR;
4. reconfigure trusted publishing for the exact workflow/environment;
5. verify npm owners after the change;
6. document the ownership transfer in release notes.

Never invent an organization entry to make metadata look more complete.
