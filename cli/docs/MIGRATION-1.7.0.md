# Migrating to YTConv 1.7.0

## Repository rename

The canonical repository is now:

```text
https://github.com/andhikamarcella/YTConv
```

Existing GitHub redirects may continue to work, but scripts, badges, package metadata, clone commands, issue links, workflow references, and trusted-publisher settings should use the canonical URL.

Update an existing Git remote with:

```bash
git remote set-url origin https://github.com/andhikamarcella/YTConv.git
git remote -v
```

## Upgrade

```bash
npm install -g ytconv@1.7.0
ytconv --version
ytconv --diagnose
```

## Maintainer automation

npm publishing now uses OIDC Trusted Publishing. Configure npm with repository `YTConv`, workflow `publish-ytconv.yml`, and environment `npm`. The release workflow no longer requires a long-lived `NPM_TOKEN`.

## Documentation validation

Version 1.7.0 adds:

```bash
npm run docs:check
```

The command rejects missing required guides, stale repository URLs, broken local Markdown links, and package-version drift.

## Compatibility

Version 1.7.0 intentionally preserves the established command names, public-first authentication policy, browser-login recovery, secure child-process model, and subtitles-off default from 1.7.0.
