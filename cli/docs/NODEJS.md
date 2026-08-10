# Install Node.js before YTConv

The npm CLI requires Node.js 22.14.0+ and npm 10+. Node 22 and 24 are supported LTS lines; use a current LTS release from the [official Node.js download page](https://nodejs.org/en/download).

## Check first

```bash
node --version
npm --version
```

## Windows 10/11

Install the official LTS `.msi`, keep npm and “Add to PATH” enabled, close all terminals, and open a new CMD or PowerShell window:

```powershell
node.exe --version
npm.cmd --version
npm.cmd install -g ytconv@1.7.2
ytconv.cmd doctor
```

Using `.cmd` avoids PowerShell script-policy problems without weakening the execution policy.

## macOS

Install the official LTS `.pkg`, or use Homebrew:

```bash
brew install node ffmpeg python
npm install -g ytconv@1.7.2
ytconv doctor
```

## Linux, WSL, and SSH

Install Node/npm from the matching distribution family in [LINUX.md](LINUX.md). If the repository version is too old, use the official LTS installer or a user-scoped version manager. npm also recommends version managers to avoid global-permission errors.

## Android Termux

Use a maintained Termux build:

```sh
pkg update
pkg install -y nodejs python ffmpeg curl ca-certificates
termux-setup-storage
npm install -g ytconv@1.7.2 --omit=optional
ytconv repair
ytconv doctor
```

## iPhone/iPad with iSH

Node.js is intentionally not required. Use the maintained Python frontend in [ISH.md](ISH.md).

## npm permission errors

Prefer a Node version manager. A per-user prefix also works:

```bash
mkdir -p "$HOME/.local/bin"
npm config set prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@1.7.2
```

Add the PATH export to your shell profile, then reopen the terminal.
