# YTConv CLI 1.6.1

YTConv is a responsive, CLI-only media downloader and converter for Windows, macOS, desktop Linux, Android Termux, SSH environments, and iPhone/iPad through iSH. Video and audio work is routed to yt-dlp, gallery work to gallery-dl, and conversion work to FFmpeg.

Version 1.6.1 fixes the broken documentation links published with 1.6.0. Every documentation link in this README is now an absolute link to the reviewed 1.6.1 release branch, so npm and GitHub cannot rewrite it to an unrelated or incomplete commit.

## Beginner installation order

Install in this order:

1. Install Node.js first on Windows, macOS, Linux, WSL, SSH servers, or Termux.
2. Close and reopen the terminal.
3. Verify `node` and `npm`.
4. Install YTConv from npm `latest`.
5. Run the self-test and dependency doctor.

Start here:

- [Beginner Node.js installation guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/NODEJS.md)
- [Complete YTConv installation guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/INSTALL.md)

The iSH edition is the supported exception: it uses the maintained Python frontend because the Node.js/Ink desktop interface is not appropriate for the emulated iSH environment.

## Requirements

For the npm CLI:

```text
Node.js 22.14.0 or newer
npm 10 or newer
```

Verify before installing YTConv:

```sh
node --version
npm --version
```

Install the stable release:

```sh
npm install -g ytconv@latest --force
ytconv --version
ytconv --self-test
ytconv doctor
```

Expected version:

```text
1.6.1
```

On Windows, use the `.cmd` shims for maximum compatibility:

```cmd
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

## What changed in 1.6.1

- Fixed every README documentation link that could be rewritten to a Git commit without the requested file.
- Replaced published relative documentation links with absolute links to the final 1.6.1 release branch.
- Added a complete beginner-first Node.js guide for Windows, macOS, Linux, WSL, SSH, Termux, Chromebook Linux, and the iSH exception.
- Added automated tests that reject missing documentation targets, relative `docs/` links in the published README, and links to the wrong release branch.
- Added Node.js-first instructions to every supported npm platform section.
- Kept the package CLI-only with no HTML, CSS, Next.js, web server, or browser application bundle.
- Preserved the monochrome terminal interface: normal states use the terminal foreground color and actionable errors may use red.

## Windows

First install a current Node.js LTS release by following the [Node.js guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/NODEJS.md#windows-10-or-windows-11). Close and reopen CMD, PowerShell, or Windows Terminal.

Then:

```cmd
node.exe --version
npm.cmd --version
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd repair
ytconv.cmd --self-test
ytconv.cmd doctor
```

Full tutorial: [Windows guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/WINDOWS.md).

## macOS

Install a current Node.js LTS release first. The official installer, Homebrew, and per-user npm prefix methods are described in the [Node.js guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/NODEJS.md#macos).

Then:

```sh
node --version
npm --version
npm install -g ytconv@latest --force
ytconv --version
ytconv repair
ytconv doctor
```

Full tutorial: [Linux and macOS guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/LINUX.md).

## Desktop Linux

Install Node.js first. The recommended beginner path across distributions is a per-user Node.js installation through nvm, while the universal YTConv installer can also detect apt, dnf, pacman, zypper, apk, xbps, emerge, Nix, or Homebrew.

```sh
node --version
npm --version
npm install -g ytconv@latest --force
ytconv --version
ytconv repair
ytconv doctor
```

Start with the [Node.js guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/NODEJS.md#ubuntu-debian-linux-mint-fedora-arch-opensuse-and-other-desktop-linux-distributions), then read the [Linux and macOS guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/LINUX.md).

## Android Termux

Use a maintained Termux build. Inside Termux:

```sh
pkg update
pkg upgrade -y
pkg install -y nodejs python ffmpeg curl ca-certificates
node --version
npm --version
termux-setup-storage
python -m pip install -U --no-cache-dir 'yt-dlp[default]' gallery-dl
npm install -g ytconv@latest --omit=optional --force
ytconv --version
ytconv repair
ytconv doctor
```

Full tutorials:

- [Node.js on Termux](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/NODEJS.md#android-with-termux)
- [Termux guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/TERMUX.md)

Android prevents Termux from reading private browser databases. Public URLs work; account-required media may require a desktop browser session.

## iPhone and iPad with iSH

Node.js is intentionally not required for the iSH edition. Install the native Python dependencies:

```sh
apk update
apk add --no-cache python3 py3-pip ffmpeg curl ca-certificates
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/release/ytconv-1.6.1-cli-only-final/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
ytconv --diagnose
```

Full tutorial: [iSH guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/ISH.md).

Safari and other iOS browsers are sandboxed from iSH. Public links are the supported path inside iSH.

## First run

```sh
ytconv quickstart
ytconv --self-test
ytconv --shell-info
ytconv doctor
```

A ready installation should report:

```text
Status: ready to use.
```

Optional tools may be listed as recommendations without blocking every public download.

## Download examples

Interactive mode:

```sh
ytconv
```

Direct commands:

```sh
ytconv download "URL"
ytconv download "URL" --mode video --resolution 1080 --video-format mp4
ytconv download "URL" --mode audio --audio-format mp3 --audio-quality 320
ytconv download "URL" --mode image --image-format original
ytconv playlist "URL" --playlist-items 1-20
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

