# Install Node.js Before YTConv

YTConv 1.6.2 uses Node.js on Windows, macOS, desktop Linux, Android Termux, WSL, SSH servers, and other supported npm environments. Install Node.js first, close and reopen the terminal, and only then install YTConv.

YTConv requires:

```text
Node.js 22.14.0 or newer
npm 10 or newer
```

The recommended choice is a current Node.js LTS release that satisfies the requirement. Do not install an obsolete Node.js release just because it appears in an old tutorial.

Official Node.js download page: <https://nodejs.org/en/download>

## Check whether Node.js is already installed

Open the terminal for your platform and run:

```sh
node --version
npm --version
```

A supported result looks similar to:

```text
v24.x.x
11.x.x
```

The exact patch numbers may be newer. The important requirement is Node.js 22.14.0 or newer and npm 10 or newer.

If `node`, `node.exe`, `npm`, or `npm.cmd` is not found, follow the matching platform section below.

## Windows 10 or Windows 11

### Beginner method: official installer

1. Open <https://nodejs.org/en/download>.
2. Choose the current **LTS** release.
3. Download the Windows Installer for your device:
   - x64 for most Intel and AMD computers;
   - ARM64 only for Windows on ARM devices.
4. Open the downloaded installer.
5. Keep **npm package manager** and **Add to PATH** enabled.
6. Finish the installation.
7. Close every CMD, PowerShell, and Windows Terminal window.
8. Open a new terminal.

Verify in CMD:

```cmd
node.exe --version
npm.cmd --version
```

Verify in PowerShell:

```powershell
node.exe --version
npm.cmd --version
```

Then install YTConv:

```cmd
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd doctor
```

Use `npm.cmd` and `ytconv.cmd` when PowerShell reports that a `.ps1` script is blocked. You do not need to weaken the PowerShell execution policy.

### Optional Windows Package Manager method

Open Terminal as a normal user and run:

```powershell
winget search Node.js
winget install --id OpenJS.NodeJS.LTS --exact
```

Close and reopen the terminal before running the verification commands.

## macOS

### Beginner method: official installer

1. Open <https://nodejs.org/en/download>.
2. Choose the current **LTS** release.
3. Download the macOS Installer.
4. Select the installer matching Apple Silicon or Intel when the page offers separate builds.
5. Complete the installer and reopen Terminal.

Verify:

```sh
node --version
npm --version
```

Install YTConv without `sudo npm`:

```sh
mkdir -p "$HOME/.local/bin"
npm config set prefix "$HOME/.local"
printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.zprofile"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force
ytconv --version
ytconv doctor
```

### Homebrew method

```sh
brew update
brew install node
node --version
npm --version
```

## Ubuntu, Debian, Linux Mint, Fedora, Arch, openSUSE, and other desktop Linux distributions

A distribution repository may provide an older Node.js release. The beginner-friendly cross-distribution method is `nvm`, which installs Node.js for the current user without replacing system files.

Install `curl` first with the system package manager when it is missing. Then:

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.6/install.sh | bash
```

Close and reopen the terminal, or load nvm in the current shell:

```sh
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
```

Install and use the current LTS release:

```sh
nvm install --lts
nvm use --lts
node --version
npm --version
```

Then install YTConv:

```sh
npm install -g ytconv@latest --force
ytconv --version
ytconv doctor
```

When `npm install -g` reports a permission error, do not immediately use `sudo npm`. Use a per-user prefix instead:

```sh
mkdir -p "$HOME/.local/bin"
npm config set prefix "$HOME/.local"
printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.profile"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force
```

## WSL and Linux SSH servers

Use the Linux `nvm` instructions above. After reconnecting through SSH, verify that the shell loaded nvm:

```sh
command -v nvm
node --version
npm --version
```

For non-interactive servers:

```sh
ytconv --headless --help
```

## Android with Termux

Use a maintained Termux build from F-Droid or the official Termux GitHub project. Do not use an obsolete store build.

Inside Termux:

```sh
pkg update
pkg upgrade -y
pkg install -y nodejs python ffmpeg curl ca-certificates
node --version
npm --version
```

The installed Node.js version must be 22.14.0 or newer. When it is older, update the Termux repositories and packages before installing YTConv.

Then:

```sh
termux-setup-storage
npm install -g ytconv@latest --omit=optional --force
ytconv --version
ytconv repair
ytconv doctor
```

## iPhone and iPad with iSH

**Node.js is intentionally not required for the iSH edition.** iSH runs an emulated Alpine environment with tighter compatibility and memory limits. YTConv therefore uses its maintained Python frontend in iSH instead of the Node.js/Ink interface.

Install the native iSH requirements:

```sh
apk update
apk add --no-cache python3 py3-pip ffmpeg curl ca-certificates
```

Then use the iSH installer described in the [iSH guide](https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/ISH.md).

Do not force a desktop Node.js tutorial into iSH. The native Python path is the supported installation for iPhone and iPad.

## Chromebook

For a Chromebook with the Linux development environment enabled, open the Linux Terminal and follow the desktop Linux `nvm` instructions. Native ChromeOS without the Linux environment is not an npm terminal target.

## Final verification before installing YTConv

Run:

```sh
node --version
npm --version
```

Confirm:

- Node.js is 22.14.0 or newer;
- npm is 10 or newer;
- the commands still work after closing and reopening the terminal;
- iSH users are following the Python exception instead.

Then install and verify YTConv:

```sh
npm install -g ytconv@latest --force
ytconv --version
ytconv --self-test
ytconv doctor
```

On Windows use:

```cmd
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

Expected YTConv version for this release:

```text
1.6.2
```

## Common beginner problems

### `node` or `npm` is not recognized

Close and reopen the terminal. If the problem remains, reinstall the official Node.js LTS package with PATH support enabled.

### The Node.js version is too old

Upgrade to a current LTS release. Do not attempt to bypass YTConv's engine requirement.

### PowerShell blocks `npm.ps1`

Use `npm.cmd` and `ytconv.cmd` instead of changing the system execution policy.

### Linux reports `EACCES` during global installation

Use the per-user npm prefix shown above. Do not change ownership of system directories blindly.

### More than one Node.js installation appears

Inspect the active executable:

```sh
command -v node
command -v npm
```

Windows:

```cmd
where node
where npm
```

Remove or reorder obsolete installations, reopen the terminal, and verify again.
