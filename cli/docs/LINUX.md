# Installing YTConv 1.4.0 on Linux

This guide starts from a clean Linux installation and ends with a verified YTConv download. It covers desktop Linux, servers, SSH sessions, and the major package-manager families.

## What YTConv needs

Required:

- Node.js 18 or newer
- npm
- FFmpeg
- HTTPS CA certificates

Recommended:

- Python 3
- pip
- yt-dlp and gallery-dl installed through pip as fallback engines

Check the current system:

```bash
node --version
npm --version
python3 --version
ffmpeg -version
```

Node.js must report `v18` or newer.

## Fast universal installation

From the YTConv repository:

```bash
cd /path/to/youtubetomp3/cli
sh ./scripts/install-unix.sh --print-plan
sh ./scripts/install-unix.sh
```

The installer detects apt, dnf, pacman, zypper, apk, xbps, emerge, Nix, or Homebrew. It may use `sudo` for operating-system packages, but it does **not** run `sudo npm install -g`. The npm prefix is configured under `~/.local`.

After installation, open a new terminal or run:

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

The version must be `1.4.0`.

## Ubuntu, Debian, Linux Mint, Pop!_OS, Kali, KDE Neon

```bash
sudo apt update
sudo apt install -y nodejs npm python3 python3-pip ffmpeg ca-certificates curl
```

Check Node.js:

```bash
node --version
```

When the distribution ships Node.js older than 18, install a supported Node.js release with a version manager such as `nvm`, or use the official Node.js packages for your distribution. After Node.js is ready:

```bash
python3 -m pip install --user -U --no-cache-dir yt-dlp gallery-dl \
  || python3 -m pip install --user -U --no-cache-dir --break-system-packages yt-dlp gallery-dl

npm config set prefix "$HOME/.local"
printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.profile"
export PATH="$HOME/.local/bin:$PATH"

npm install -g ytconv@latest --force
```

Verify:

```bash
command -v ytconv
ytconv --version
ytconv --self-test
ytconv doctor
```

## Fedora, RHEL, Rocky Linux, AlmaLinux, Nobara

```bash
sudo dnf install -y nodejs npm python3 python3-pip ffmpeg ca-certificates curl
python3 -m pip install --user -U --no-cache-dir yt-dlp gallery-dl \
  || python3 -m pip install --user -U --no-cache-dir --break-system-packages yt-dlp gallery-dl

npm config set prefix "$HOME/.local"
printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.bashrc"
export PATH="$HOME/.local/bin:$PATH"

npm install -g ytconv@latest --force
ytconv --version
ytconv --self-test
ytconv doctor
```

Some Fedora-family systems require an additional multimedia repository before the `ffmpeg` package is available. Install FFmpeg using the repository recommended by your distribution, then rerun `ytconv doctor`.

## Arch Linux, CachyOS, Manjaro, EndeavourOS, Garuda

```bash
sudo pacman -Syu --needed nodejs npm python python-pip ffmpeg ca-certificates curl
python -m pip install --user -U --no-cache-dir yt-dlp gallery-dl \
  || python -m pip install --user -U --no-cache-dir --break-system-packages yt-dlp gallery-dl

npm config set prefix "$HOME/.local"
printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.bashrc"
export PATH="$HOME/.local/bin:$PATH"

npm install -g ytconv@latest --force
ytconv --version
ytconv --self-test
ytconv doctor
```

For Zsh, put the PATH line in `~/.zshrc`. For Fish:

```fish
fish_add_path $HOME/.local/bin
```

## openSUSE Leap and Tumbleweed

```bash
sudo zypper refresh
sudo zypper --non-interactive install nodejs npm python3 python3-pip ffmpeg ca-certificates curl
python3 -m pip install --user -U --no-cache-dir yt-dlp gallery-dl \
  || python3 -m pip install --user -U --no-cache-dir --break-system-packages yt-dlp gallery-dl

npm config set prefix "$HOME/.local"
printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.profile"
export PATH="$HOME/.local/bin:$PATH"

npm install -g ytconv@latest --force
ytconv --version
ytconv --self-test
ytconv doctor
```

## Alpine Linux and musl systems

Use the system FFmpeg package. A glibc-only bundled FFmpeg binary may not run on musl.

