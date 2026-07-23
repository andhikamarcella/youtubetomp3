# YTConv 1.5.0-beta.2 Release Checklist

## 1. Synchronize the beta branch

```bash
git switch release/ytconv-1.5.0-beta.2
git pull --ff-only origin release/ytconv-1.5.0-beta.2
cd cli
git status --short
```

The working tree must be clean.

## 2. Verify beta identity

```bash
node -p "require('./package.json').version"
node -p "require('./package.json').publishConfig.tag"
node ./bin/ytconv.js --version
python3 ./ish/ytconv.py --version
cat ish/VERSION
```

Expected:

```text
1.5.0-beta.2
beta
1.5.0-beta.2
1.5.0-beta.2
1.5.0-beta.2
```

## 3. Install and test

```bash
npm install
npm run check
npm test
npm run check:ish
npm run test:ish
```

## 4. Test beta defaults and opt-out flags

```bash
node ./bin/ytconv.js --help
node ./bin/ytconv.js --self-test
```

Help and self-test must confirm:

```text
Subtitles        ON
SponsorBlock     ON in mark mode
Download archive ON per output profile
```

Verify opt-out parsing:

```bash
node ./bin/ytconv.js --no-subtitles --no-sponsorblock --no-archive --help
```

## 5. Test persistent configuration

Use a temporary home directory so release tests never touch real user data:

```bash
TEST_HOME=$(mktemp -d)
HOME="$TEST_HOME" node ./bin/ytconv.js config set output "$TEST_HOME/output"
HOME="$TEST_HOME" node ./bin/ytconv.js config set audioQuality 192
HOME="$TEST_HOME" node ./bin/ytconv.js config list
HOME="$TEST_HOME" node ./bin/ytconv.js config path
HOME="$TEST_HOME" node ./bin/ytconv.js config reset
rm -rf "$TEST_HOME"
```

## 6. Test profiles and explicit precedence

```bash
TEST_HOME=$(mktemp -d)
HOME="$TEST_HOME" node ./bin/ytconv.js profile set phone preset=mobile resolution=720
HOME="$TEST_HOME" node ./bin/ytconv.js profile use phone
HOME="$TEST_HOME" node ./bin/ytconv.js profile list
HOME="$TEST_HOME" node ./bin/ytconv.js --profile phone --resolution 1080 --help
HOME="$TEST_HOME" node ./bin/ytconv.js --no-config --help
rm -rf "$TEST_HOME"
```

Unit tests must verify that explicit options remove conflicting saved settings while preserving unrelated saved values such as the output directory.

## 7. Test history and completion

```bash
TEST_HOME=$(mktemp -d)
HOME="$TEST_HOME" node ./bin/ytconv.js history
HOME="$TEST_HOME" node ./bin/ytconv.js history --json
HOME="$TEST_HOME" node ./bin/ytconv.js history clear
node ./bin/ytconv.js completion bash
node ./bin/ytconv.js completion zsh
node ./bin/ytconv.js completion fish
node ./bin/ytconv.js completion powershell
rm -rf "$TEST_HOME"
```

History must exclude cookies, tokens, proxy credentials, and browser sessions and remain capped at 500 entries.

## 8. Test media inspection without downloading

Use a legal public test URL:

```bash
node ./bin/ytconv.js info "TEST_URL" --json
node ./bin/ytconv.js formats "TEST_URL" --json
node ./bin/ytconv.js subtitles "TEST_URL"
```

JSON stdout must remain valid and must not contain update notices.

## 9. Test real media operations

Use media that you own or are allowed to download:

```bash
node ./bin/ytconv.js download "VIDEO_URL" --preset mobile
node ./bin/ytconv.js download "MUSIC_URL" --preset music
node ./bin/ytconv.js playlist "PLAYLIST_URL" --playlist-items "1-2"
node ./bin/ytconv.js batch links.txt --jobs 2 --continue-on-error --result-json report.json
node ./bin/ytconv.js download "VIDEO_URL" --sponsorblock remove
```

Verify subtitles, safe SponsorBlock marking, explicit removal, separate archives, resume, metadata, cover art, square YouTube Music artwork, batch reporting, and exit codes.

## 10. Required CI coverage

The workflow must pass for:

- Node.js 18, 20, and 22
- Windows CMD and PowerShell
- Ubuntu/Linux full installation
- macOS
- Alpine/musl with system FFmpeg
- SSH/headless
- Termux package simulation
- native iSH frontend
- installer plans for Debian/Ubuntu, Fedora, Arch/CachyOS family, openSUSE, Alpine, Void, Gentoo, and NixOS
- persistent config/profile/history/completion tests
- beta defaults and opt-out tests
- npm package preview and English documentation audit

## 11. Preview npm contents

```bash
npm publish --dry-run --tag beta
npm pack --json > package-preview.json
```

Confirm:

```text
name: ytconv
version: 1.5.0-beta.2
```

The package must include `bin`, `src`, `scripts`, `ish`, `docs`, README, changelog, and license. It must not include real config files, history, cookies, `.env`, personal logs, downloads, tokens, or secrets.

## 12. Confirm the version is unused

```bash
npm view ytconv versions --json
npm view ytconv dist-tags --json
```

`1.5.0-beta.2` must not already exist. npm does not allow overwriting a published version.

## 13. Verify npm ownership

```bash
npm whoami
npm owner ls ytconv
```

## 14. Publish beta

Capture the stable tag first:

```bash
LATEST_BEFORE=$(npm view ytconv@latest version --prefer-online)
```

Publish:

```bash
npm publish --tag beta --access public
```

With OTP:

```bash
npm publish --tag beta --access public --otp=123456
```

## 15. Verify registry tags

```bash
npm view ytconv@beta version --prefer-online
npm view ytconv@1.5.0-beta.2 dist.integrity
npm view ytconv dist-tags --json
test "$(npm view ytconv@latest version --prefer-online)" = "$LATEST_BEFORE"
```

The `beta` tag must point to `1.5.0-beta.2`. The `latest` tag must remain unchanged.

## 16. Test a clean public beta installation

Windows:

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
ytconv.cmd quickstart
```

Linux/macOS:

```bash
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@beta --force
ytconv --version
ytconv --self-test
ytconv doctor
ytconv quickstart
```

Termux:

```bash
npm install -g ytconv@beta --omit=optional --force
ytconv --self-test
ytconv doctor
```

## 17. Return to stable during rollback testing

```bash
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
```

## 18. After publishing

- Never republish or overwrite `1.5.0-beta.2`.
- The next beta fix must use a new prerelease number.
- Do not merge a release PR until the public package has been tested and the user explicitly requests the merge.
- Do not claim that every site, URL, device, architecture, or distribution is guaranteed forever.
