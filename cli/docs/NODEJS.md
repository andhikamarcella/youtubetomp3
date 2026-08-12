# Install Node.js before YTConv

The npm CLI needs Node.js 22.14.0+ and npm 10+. Node 24 LTS is recommended for YTConv 1.7.5. Official downloads are available from [nodejs.org](https://nodejs.org/en/download).

## Check an existing installation

```bash
node --version
npm --version
```

If Node is already 22.14 or newer, do not install a second copy.

## Windows 10/11

1. Download the official **LTS `.msi`** installer.
2. Keep npm and **Add to PATH** enabled.
3. Close every terminal and open a new CMD or PowerShell window.
4. Run:

```powershell
node.exe --version
npm.cmd --version
npm.cmd install -g ytconv@1.7.5
ytconv.cmd doctor
```

Using `.cmd` avoids PowerShell `.ps1` shim restrictions without weakening the execution policy.

## macOS

Use the official LTS `.pkg`, or Homebrew:

```bash
brew install node@24 python ffmpeg
brew link --overwrite --force node@24
node --version
npm install -g ytconv@1.7.5
ytconv doctor
```

## Linux: try the distribution package first

Follow the correct family in [LINUX.md](LINUX.md). If its repository still provides an older Node release, use the verified per-user installation below. It does not replace `/usr/bin/node` and does not need `sudo`.

### Linux x86_64

```bash
mkdir -p "$HOME/.local/node-v24.19.0"
cd "$(mktemp -d)"
curl -fLO https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-x64.tar.xz
printf '%s  %s\n' '14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647' 'node-v24.19.0-linux-x64.tar.xz' | sha256sum -c -
tar -xJf node-v24.19.0-linux-x64.tar.xz --strip-components=1 -C "$HOME/.local/node-v24.19.0"
export PATH="$HOME/.local/node-v24.19.0/bin:$PATH"
node --version
```

### Linux ARM64/aarch64

```bash
mkdir -p "$HOME/.local/node-v24.19.0"
cd "$(mktemp -d)"
curl -fLO https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-arm64.tar.xz
printf '%s  %s\n' '01443c1e1a29e531ccad5a46fefa6df490d2189c49f7955904aecdbb0fe86fdc' 'node-v24.19.0-linux-arm64.tar.xz' | sha256sum -c -
tar -xJf node-v24.19.0-linux-arm64.tar.xz --strip-components=1 -C "$HOME/.local/node-v24.19.0"
export PATH="$HOME/.local/node-v24.19.0/bin:$PATH"
node --version
```

Add this line to the correct `~/.profile`, `~/.bashrc`, or shell configuration file to keep the PATH after closing the terminal:

```bash
export PATH="$HOME/.local/node-v24.19.0/bin:$PATH"
```

The hashes above come from the official Node.js v24.19.0 `SHASUMS256.txt`. Do not reuse them for another release; download the matching checksum from that release's official Node.js directory.

## Android with Termux

Use a maintained Termux build:

```sh
pkg update && pkg upgrade
pkg install -y nodejs python ffmpeg curl ca-certificates
termux-setup-storage
npm install -g ytconv@1.7.5 --omit=optional
ytconv repair
ytconv doctor
```

## iPhone/iPad with iSH

Node.js is intentionally not required. Use the Python frontend in [ISH.md](ISH.md).

## npm permission error (`EACCES`)

Use an account-owned prefix:

```bash
mkdir -p "$HOME/.local/bin"
npm config set prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@1.7.5
```

Save the PATH line in the shell configuration, open a new terminal, and run `ytconv doctor`.
