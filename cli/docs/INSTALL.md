# Complete YTConv 1.6.0 Installation Guide

YTConv 1.6.0 is the stable release published on the npm `latest` tag.

## Requirements

- Node.js 22.14 or newer and npm. These are required to run `npm install` itself.
- A working HTTPS connection and valid system certificates.

FFmpeg, yt-dlp, gallery-dl, Ink, React, and other runtime dependencies are prepared automatically by npm installation. Python 3 is not required on desktop Windows because YTConv uses standalone binaries; Python remains a fallback on selected platforms.

Check the requirements:

```bash
node --version
npm --version
```

After installation, `ytconv doctor` checks every engine and `ytconv repair` downloads any missing or broken component again.

## Windows CMD

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
where ytconv
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

Do not install FFmpeg, yt-dlp, gallery-dl, or Python manually first. Try the automatic installation above; use `ytconv.cmd repair` only when diagnostics are still failing.

The version must be `1.6.0`.

Local repository installation:

```cmd
cd C:\path\to\youtubetomp3\cli
npm.cmd install
npm.cmd run check
npm.cmd test
npm.cmd install -g . --force
ytconv.cmd --version
```

## Windows PowerShell

Use `npm.cmd` and `ytconv.cmd` for maximum compatibility with execution policy:

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
Get-Command ytconv.cmd -All
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

There is no need to weaken the PowerShell execution policy. Continue using the generated `.cmd` shims.

## Linux universal installer

From the repository:

```bash
cd /path/to/youtubetomp3/cli
sh ./scripts/install-unix.sh --print-plan
sh ./scripts/install-unix.sh
```

The installer recognizes apt, dnf, pacman, zypper, apk, xbps, emerge, Nix, and Homebrew. It may request administrator access for operating-system packages but installs the npm package with a user prefix under `~/.local`.

Open a new shell or run:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Then verify:

```bash
ytconv --version
ytconv --self-test
ytconv doctor
ytconv --shell-info
```

The complete distribution-by-distribution procedure is in [LINUX.md](LINUX.md).

## Direct Linux/macOS npm installation

After Node.js, npm, Python, and FFmpeg are installed:

```bash
python3 -m pip install --user -U --no-cache-dir "yt-dlp[default]" gallery-dl \
  || python3 -m pip install --user -U --no-cache-dir --break-system-packages "yt-dlp[default]" gallery-dl

npm config set prefix "$HOME/.local"
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force

ytconv --version
ytconv --self-test
ytconv doctor
```

## macOS with Homebrew

```bash
brew update
brew install node python ffmpeg
python3 -m pip install --user -U --no-cache-dir "yt-dlp[default]" gallery-dl
npm config set prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force
ytconv doctor
```

## Android Termux

Use a maintained Termux build.

```bash
pkg update
pkg upgrade -y
pkg install -y nodejs python ffmpeg curl ca-certificates
termux-setup-storage
python -m pip install -U --no-cache-dir "yt-dlp[default]" gallery-dl
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --omit=optional --force
ytconv repair
ytconv --self-test
ytconv doctor
```

Accept the Android storage permission dialog. Default output:

```text
~/storage/downloads/YTConv
```

Repository installer:

```bash
sh ./scripts/install-termux.sh
```

## iPhone and iPad through iSH

The iSH frontend is native Python because modern Node.js TUI dependencies are not a good match for iSH.

```sh
apk update
apk add python3 py3-pip ffmpeg curl ca-certificates
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/release/ytconv-1.6.0-cli-only-final/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
ytconv doctor
```

Default output:

```text
~/Downloads/YTConv
```

The folder is visible through Files → iSH.

## SSH and servers without a TUI

```bash
npm install -g ytconv@latest --force
ytconv --headless "URL"
```

Batch:

```bash
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

Pipe URLs through standard input:

```bash
printf '%s\n' "URL1" "URL2" | ytconv --stdin --jobs 2 --continue-on-error
```

## Run without global installation

```bash
npx -y ytconv@latest --help
npx -y ytconv@latest download "URL"
```

## Final verification

Run every command below:

```bash
ytconv --version
ytconv --self-test
ytconv doctor
ytconv --shell-info
ytconv --examples
```

Expected:

- version `1.6.0`
- Node.js 22.14 or newer
- yt-dlp ready
- gallery-dl ready
- FFmpeg ready
- writable output directory
- stable update channel

Metadata-only test:

```bash
ytconv info "PUBLIC_TEST_URL" --json
```

Legal test download:

```bash
ytconv download "PUBLIC_TEST_URL" --preset mobile
```

## Update

```bash
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
```

Or:

```bash
ytconv update
```

A failed update does not delete the previous installation or downloaded files.

## Uninstall

```bash
npm uninstall -g ytconv
```

Optional iSH removal:

```sh
rm -f /usr/local/bin/ytconv
rm -rf /usr/local/lib/ytconv-ish
```

Downloaded files and archives remain until the user removes them.
