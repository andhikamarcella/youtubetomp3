# Linux installation by distribution family

This guide separates each Linux family on purpose. Do not copy another distribution's command only because its desktop looks similar.

## 1. Identify the distribution first

```bash
cat /etc/os-release
uname -m
```

Read `ID` and `ID_LIKE`. Linux Mint usually reports an Ubuntu/Debian family, while Manjaro follows Arch. After installation, `ytconv shell-info` prints the detected family and package manager.

The npm CLI needs Node.js **22.14.0 or newer**. After installing packages from the correct section, always check:

```bash
node --version
npm --version
ffmpeg -version
ffprobe -version
```

If Node is older than 22.14, follow the account-owned Node 24 LTS setup in [NODEJS.md](NODEJS.md). An old Node release is rejected rather than failing later with confusing syntax errors.

## 2. Arch Linux

```bash
sudo pacman -Syu --needed nodejs npm python python-pip ffmpeg ca-certificates curl tar xz
```

References: [ArchWiki Node.js](https://wiki.archlinux.org/title/Node.js) and [Arch Linux packages](https://archlinux.org/packages/).

## 3. CachyOS, Manjaro, EndeavourOS, and Garuda

These distributions follow the Arch package family, but their own repositories must remain in use:

```bash
sudo pacman -Syu --needed nodejs npm python python-pip ffmpeg ca-certificates curl tar xz
```

Do not add raw Arch repositories to Manjaro or another derivative. Complete the normal system upgrade first so multimedia libraries remain compatible.

## 4. Debian

Debian stable can provide a Node release older than YTConv requires. Install the media tools first:

```bash
sudo apt update
sudo apt install -y nodejs npm python3 python3-pip ffmpeg ca-certificates curl tar xz-utils
node --version
```

If Node is still below 22.14, use the verified Node 24 LTS steps in [NODEJS.md](NODEJS.md). Package reference: [Debian Packages](https://packages.debian.org/).

## 5. Ubuntu

For Ubuntu desktop, server, WSL, and minimal images:

```bash
sudo apt update
sudo apt install -y nodejs npm python3 python3-pip ffmpeg ca-certificates curl tar xz-utils
node --version
```

Node versions differ between Ubuntu releases. Use [NODEJS.md](NODEJS.md) when the repository version is too old. Package reference: [Ubuntu Packages](https://packages.ubuntu.com/).

## 6. Linux Mint, Pop!_OS, KDE Neon, Zorin OS, and Kali Linux

These use the Debian/Ubuntu package family for YTConv requirements:

```bash
sudo apt update
sudo apt install -y nodejs npm python3 python3-pip ffmpeg ca-certificates curl tar xz-utils
node --version
```

Keep the repositories maintained for the installed distribution. Do not replace the entire source list with Ubuntu or Debian sources just to obtain Node.

## 7. Fedora

```bash
sudo dnf install -y nodejs npm python3 python3-pip ffmpeg-free ca-certificates curl tar xz
node --version
```

If `ffmpeg-free` does not provide a codec you need, use the multimedia source approved by the Fedora documentation for that release. YTConv never changes system repositories silently. Fedora documents Node/npm installation through `dnf` in [Language Package Managers](https://docs.fedoraproject.org/en-US/quick-docs/language-package-managers/).

## 8. RHEL, CentOS Stream, Rocky Linux, and AlmaLinux

```bash
sudo dnf install -y nodejs npm python3 python3-pip ca-certificates curl tar xz
node --version
```

FFmpeg availability and the Node version depend on the release and organization repositories. Install FFmpeg from a source approved by the system administrator, then run `ffmpeg -version`. Do not enable a third-party repository without understanding the system policy.

## 9. Nobara

Nobara follows Fedora and normally includes multimedia support:

```bash
sudo dnf install -y nodejs npm python3 python3-pip ffmpeg ca-certificates curl tar xz
node --version
```

Keep the Nobara repositories instead of replacing them with raw Fedora repositories.

## 10. openSUSE Tumbleweed and Leap

```bash
sudo zypper refresh
sudo zypper --non-interactive install nodejs npm python3 python3-pip ffmpeg ca-certificates curl tar xz
node --version
```

Some codecs depend on the multimedia repository selected by the owner. Inspect package versions with `zypper search -s ffmpeg nodejs` before adding a source.

## 11. Alpine Linux

```sh
doas apk update
doas apk add --no-cache nodejs npm python3 py3-pip ffmpeg ca-certificates curl tar xz
node --version
```

Replace `doas` with `sudo` on systems configured for sudo. Keep `main` and `community` on the same Alpine release. Reference: [Alpine Package Keeper](https://wiki.alpinelinux.org/wiki/Alpine_Package_Keeper).

## 12. iSH on iPhone/iPad

iSH is Alpine-based, but uses YTConv's Python frontend because of iOS memory and compatibility limits. Do **not** follow the normal npm/Linux path. Open [ISH.md](ISH.md).

## 13. Void Linux

```bash
sudo xbps-install -Syu nodejs npm python3 python3-pip ffmpeg ca-certificates curl tar xz
node --version
```

Use the [Void Handbook](https://docs.voidlinux.org/xbps/index.html) for repository and upgrade details.

## 14. Gentoo

```bash
sudo emerge --ask net-libs/nodejs dev-lang/python media-video/ffmpeg net-misc/curl app-misc/ca-certificates app-arch/xz-utils
node --version
```

Available codecs follow the local USE flags. Review the Portage plan before approving the build.

## 15. NixOS or Nix

Test without changing the permanent configuration:

```bash
nix shell nixpkgs#nodejs_24 nixpkgs#python3 nixpkgs#ffmpeg nixpkgs#yt-dlp nixpkgs#gallery-dl
```

For permanent use, add the same packages to the owner's NixOS or home-manager configuration. Reference: [NixOS package search](https://search.nixos.org/packages).

## 16. Install and verify YTConv

Run this section only after `node --version` reports 22.14.0 or newer:

```bash
npm install --global ytconv@1.7.3
ytconv --version
ytconv repair
ytconv doctor
ytconv self-test
```

`ytconv repair` prefers a working system package. When FFmpeg is missing on Linux x64/ARM64 or Windows, the current `yt-dlp/FFmpeg-Builds` FFmpeg/ffprobe pair is downloaded, checked against GitHub's SHA-256 digest, and extracted without shell evaluation. macOS, other architectures, Termux, and iSH use package-manager FFmpeg so the executable matches the device ABI.

For npm `EACCES`, use the account-owned prefix in [NODEJS.md](NODEJS.md). Avoid blindly running a global npm installation as root.
