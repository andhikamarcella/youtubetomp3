# Migrating to YTConv 1.7.0

> This compatibility document is kept on the repository default branch so existing `blob/HEAD` links remain valid. The maintained CLI documentation lives on the latest YTConv CLI release branch.

## Canonical repository

```text
https://github.com/andhikamarcella/YTConv
```

Update an existing clone:

```bash
git remote set-url origin https://github.com/andhikamarcella/YTConv.git
git remote -v
```

## Upgrade

```bash
npm install -g ytconv@latest
ytconv --version
ytconv --diagnose
```

## Documentation

- Latest CLI documentation: `https://github.com/andhikamarcella/YTConv/tree/release/ytconv-1.7.1/cli/docs`
- Version 1.7.0 documentation: `https://github.com/andhikamarcella/YTConv/tree/release/ytconv-1.7.0/cli/docs`
- Issues: `https://github.com/andhikamarcella/YTConv/issues`

## Publishing migration

YTConv uses npm Trusted Publishing through GitHub OIDC. The trusted publisher must reference repository `YTConv`, workflow `publish-ytconv.yml`, and environment `npm`.
