# YTConv 1.5.0-beta.2 Guide

The stable release remains on npm `latest`. Beta.2 is published only on the separate npm `beta` tag.

## Install beta.2

CMD or PowerShell:

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

Linux, macOS, and SSH:

```bash
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@beta --force
ytconv --version
ytconv --self-test
ytconv doctor
```

Termux:

```bash
pkg install -y nodejs python ffmpeg curl ca-certificates
python -m pip install -U --no-cache-dir yt-dlp gallery-dl
npm install -g ytconv@beta --omit=optional --force
ytconv repair
ytconv doctor
```

Expected version:

```text
1.5.0-beta.2
```

## Default behavior under evaluation

```text
Subtitles        ON for video
SponsorBlock     ON in mark mode
Download archive ON per output profile
Resume           ON
```

Disable a default for one run:

```bash
ytconv download "URL" --no-subtitles
ytconv download "URL" --no-sponsorblock
ytconv download "URL" --no-archive
```

`mark` adds chapters and does not cut media. Cutting requires `--sponsorblock remove`.

## Persistent configuration

```bash
ytconv config list
ytconv config path
ytconv config set output "$HOME/Downloads/YTConv"
ytconv config set preset music
ytconv config set audioQuality 192
ytconv config get output
ytconv config unset audioQuality
ytconv config reset
```

Saved settings are validated against an allowlist. The config command does not store cookies, tokens, proxy credentials, or browser sessions.

Ignore all saved settings for one command:

```bash
ytconv --no-config download "URL"
```

## Profiles

```bash
ytconv profile set music preset=music audioQuality=320
ytconv profile set phone preset=mobile resolution=720
ytconv profile list
ytconv profile show music
ytconv profile use phone
ytconv download "URL"
ytconv --profile music download "URL"
ytconv profile clear
ytconv profile delete phone
```

Explicit command-line options are intended to override saved values. Test this behavior whenever a parser or profile change is made.

## History

```bash
ytconv history
ytconv history --json
ytconv history --limit 50
ytconv history clear
```

History is stored at `~/.ytconv/history.jsonl`, is capped at 500 entries, and excludes cookies, tokens, and browser session data.

## Shell completion

```bash
ytconv completion bash
ytconv completion zsh
ytconv completion fish
ytconv completion powershell
```

Copy the generated script into the matching shell profile.

## Quick start

```bash
ytconv quickstart
```

## Return to stable

```bash
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
```

The version should return to 1.4.0 after the stable package is published.

## Publish beta.2

Confirm local identity:

```bash
node -p "require('./package.json').version"
node -p "require('./package.json').publishConfig.tag"
```

Expected:

```text
1.5.0-beta.2
beta
```

Confirm the number has not been used:

```bash
npm view ytconv versions --json
npm view ytconv dist-tags --json
npm publish --dry-run --tag beta
```

Publish:

```bash
npm publish --tag beta --access public
```

Verify that `latest` did not move:

```bash
npm view ytconv@beta version --prefer-online
npm view ytconv@latest version --prefer-online
npm view ytconv dist-tags --json
```

## Required beta tests

- config set/get/unset/reset with a temporary home directory
- profile set/use/one-run selection/delete
- explicit option precedence over saved values
- `--no-config`
- history privacy, limit, JSON, and clear
- Bash, Zsh, Fish, and PowerShell completion output
- beta defaults and all opt-out flags
- yt-dlp and gallery-dl archive separation
- CMD and PowerShell
- Ubuntu/Debian, Fedora-family, Arch-family, openSUSE, Alpine, Void, Gentoo, and NixOS paths
- macOS and SSH/headless
- Termux simulation
- native iSH media frontend
- npm package preview and English documentation audit

## Limitations

A beta cannot guarantee every site, URL, device, architecture, or operating-system combination. DRM, paywalls, private access, regional restrictions, deleted media, API changes, and HTTP 429 can still prevent a download.
