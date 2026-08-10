# Installation

## Requirements

The Node.js distribution requires Node.js 22.14 or newer and npm 10 or newer. A current Node.js LTS release is recommended. Downloads and conversions may also require FFmpeg, yt-dlp, gallery-dl, and a supported JavaScript runtime. Run `ytconv repair` and `ytconv --diagnose` after installation.

Start with [Node.js setup](NODEJS.md), or copy the command for your [Linux distribution family](LINUX.md). iPhone/iPad users should use the [iSH Python guide](ISH.md).

## npm installation

```bash
npm install -g ytconv@latest
ytconv --version
ytconv repair
ytconv --diagnose
```

Install the exact 1.7.2 release with:

```bash
npm install -g ytconv@1.7.2
```

## Upgrade

```bash
npm install -g ytconv@latest
ytconv --version
```

## Development installation

```bash
git clone https://github.com/andhikamarcella/YTConv.git
cd YTConv/cli
npm ci
npm link
ytconv --help
```

## Verification

```bash
ytconv --version
ytconv --diagnose
npm view ytconv@latest version
```

Expected YTConv version: `1.7.2`.

For native release files, verify `SHA256SUMS.txt` and inspect GitHub/npm provenance before running an installer.

## Uninstall

```bash
npm uninstall -g ytconv
```

Native packages should be removed through the package manager used to install them.
