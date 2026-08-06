# Migrating to YTConv 1.7.1

## Upgrade

```bash
npm install -g ytconv@1.7.1
ytconv --version
ytconv --diagnose
```

## Stable documentation links

Version 1.7.1 restores the compatibility path below on the repository default branch:

```text
https://github.com/andhikamarcella/YTConv/blob/HEAD/cli/docs/MIGRATION-1.7.0.md
```

Maintained CLI documentation remains release-pinned so it cannot accidentally follow the web branch:

```text
https://github.com/andhikamarcella/YTConv/tree/release/ytconv-1.7.1/cli/docs
```

## New terminal help center

```bash
ytconv docs --list
ytconv docs migration
ytconv about
ytconv shortcuts
```

No established download, conversion, authentication, batch, profile, or package command is removed.
