# Publishing YTConv to npm

This guide is for YTConv maintainers. Never put an npm token in source code, an issue, a screenshot, logs, or chat.

## Release channels

| Channel | Branch | Version | npm tag | Workflow |
| --- | --- | --- | --- | --- |
| Stable | `release/ytconv-1.5.8-cli-only-final` | `1.5.8` | `latest` | `Publish YTConv Stable to npm` |
| Beta | `release/ytconv-1.6.0-beta` | `1.6.0-beta.1` | `beta` | `Publish YTConv Beta to npm` |

Beta must never be published with the `latest` tag.

## One-time npm and GitHub setup

1. Sign in to the npm account that owns `ytconv` and enable 2FA.
2. Create a **Granular Access Token** with read/write access to `ytconv`. Enable 2FA bypass only for the automation token stored in GitHub Actions.
3. Open the GitHub repository and go to **Settings → Environments**.
4. Create an environment named exactly `npm`.
5. Add this secret to the `npm` environment:

   ```text
   NPM_TOKEN=<granular npm automation token>
   ```

6. A required reviewer is recommended for the `npm` environment so publishing needs approval.

The workflow uses the `npm` environment, `id-token: write`, a dry run, the complete test suite, version/tag checks, and post-publish registry verification.

## Pre-publish checklist

Confirm that the CLI-only package, dependency bootstrap, and local browser login work. An account server or website is not a release requirement:

```sh
ytconv doctor
ytconv --self-test
ytconv social status
ytconv login instagram --browser firefox
ytconv "AUTHORIZED_MEDIA_URL"
ytconv logout instagram
```

Check package identity:

```sh
cd cli
node -p "require('./package.json').name"
node -p "require('./package.json').version"
node -p "require('./package.json').publishConfig.tag"
npm view ytconv versions --json
```

Run local validation before publishing:

```sh
npm install
npm run check
npm test
npm run check:ish
npm run test:ish
npm pack --dry-run
```

## Publish stable 1.5.8 through GitHub Actions

1. Confirm that every stable change is on `release/ytconv-1.5.8-cli-only-final`.
2. Open the repository's **Actions** tab.
3. Select **Publish YTConv Stable to npm**.
4. Choose **Run workflow**.
5. Select `release/ytconv-1.5.8-cli-only-final`.
6. Enter:

   ```text
   version: 1.5.8
   confirm: PUBLISH-STABLE
   ```

7. Start the workflow and approve the `npm` environment if approval is enabled.
8. Wait for every step, including **Verify registry**, to pass.

The workflow runs:

```sh
npm publish --tag latest --access public --provenance
```

Verify the result:

```sh
npm view ytconv@latest version
npm view ytconv@1.5.8 dist.integrity
npm view ytconv dist-tags --json
```

Expected:

```text
latest = 1.5.8
```

## Publish beta 1.6.0-beta.1 through GitHub Actions

1. Confirm that every beta change is on `release/ytconv-1.6.0-beta`.
2. Open the **Actions** tab.
3. Select **Publish YTConv Beta to npm**.
4. Choose **Run workflow**.
5. Select `release/ytconv-1.6.0-beta`.
6. Enter:

   ```text
   version: 1.6.0-beta.1
   confirm: PUBLISH-BETA
   ```

7. Start the workflow and wait for every step to pass.

The workflow runs:

```sh
npm publish --tag beta --access public --provenance
```

The workflow also verifies that the `latest` tag does not change.

Verify the result:

```sh
npm view ytconv@beta version
npm view ytconv@latest version
npm view ytconv@1.6.0-beta.1 dist.integrity
npm view ytconv dist-tags --json
```

Expected:

```text
beta   = 1.6.0-beta.1
latest = 1.5.8
```

## Manual local fallback

Use this only when GitHub Actions is unavailable. Publishing through Actions is safer and generates provenance.

```sh
npm login
npm whoami
cd cli
npm install
npm run check
npm test
npm run check:ish
npm run test:ish
npm pack --dry-run
```

Stable:

```sh
npm publish --tag latest --access public
```

Beta:

```sh
npm publish --tag beta --access public
```

Do not publish from the wrong branch.

## Install verification

Stable:

```sh
npm install -g ytconv@latest --force
ytconv --version
```

Beta:

```sh
npm install -g ytconv@beta --force
ytconv --version
```

Windows PowerShell/CMD can use:

```powershell
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
```

## Version and tag recovery

An npm version cannot be overwritten after publication. Update `package.json`, the lockfile, documentation, installers, and identity tests before publishing the next version.

Repair dist-tags without republishing the package:

```sh
npm dist-tag add ytconv@1.5.8 latest
npm dist-tag add ytconv@1.6.0-beta.1 beta
npm view ytconv dist-tags --json
```

Example next versions:

```text
Stable patch: 1.5.8
Beta next:    1.6.0-beta.2
```

## Common failures

### `ENEEDAUTH` or `E401`

- Confirm that a secret named exactly `NPM_TOKEN` exists in the `npm` environment.
- Confirm that the token has not expired or been revoked.
- Confirm that the token has read/write permission for `ytconv`.

### `You cannot publish over the previously published versions`

That version has already been published. Increase the version number; do not attempt to overwrite an old version.

### Beta accidentally changes `latest`

Restore the tags:

```sh
npm dist-tag add ytconv@1.5.8 latest
npm dist-tag add ytconv@1.6.0-beta.1 beta
```

### Package contents are wrong

Always inspect this output before publishing:

```sh
npm pack --dry-run
```

Confirm that `bin`, `src`, `scripts`, `ish`, `docs`, `README.md`, `CHANGELOG.md`, and `LICENSE` are included.
