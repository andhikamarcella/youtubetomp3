# Installing YTConv 1.6.2 on Linux and macOS

This guide covers desktop Linux, macOS, WSL, servers, SSH sessions, and major package-manager families.

## Step 1: install Node.js first

Read the [beginner Node.js guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/NODEJS.md).

YTConv requires:

```text
Node.js 22.14.0 or newer
npm 10 or newer
```

The recommended cross-distribution beginner method is a per-user Node.js installation with nvm:

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install --lts
nvm use --lts
node --version
npm --version
```

Close and reopen the terminal after installation when `nvm`, `node`, or `npm` is not immediately available.

## Step 2: install YTConv

```sh
npm install -g ytconv@latest --force
ytconv --version
ytconv --self-test
ytconv repair
ytconv doctor
```

Expected version:

```text
1.6.1
```

## Avoid `sudo npm install -g`

Use a per-user npm prefix when global installation reports `EACCES`:

```sh
mkdir -p "$HOME/.local/bin"
npm config set prefix "$HOME/.local"
printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.profile"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force
```

For Zsh, put the PATH line in `~/.zshrc` or `~/.zprofile`. For Fish:

```fish
fish_add_path $HOME/.local/bin
```

## Universal repository installer

From the YTConv `cli` directory:

```sh
sh ./scripts/install-unix.sh --print-plan
sh ./scripts/install-unix.sh
```

The installer detects apt, dnf, pacman, zypper, apk, xbps, emerge, Nix, and Homebrew. It may use administrator privileges for operating-system packages, but installs the npm package with a user prefix.

## Ubuntu, Debian, Linux Mint, Pop!_OS, Kali, KDE Neon

Install system media tools:

```sh
sudo apt update
sudo apt install -y python3 python3-pip ffmpeg ca-certificates curl
```

Install Node.js with the nvm section above when the distribution package is older than 22.14.0.

Optional Python fallback engines:

```sh
python3 -m pip install --user -U --no-cache-dir 'yt-dlp[default]' gallery-dl \
  || python3 -m pip install --user -U --no-cache-dir --break-system-packages 'yt-dlp[default]' gallery-dl
```

Then install YTConv:

```sh
npm install -g ytconv@latest --force
ytconv doctor
```

## Fedora, RHEL, Rocky Linux, AlmaLinux, Nobara

```sh
sudo dnf install -y python3 python3-pip ffmpeg ca-certificates curl
```

Install Node.js LTS with nvm when the active `node --version` does not meet the requirement. Some Fedora-family systems require the multimedia repository recommended by the distribution before `ffmpeg` is available.

## Arch Linux, CachyOS, Manjaro, EndeavourOS, Garuda

```sh
sudo pacman -Syu --needed python python-pip ffmpeg ca-certificates curl
```

The distribution Node.js package is normally recent, but verify before installation:

```sh
node --version
npm --version
```

Use nvm when the installed version is too old or when a per-user Node.js installation is preferred.

## openSUSE Leap and Tumbleweed

```sh
sudo zypper refresh
sudo zypper --non-interactive install python3 python3-pip ffmpeg ca-certificates curl
```

Install and verify Node.js before YTConv.

## Alpine Linux and musl systems

```sh
apk add --no-cache nodejs npm python3 py3-pip ffmpeg ca-certificates curl
node --version
npm --version
python3 -m pip install --break-system-packages -U --no-cache-dir 'yt-dlp[default]' gallery-dl
npm install -g ytconv@latest --omit=optional --force
ytconv doctor
```

Use the system FFmpeg package. A glibc-only binary may not run on musl.

## Void Linux

```sh
sudo xbps-install -Syu nodejs npm python3 python3-pip ffmpeg ca-certificates curl
node --version
npm --version
npm install -g ytconv@latest --force
```

## Gentoo

```sh
sudo emerge --ask=n net-libs/nodejs dev-lang/python media-video/ffmpeg net-misc/curl app-misc/ca-certificates
node --version
npm --version
npm install -g ytconv@latest --force
```

## NixOS and Nix

Temporary environment:

```sh
nix shell nixpkgs#nodejs_24 nixpkgs#python3 nixpkgs#ffmpeg nixpkgs#yt-dlp nixpkgs#gallery-dl
npm config set prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force
ytconv doctor
```

For permanent use, add the packages to NixOS or Home Manager configuration.

## macOS

Official Node.js installer method:

1. Open <https://nodejs.org/en/download>.
2. Choose the current LTS release.
3. Install the matching Apple Silicon or Intel package.
4. Reopen Terminal.

Homebrew alternative:

```sh
brew update
brew install node python ffmpeg
node --version
npm --version
npm install -g ytconv@latest --force
ytconv doctor
```

Use the per-user npm prefix shown above when needed.

## WSL and SSH servers

Follow the Linux Node.js steps, then use headless mode:

```sh
ytconv --headless download "URL"
ytconv --headless --preset music download "URL"
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

For cron, use absolute executable and output paths.

## Verification

```sh
command -v node
command -v npm
command -v ytconv
command -v ffmpeg
node --version
npm --version
ytconv --version
ytconv --self-test
ytconv doctor
ytconv --shell-info
```

Expected:

- YTConv `1.6.1`;
- Node.js 22.14.0 or newer;
- npm 10 or newer;
- yt-dlp, gallery-dl, and FFmpeg ready or repairable;
- writable output directory;
- stable update channel.

## Common failures

### `ytconv: command not found`

```sh
npm prefix -g
export PATH="$HOME/.local/bin:$PATH"
command -v ytconv
```

### `EACCES` during npm installation

Use the per-user npm prefix. Do not blindly change ownership of system directories.

### Node.js is too old

```sh
nvm install --lts
nvm use --lts
node --version
npm install -g ytconv@latest --force
```

### Python is externally managed

Use the distribution package, pipx, or the documented `--break-system-packages` fallback only when appropriate for that environment.

### FFmpeg is missing

Install the distribution FFmpeg package, then:

```sh
ytconv repair
ytconv doctor
```

## Update

```sh
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
ytconv --self-test
```

## Remove

```sh
npm uninstall -g ytconv
```

Downloaded media and archive files are not removed automatically.
