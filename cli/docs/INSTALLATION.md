# Install YTConv 1.7.4

This short guide helps you choose the correct setup path. If the terminal is new to you, run one block at a time and read its message before continuing.

## Choose your device

| Device | Guide |
|---|---|
| Windows 10/11 | [Node.js and `.cmd` commands](NODEJS.md#windows-1011) |
| macOS | [Node.js on macOS](NODEJS.md#macos) |
| Linux, WSL, or SSH | [Each distribution family](LINUX.md) |
| Android with Termux | [Termux](TERMUX.md) |
| iPhone/iPad with iSH | [iSH Python frontend](ISH.md) |
| Android APK | [Native packages](PACKAGES.md) |

The npm CLI needs Node.js 22.14.0+ and npm 10+. iSH uses the Python frontend and does not need Node.js.

## Install from npm

```bash
npm install --global ytconv@1.7.4
ytconv --version
ytconv repair
ytconv doctor
ytconv self-test
```

The expected version is `1.7.4`. `repair` prepares missing media engines. `doctor` checks the installation and explains any remaining problem.

## First examples

MP4 video:

```bash
ytconv "URL" --mode video --video-format mp4
```

MP3 audio:

```bash
ytconv "URL" --mode audio --audio-format mp3
```

Always quote the URL so `?`, `&`, and `=` are not interpreted by the shell.

## Upgrade

```bash
npm install --global ytconv@latest
ytconv --version
ytconv repair
```

## Development installation

```bash
git clone --branch release/ytconv-1.7.4 https://github.com/andhikamarcella/YTConv.git
cd YTConv/cli
npm ci --ignore-scripts
npm link
ytconv --help
```

This branch is the canonical source for the npm 1.7.4 documentation.

## Inspect the package source

```bash
npm view ytconv@1.7.4 version repository dist.integrity
npm pack ytconv@1.7.4 --dry-run
```

For native files, compare `SHA256SUMS.txt` and inspect the npm/GitHub provenance before running an installer.

## Uninstall

```bash
npm uninstall --global ytconv
```

Remove a native package through the same package manager that installed it. User configuration under `~/.ytconv` is preserved so settings and history are not erased without consent.
