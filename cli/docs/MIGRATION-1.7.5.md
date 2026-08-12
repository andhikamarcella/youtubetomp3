# Migration to YTConv 1.7.5

YTConv 1.7.5 is a backward-compatible package and release metadata refresh. Existing download, conversion, donation, login, profile, history, documentation, and configuration commands remain available without changes.

## Upgrade

```bash
npm install --global ytconv@1.7.5
ytconv --version
ytconv doctor
```

The expected version is `1.7.5`.

## Package manifest synchronization

The npm manifest keeps the CLI-only file allowlist, TypeScript declaration export, exact runtime dependency pins, ISC license, funding links, provenance settings, release documentation, and security capability declarations. Version-pinned repository, installer, checksum, SBOM, and migration URLs now point to the 1.7.5 release.

The Ko-fi and Saweria values are plain HTTPS URLs in `package.json`. Markdown link syntax and escaped email markup are intentionally not stored in JSON metadata.

## Runtime behavior

This patch does not intentionally change media selection, conversion, archive recovery, or authentication behavior. It preserves the 1.7.5 fixes for missing archived outputs, archive-free recovery retries, accurate authentication classification, and Chromium executable discovery.

Public media is still attempted without cookies first. Restricted, private, age-gated, or account-only media can still use the official browser-login recovery flow when the provider returns a genuine authentication signal.

See [Installation](INSTALLATION.md), [Packages](PACKAGES.md), [Troubleshooting](TROUBLESHOOTING.md), [Donation](DONATE.md), and [Safety and legal use](SAFETY-LEGAL.md).