Headless or SSH:

```sh
ytconv --headless download "URL"
printf '%s\n' "URL1" "URL2" | ytconv --stdin --jobs 2 --continue-on-error
```

## Official social-site login

On supported desktop systems:

```sh
ytconv login instagram
ytconv social status
ytconv download "INSTAGRAM_URL"
```

YTConv opens the provider's official page in a dedicated browser profile. Passwords and OTP/2FA codes stay in the browser. YTConv stores only the provider-to-browser reference after the original URL succeeds.

Full tutorial: [Authentication guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/AUTH.md).

## Repair and update

```sh
ytconv repair
ytconv doctor
ytconv update
```

Or reinstall the stable npm tag:

```sh
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
```

## Security and limits

- Production npm dependencies are pinned to exact versions.
- npm publication uses public provenance.
- GitHub Actions are pinned to full commit SHAs.
- Downloaded engine assets require an expected repository, exact filename, declared size, and SHA-256 digest.
- yt-dlp runs with external configuration and remote JavaScript components disabled.
- Browser debugging is loopback-only and uses a YTConv-specific profile.
- Common npm and GitHub bearer-token environment variables are removed from isolated child processes.
- The package allowlist contains CLI files and Markdown documentation only.

No software can guarantee zero bugs, permanent compatibility with every website, or absolute security. DRM, paywalls, deleted/private media, region restrictions, rate limits, provider changes, browser encryption, and operating-system sandboxing may still prevent downloads.

Full details: [Security guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/SECURITY.md).

## Documentation index

Every link below is absolute and versioned:

- [Node.js for beginners](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/NODEJS.md)
- [Installation](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/INSTALL.md)
- [Windows](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/WINDOWS.md)
- [Linux and macOS](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/LINUX.md)
- [Termux](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/TERMUX.md)
- [iSH](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/ISH.md)
- [Commands](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/COMMANDS.md)
- [Configuration](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/CONFIGURATION.md)
- [Authentication](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/AUTH.md)
- [Dependencies](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/DEPENDENCIES.md)
- [Platforms](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/PLATFORMS.md)
- [Shells and automation](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/SHELLS.md)
- [Troubleshooting](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/TROUBLESHOOTING.md)
- [Security](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/SECURITY.md)
- [Publishing](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/PUBLISHING.md)
- [Release checklist](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/RELEASE.md)
- [Changelog](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/CHANGELOG.md)
- [License](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/LICENSE)

Publisher and maintainer: Andhika Marcella Fernanda.

License: MIT. Use YTConv only for media you are authorized to access and save.
