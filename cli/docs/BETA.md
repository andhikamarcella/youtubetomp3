# YTConv Beta Channel

The stable package uses the npm `latest` tag. Experimental releases use the separate `beta` tag so testing a prerelease does not replace the stable channel.

## Install the beta channel

CMD or PowerShell:

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
ytconv.cmd --version
ytconv.cmd doctor
```

Linux, macOS, and SSH:

```bash
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@beta --force
ytconv --version
ytconv doctor
```

Termux:

```bash
pkg install -y nodejs python ffmpeg
python -m pip install -U yt-dlp gallery-dl
npm install -g ytconv@beta --omit=optional --force
ytconv doctor
```

## Return to stable

```bash
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
```

## Prerelease safety

A beta version must use a Semantic Versioning prerelease number, for example:

```text
1.5.0-beta.2
```

Publish it with:

```bash
npm publish --tag beta --access public
```

Verify both npm tags afterward:

```bash
npm view ytconv@beta version --prefer-online
npm view ytconv@latest version --prefer-online
npm view ytconv dist-tags --json
```

Publishing a beta must not change the `latest` tag.

## What to test in a beta

- clean installation and update on CMD and PowerShell
- Ubuntu/Debian, Fedora-family, Arch-family, openSUSE, Alpine, Void, Gentoo, and NixOS installation paths
- macOS and SSH/headless operation
- Termux package installation
- native iSH frontend
- playlist, batch, retry, resume, and archives
- subtitles and SponsorBlock behavior
- JSON output and stable exit codes
- new configuration, profile, history, or completion features introduced by the beta

A beta cannot guarantee every site, device, architecture, or operating-system combination. DRM, paywalls, private access, regional restrictions, deleted media, API changes, and HTTP 429 can still prevent a download.
