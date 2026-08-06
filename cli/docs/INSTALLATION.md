# Installation

## Requirements

The Node.js distribution requires Node.js 22.14 or newer and npm 10 or newer. Downloads and conversions may also require FFmpeg, yt-dlp, or gallery-dl. Run `ytconv --diagnose` after installation to identify missing engines and path problems.

## npm installation

```bash
npm install -g ytconv@latest
ytconv --version
ytconv --diagnose
```

Install the exact 1.7.1 release with:

```bash
npm install -g ytconv@1.7.1
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

For native release files, verify `SHA256SUMS.txt` and inspect GitHub/npm provenance before running an installer.

## Uninstall

```bash
npm uninstall -g ytconv
```

Native packages should be removed through the package manager used to install them.
