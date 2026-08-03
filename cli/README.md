# YTConv CLI 1.6.0

YTConv is a responsive, CLI-only media downloader and converter for Windows, macOS, desktop Linux, Android Termux, and iPhone/iPad through iSH. It routes video and audio work to yt-dlp, image and gallery work to gallery-dl, and conversion work to FFmpeg.

Version 1.6.0 is the only active release channel. Install it from npm `latest`:

```sh
npm install -g ytconv@latest --force
ytconv --version
ytconv doctor
```

Expected version:

```text
1.6.0
```

## What changed in 1.6.0

- Monochrome terminal UI: normal, focused, working, and successful states use the terminal foreground color; only errors use red.
- Responsive layout for narrow Termux/iSH windows, standard terminals, maximized Windows Terminal, and resized SSH sessions.
- Stable-only updater: every installation checks and installs `ytconv@latest`.
- Verified engine downloads: YTConv requires GitHub Release SHA-256 digests before accepting yt-dlp, gallery-dl, or fallback FFmpeg executables.
- Private engine directory: verified executables are stored under `~/.ytconv/engines`, outside the npm package directory.
- Local token-free profile: legacy cloud bearer tokens and email addresses are removed during migration.
- Safer extractors: external configuration and remote JavaScript components are disabled; a local supported JavaScript runtime is used.
- Expanded `doctor`: Node.js, npm, Python, yt-dlp, gallery-dl, FFmpeg, ffprobe, JavaScript runtimes, browsers, distribution, and package-manager guidance are detected.
- Complete English documentation and platform-specific tutorials.
- Exact production dependency versions, npm provenance, action pinning, security tests, package audit, and release checks.

No software can honestly guarantee zero bugs, support every changing website, or provide “100% security.” YTConv 1.6.0 instead uses explicit controls, repeatable tests, verified artifacts, least-privilege storage, and documented limitations.

## Requirements

For the npm CLI:

- Node.js 22.14.0 or newer
- npm 10 or newer
- Internet access to the requested site and engine release endpoints
- Enough free storage for media and temporary conversion files

YTConv automatically prepares yt-dlp, gallery-dl, and FFmpeg on supported desktop architectures. Termux and iSH use their native package/Python environments. See [Dependency Guide](docs/DEPENDENCIES.md).

## Install by platform

