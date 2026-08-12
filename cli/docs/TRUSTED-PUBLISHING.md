# npm Trusted Publishing

YTConv 1.7.6 uses GitHub Actions OpenID Connect instead of a long-lived npm publication token.

## npm connection values

- Publisher: `GitHub Actions`
- Organization or user: `andhikamarcella`
- Repository: `YTConv`
- Workflow filename: `publish-ytconv.yml`
- Environment name: `npm`
- Allowed action: `npm publish`

These values are case-sensitive. The workflow must exist at `.github/workflows/publish-ytconv.yml` in the canonical repository.

## Workflow requirements

The publication job uses:

- `id-token: write`
- the GitHub environment named `npm`
- a recent npm CLI
- `npm publish --provenance`
- no `NPM_TOKEN`

## Safety controls

Publication is manual and requires confirmation. Before publishing, the workflow checks the exact package and CLI versions and runs the full prepack suite. After publishing, it verifies `ytconv@1.7.6`, checks the `latest` dist-tag, compares the registry tarball SHA-256, and creates the corresponding GitHub Release.

## Troubleshooting

A trusted-publisher failure normally means one of the npm connection fields does not exactly match the GitHub repository, workflow filename, or environment. Do not work around a mismatch by placing tokens in source files.
