# Complete YTConv 1.6.2 Installation Guide

YTConv 1.6.2 is the stable npm `latest` release.

## Read this first

On Windows, macOS, Linux, WSL, SSH servers, and Termux, install Node.js before installing YTConv. Follow the complete [beginner Node.js guide](https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/NODEJS.md).

Required versions:

```text
Node.js 22.14.0 or newer
npm 10 or newer
```

Verify:

```sh
node --version
npm --version
```

The iSH edition is different: it uses the maintained Python frontend and does not require Node.js.

## Windows CMD

After installing Node.js LTS and reopening CMD:

```cmd
node.exe --version
npm.cmd --version
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
where ytconv
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd repair
ytconv.cmd doctor
```

Expected version:

```text
1.6.2
```

Full Windows tutorial: [WINDOWS.md](https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/WINDOWS.md).

## Windows PowerShell

Use `.cmd` shims so PowerShell execution policy does not block npm or YTConv:

```powershell
node.exe --version
npm.cmd --version
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
Get-Command ytconv.cmd -All
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd repair
ytconv.cmd doctor
```

Do not weaken the system execution policy solely for YTConv.

## macOS

Install a current Node.js LTS release first. Then use a per-user npm prefix:

```sh
mkdir -p "$HOME/.local/bin"
npm config set prefix "$HOME/.local"
printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.zprofile"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force
ytconv --version
ytconv --self-test
ytconv repair
ytconv doctor
```

Full tutorial: [LINUX.md](https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/LINUX.md).

## Desktop Linux

Install Node.js first with the beginner guide. Then either install directly:

```sh
npm install -g ytconv@latest --force
ytconv --version
ytconv --self-test
ytconv repair
ytconv doctor
```

Or run the repository installer:

```sh
cd /path/to/youtubetomp3/cli
sh ./scripts/install-unix.sh --print-plan
sh ./scripts/install-unix.sh
```

The installer detects apt, dnf, pacman, zypper, apk, xbps, emerge, Nix, and Homebrew. It uses a user npm prefix under `~/.local` rather than `sudo npm`.

When needed:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

## Android Termux

Use a maintained Termux build. Then:

```sh
pkg update
pkg upgrade -y
pkg install -y nodejs python ffmpeg curl ca-certificates
node --version
npm --version
termux-setup-storage
python -m pip install -U --no-cache-dir 'yt-dlp[default]' gallery-dl
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --omit=optional --force
ytconv --version
ytconv --self-test
ytconv repair
ytconv doctor
```

Default output:

```text
~/storage/downloads/YTConv
```

Full tutorial: [TERMUX.md](https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/TERMUX.md).

## iPhone and iPad through iSH

Node.js is not required for the supported iSH edition.

```sh
apk update
apk add --no-cache python3 py3-pip ffmpeg curl ca-certificates
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/YTConv/release/ytconv-1.6.2-cli-only-final/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
ytconv --diagnose
```

Default output:

```text
~/Downloads/YTConv
```

Full tutorial: [ISH.md](https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/ISH.md).

## WSL and SSH servers

Follow the Linux Node.js instructions, then:

```sh
npm install -g ytconv@latest --force
ytconv --headless --help
```

Batch example:

```sh
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

## Run without a permanent global installation

After Node.js is ready:

```sh
npx -y ytconv@latest --help
npx -y ytconv@latest download "URL"
```

## Final verification

```sh
ytconv --version
ytconv --self-test
ytconv doctor
ytconv --shell-info
ytconv --examples
```

Expected:

- YTConv `1.6.2`;
- Node.js 22.14.0 or newer on npm platforms;
- npm 10 or newer;
- yt-dlp ready;
- gallery-dl ready;
- FFmpeg ready;
- writable output directory;
- stable update channel.

## Update

```sh
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
```

Or:

```sh
ytconv update
```

## Uninstall

```sh
npm uninstall -g ytconv
```

Optional iSH removal:

```sh
rm -f /usr/local/bin/ytconv
rm -rf /usr/local/lib/ytconv-ish
```

Downloaded media and user data remain until the user removes them.