### Windows CMD

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd repair
ytconv.cmd doctor
```

Use `.cmd` explicitly when PowerShell execution policy or PATH command precedence is unclear.

### Windows PowerShell

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

Complete Windows instructions: [Windows Guide](docs/WINDOWS.md).

### macOS or desktop Linux

```sh
npm uninstall -g ytconv || true
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
ytconv repair
ytconv doctor
```

If global npm writes require administrator access, use the user-local prefix described in [Installation Guide](docs/INSTALL.md). Distribution commands are in [Linux Guide](docs/LINUX.md).

### Android Termux

Install Termux from F-Droid or GitHub, not an obsolete store build. Then:

```sh
pkg update && pkg upgrade -y
pkg install -y nodejs python ffmpeg
termux-setup-storage
python -m pip install -U 'yt-dlp[default]' gallery-dl
npm install -g ytconv@latest --force
ytconv repair
ytconv doctor
```

Android prevents Termux from reading private browser databases. Public URLs work; media that requires a signed-in browser session should be processed on a desktop. See [Termux Guide](docs/TERMUX.md).

### iPhone or iPad with iSH

Inside iSH/Alpine:

```sh
apk update
apk add python3 py3-pip ffmpeg curl ca-certificates
python3 -m pip install -U --break-system-packages 'yt-dlp[default]' gallery-dl
```

Then follow [iSH Guide](docs/ISH.md). iOS sandboxes Safari from iSH, and iSH is emulated Alpine rather than a native iOS downloader. Public links are the supported path.

## First run

```sh
ytconv quickstart
ytconv --self-test
ytconv --shell-info
ytconv doctor
```

`doctor` must end with:

```text
Status: ready to use.
```

Optional tools such as ffprobe or a desktop browser may be listed as recommendations without blocking public downloads.

## Download examples

Interactive:

```sh
ytconv
```

Direct video, audio, images, and playlists:

```sh
ytconv download "URL"
ytconv download "URL" --mode video --resolution 1080 --video-format mp4
ytconv download "URL" --mode audio --audio-format mp3 --audio-quality 320
ytconv download "URL" --mode image --image-format original
ytconv playlist "URL" --playlist-items 1-20
```

Headless or SSH:

```sh
ytconv --headless download "URL"
printf '%s\n' "URL1" "URL2" | ytconv --stdin --jobs 2 --continue-on-error
ytconv batch links.txt --jobs 2 --result-json report.json
```

## Official social-site login

For account-required media on desktop:

```sh
ytconv login instagram
ytconv social status
ytconv download "INSTAGRAM_URL"
```

YTConv opens the provider’s official page in a dedicated browser profile. Complete the password and OTP/2FA in that browser. YTConv verifies the exact failed URL before saving only the provider-to-browser reference.

YTConv does not store the password, OTP, raw persistent cookie database, npm token, or GitHub token. A provider-only cookie file may be created temporarily for one attempt with user-only permissions and is deleted on success or failure.

See [Authentication Guide](docs/AUTH.md).

## Monochrome UI and red errors

YTConv intentionally does not paint normal output cyan, green, or yellow. Focus uses borders, bold text, inverse text, and spacing. Errors may use red when stderr is a TTY. Red is automatically disabled when output is redirected, `NO_COLOR` is present, `FORCE_COLOR=0`, or `TERM=dumb`.

```sh
NO_COLOR=1 ytconv doctor
ytconv --no-color --headless download "URL"
```

Child engines always receive `NO_COLOR=1` and `FORCE_COLOR=0` so their progress output cannot reintroduce unrelated colors.

## Configuration and profiles

```sh
ytconv config set output "$HOME/Downloads/YTConv"
ytconv config set subtitles true
ytconv profile set music preset=music audioQuality=320
ytconv --profile music download "URL"
ytconv history list
ytconv completion bash
```

Full reference: [Configuration Guide](docs/CONFIGURATION.md) and [Command Reference](docs/COMMANDS.md).

## Repair and update

```sh
ytconv repair
ytconv doctor
ytconv update
```

The updater always installs npm `latest`. The retired prerelease dist-tag is removed by the 1.6.0 release workflow. Previously published immutable npm version records may remain in registry history, but they are not an install channel.

## Security and integrity

- Production npm dependencies are pinned to exact versions.
- npm publication uses public provenance.
- GitHub Actions are pinned to full commit SHAs.
- Downloaded release assets require a GitHub-provided `sha256:` digest and exact declared size.
- Downloads use HTTPS, expected repository paths, timeouts, retry limits, size limits, private temporary files, and atomic replacement.
- yt-dlp runs with `--ignore-config`, `--no-colors`, and `--no-remote-components`.
- Managed Chromium debugging binds to `127.0.0.1`, uses an ephemeral port, disables extensions and sync, and stores its profile under the user’s YTConv directory.
- Child processes do not receive common npm/GitHub bearer-token environment variables where isolation matters.

Read [Security Guide](docs/SECURITY.md) before using browser sessions or automation.

## Support boundaries

Site support changes upstream. A recognized platform does not guarantee every URL. DRM, paywalls, private/deleted media, geographic restrictions, provider API changes, rate limits, account policy, browser encryption, and OS sandboxing can still prevent a download. Use YTConv only for media you are authorized to access and save.

## Documentation index

- [Installation](docs/INSTALL.md)
- [Windows](docs/WINDOWS.md)
- [Linux and macOS](docs/LINUX.md)
- [Termux](docs/TERMUX.md)
- [iSH](docs/ISH.md)
- [Commands](docs/COMMANDS.md)
- [Configuration](docs/CONFIGURATION.md)
- [Authentication](docs/AUTH.md)
- [Dependencies](docs/DEPENDENCIES.md)
- [Platforms](docs/PLATFORMS.md)
- [Shells and automation](docs/SHELLS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Security](docs/SECURITY.md)
- [Publishing](docs/PUBLISHING.md)
- [Release checklist](docs/RELEASE.md)

Publisher and maintainer: Andhika Marcella Fernanda. Repository owner: `andhikamarcella`. No organization identity is claimed because this package is currently published from the named personal repository and npm publisher metadata.

License: MIT. Site terms and media rights remain the user’s responsibility.
