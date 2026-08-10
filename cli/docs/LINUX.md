# Linux installation by distribution family

YTConv needs Node.js 22.14+ and npm 10+. Install the media packages for your family, verify Node, then install YTConv. Package names can change between distribution releases; if a command differs, use that distribution's package search.

## Arch family

CachyOS, Arch, Manjaro, EndeavourOS, and Garuda:

```bash
sudo pacman -Syu --needed nodejs npm python python-pip ffmpeg ca-certificates curl
```

## Debian family

Debian, Ubuntu, Linux Mint, Pop!_OS, Kali, and KDE Neon:

```bash
sudo apt update
sudo apt install -y nodejs npm python3 python3-pip ffmpeg ca-certificates curl
```

If the installed Node.js is older than 22.14, use a current LTS installer or version manager from the [official Node.js download page](https://nodejs.org/en/download) before installing YTConv.

## Fedora and RHEL family

Fedora, Nobara, RHEL, Rocky Linux, and AlmaLinux:

```bash
sudo dnf install -y nodejs npm python3 python3-pip ca-certificates curl
sudo dnf install -y ffmpeg
```

Some releases provide `ffmpeg-free` or require the multimedia repository recommended by the distribution. Verify the codecs you need with `ffmpeg -version`; YTConv does not silently change system repositories.

## openSUSE family

```bash
sudo zypper refresh
sudo zypper --non-interactive install nodejs npm python3 python3-pip ffmpeg ca-certificates curl
```

## Alpine and iSH

```sh
apk update
apk add --no-cache nodejs npm python3 py3-pip ffmpeg ca-certificates curl
```

iSH uses the Python frontend and does not need Node.js; follow [the dedicated iSH guide](ISH.md).

## Void

```bash
sudo xbps-install -Syu nodejs npm python3 python3-pip ffmpeg ca-certificates curl
```

## Gentoo

```bash
sudo emerge --ask net-libs/nodejs dev-lang/python media-video/ffmpeg net-misc/curl app-misc/ca-certificates
```

## NixOS or Nix

```bash
nix shell nixpkgs#nodejs_24 nixpkgs#python3 nixpkgs#ffmpeg nixpkgs#yt-dlp nixpkgs#gallery-dl
```

## Install and verify YTConv

```bash
node --version
npm --version
npm install -g ytconv@1.7.2
ytconv --version
ytconv repair
ytconv doctor
```

If global npm installation reports `EACCES`, use a version manager or a per-user npm prefix. Do not run random install scripts as root. See [Node.js setup](NODEJS.md) and [Troubleshooting](TROUBLESHOOTING.md).