```sh
apk add --no-cache nodejs npm python3 py3-pip ffmpeg ca-certificates curl
python3 -m pip install --break-system-packages -U --no-cache-dir yt-dlp gallery-dl

npm config set prefix "$HOME/.local"
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"

npm install -g ytconv@latest --omit=optional --force
ytconv --version
ytconv --self-test
ytconv doctor
```

Persist PATH:

```sh
printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.profile"
```

## Void Linux

```bash
sudo xbps-install -Syu nodejs npm python3 python3-pip ffmpeg ca-certificates curl
python3 -m pip install --user -U --no-cache-dir yt-dlp gallery-dl \
  || python3 -m pip install --user -U --no-cache-dir --break-system-packages yt-dlp gallery-dl

npm config set prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force

ytconv --version
ytconv --self-test
ytconv doctor
```

## Gentoo

```bash
sudo emerge --ask=n net-libs/nodejs dev-lang/python media-video/ffmpeg net-misc/curl app-misc/ca-certificates
python3 -m pip install --user -U --no-cache-dir yt-dlp gallery-dl \
  || python3 -m pip install --user -U --no-cache-dir --break-system-packages yt-dlp gallery-dl

npm config set prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force

ytconv --version
ytconv --self-test
ytconv doctor
```

## NixOS and Nix

Temporary shell:

```bash
nix shell nixpkgs#nodejs_22 nixpkgs#python3 nixpkgs#ffmpeg nixpkgs#yt-dlp nixpkgs#gallery-dl
npm config set prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force
ytconv --version
ytconv doctor
```

For a permanent NixOS setup, add Node.js, Python, FFmpeg, yt-dlp, and gallery-dl to your system or Home Manager configuration, rebuild, then install YTConv with a user npm prefix.

## macOS with Homebrew

```bash
brew update
brew install node python ffmpeg
python3 -m pip install --user -U --no-cache-dir yt-dlp gallery-dl
npm config set prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force

ytconv --version
ytconv --self-test
ytconv doctor
```

## SSH and headless servers

Install using the package manager instructions above. Then use the non-interactive mode:

```bash
ytconv --headless "URL"
ytconv --headless --preset music "URL"
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

For cron, use absolute paths:

```cron
0 2 * * * /home/user/.local/bin/ytconv --headless --output /home/user/Downloads/YTConv "URL" >>/home/user/ytconv.log 2>&1
```

## Confirm that installation really works

Run these checks in order:

```bash
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

Expected result:

- YTConv version is `1.4.0`
- Node.js is 18 or newer
- yt-dlp is available
- gallery-dl is available
- FFmpeg is available
- output directory is writable
- updater uses the stable channel

Then test metadata without downloading:

```bash
ytconv info "PUBLIC_TEST_URL" --json
```

Finally, test a legal media download:

```bash
ytconv download "PUBLIC_TEST_URL" --preset mobile
```

Check the output directory printed by YTConv. The usual desktop path is:

```text
~/Downloads/YTConv
```

## Common installation failures

### `ytconv: command not found`

```bash
npm prefix -g
export PATH="$HOME/.local/bin:$PATH"
command -v ytconv
```

Persist the PATH line in `~/.profile`, `~/.bashrc`, or `~/.zshrc`.

### `EACCES` during npm install

Do not use `sudo npm install -g`. Use a user prefix:

```bash
npm config set prefix "$HOME/.local"
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force
```

### Node.js is too old

Install Node.js 18, 20, or 22, then reopen the shell and run:

```bash
node --version
npm install -g ytconv@latest --force
```

### FFmpeg is missing

Install the distribution package, then run:

```bash
ytconv repair
ytconv doctor
```

### Python reports an externally managed environment

Use the fallback supported by the distribution:

```bash
python3 -m pip install --user -U --no-cache-dir --break-system-packages yt-dlp gallery-dl
```

Alternatively, install yt-dlp and gallery-dl from the distribution repository or with `pipx`.

### Certificate, DNS, or proxy errors

Check the system clock, CA certificates, DNS, and proxy settings. Run:

```bash
ytconv doctor
ytconv --shell-info
```

## Update stable YTConv

```bash
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
ytconv --self-test
```

## Remove YTConv

```bash
npm uninstall -g ytconv
```

Downloaded media and archive files are not deleted automatically.
