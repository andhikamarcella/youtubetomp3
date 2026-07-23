# YTConv 1.4.0 Stable Release Checklist

## 1. Synchronize the release branch

```bash
git switch release/ytconv-1.4.0
git pull --ff-only origin release/ytconv-1.4.0
cd cli
git status --short
```

The working tree must be clean.

## 2. Verify release identity

```bash
node -p "require('./package.json').version"
node -p "require('./package.json').publishConfig.tag"
node ./bin/ytconv.js --version
python3 ./ish/ytconv.py --version
cat ish/VERSION
```

Expected:

```text
1.4.0
latest
1.4.0
1.4.0
1.4.0
```

## 3. Install and test

```bash
npm install
npm run check
npm test
npm run check:ish
npm run test:ish
```

## 4. Smoke-test commands

```bash
node ./bin/ytconv.js --help
node ./bin/ytconv.js --examples
node ./bin/ytconv.js --list-presets
node ./bin/ytconv.js --shell-info
node ./bin/ytconv.js --self-test
node ./bin/ytconv.js doctor
```

Stable help must state that subtitles, SponsorBlock, and download archives are opt-in.

## 5. Test inspection without downloading

Use a legal public test URL:

```bash
node ./bin/ytconv.js info "TEST_URL" --json
node ./bin/ytconv.js formats "TEST_URL" --json
node ./bin/ytconv.js subtitles "TEST_URL"
```

JSON stdout must remain valid and must not contain update notices.

## 6. Test real media operations

Use media that you own or are allowed to download:

```bash
node ./bin/ytconv.js download "VIDEO_URL" --preset mobile
node ./bin/ytconv.js download "MUSIC_URL" --preset music
node ./bin/ytconv.js playlist "PLAYLIST_URL" --playlist-items "1-2" --archive downloaded.txt
node ./bin/ytconv.js batch links.txt --jobs 2 --continue-on-error --result-json report.json
node ./bin/ytconv.js download "VIDEO_URL" --subtitles --subtitle-langs "en,id"
```

Verify progress, resume, archive behavior, metadata, cover art, square YouTube Music artwork, valid JSON, batch reporting, and exit codes.

## 7. Required CI coverage

The workflow must pass for:

- Node.js 18, 20, and 22
- Windows CMD
- Windows PowerShell
- Ubuntu/Linux full installation
- macOS
- Alpine/musl with system FFmpeg
- SSH/headless
- Termux package simulation
- native iSH frontend
- installer plans for Debian/Ubuntu, Fedora, Arch/CachyOS family, openSUSE, Alpine, Void, Gentoo, and NixOS
- npm package preview and English documentation checks

## 8. Preview npm contents

```bash
npm publish --dry-run
npm pack --json > package-preview.json
```

Confirm:

```text
name: ytconv
version: 1.4.0
```

The package must include `bin`, `src`, `scripts`, `ish`, `docs`, README, changelog, and license. It must not include cookies, `.env`, personal logs, downloaded media, tokens, or secrets.

## 9. Confirm the version is unused

```bash
npm view ytconv versions --json
npm view ytconv dist-tags --json
```

`1.4.0` must not already exist. npm does not allow overwriting a published version.

## 10. Verify npm ownership

```bash
npm whoami
npm owner ls ytconv
```

## 11. Publish stable

Manual:

```bash
npm publish --tag latest --access public
```

With OTP:

```bash
npm publish --tag latest --access public --otp=123456
```

The workflow-based publisher may use npm provenance after trusted publishing or `NPM_TOKEN` is configured.

## 12. Verify the registry

```bash
npm view ytconv version --prefer-online
npm view ytconv@1.4.0 dist.integrity
npm view ytconv dist-tags --json
```

The `latest` tag must point to `1.4.0`.

## 13. Test a clean public installation

Windows:

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

Linux/macOS:

```bash
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
ytconv --self-test
ytconv doctor
```

Termux:

```bash
npm install -g ytconv@latest --omit=optional --force
ytconv --self-test
ytconv doctor
```

## 14. After publishing

- Never republish or overwrite `1.4.0`.
- A stable bug fix must use `1.4.1` or another unused version.
- Do not merge a release PR until the public package has been tested and the user explicitly requests the merge.
- Do not claim that every site, URL, device, architecture, or distribution is guaranteed forever.
