# Development

## Setup

```bash
git clone https://github.com/andhikamarcella/YTConv.git
cd YTConv/cli
npm ci
```

## Required checks

```bash
npm run docs:check
npm run check
npm run typecheck
npm test
npm run check:ish
npm run security
npm run prepack
```

`npm ci` must succeed without modifying `package-lock.json`. New behavior should include tests, and documentation links must remain local or canonical.

## Pull requests

Keep changes focused, explain user impact, include validation output, and avoid committing generated binaries, credentials, browser profiles, cookie files, or private URLs.

## Version changes

Update all package and platform identities together. The CI matrices verify npm, iSH, Android, Windows, Linux, Alpine, Nix, Snap, Flatpak, Termux, and portable artifacts.

## Documentation

Run `npm run docs:check` after adding or renaming a guide. The validator rejects missing required files, broken local Markdown links, stale repository slugs, and package-version drift.
