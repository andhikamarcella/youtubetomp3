# YTConv 1.6.2 on Windows

## Step 1: install Node.js first

Follow the [beginner Node.js guide for Windows](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/NODEJS.md#windows-10-or-windows-11).

Recommended beginner path:

1. Download the current Node.js LTS Windows Installer from <https://nodejs.org/en/download>.
2. Keep npm and Add to PATH enabled.
3. Finish the installer.
4. Close every terminal window.
5. Open a new CMD, PowerShell, or Windows Terminal window.

Verify:

```cmd
node.exe --version
npm.cmd --version
```

YTConv requires Node.js 22.14.0 or newer and npm 10 or newer.

## Step 2: install YTConv in CMD

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd repair
ytconv.cmd --self-test
ytconv.cmd doctor
```

## Step 2 alternative: PowerShell

Use `npm.cmd` and `ytconv.cmd` to avoid script-policy conflicts:

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd repair
ytconv.cmd --self-test
ytconv.cmd doctor
```

Expected output includes:

```text
1.6.1
Status: ready to use.
```

## Supported Windows systems

- Windows 10 or Windows 11.
- x64 for most Intel and AMD computers.
- ARM64 for Windows on ARM, subject to matching media-engine availability.
- CMD, PowerShell, and Windows Terminal.
- Current Chrome, Edge, Firefox, Brave, or another supported browser for account-required media.

## Repository installer

From a checked-out `cli` directory:

```cmd
scripts\install-windows.cmd --local
```

PowerShell:

```powershell
.\scripts\install-windows.ps1 -Local
```

The local installer runs syntax and unit tests before global installation. The public path always installs npm `latest`.

## Official Instagram login

```powershell
ytconv.cmd social logout instagram
ytconv.cmd login instagram
```

Complete sign-in and OTP/2FA in the official browser page opened by YTConv. Return to the terminal after the site shows the signed-in account.

Choose another browser when needed:

```powershell
ytconv.cmd login instagram --browser firefox
ytconv.cmd login instagram --browser edge --profile "Profile 2"
```

## Download examples

```cmd
ytconv.cmd download "URL"
ytconv.cmd download "URL" --mode audio --audio-format mp3 --audio-quality 320
ytconv.cmd download "URL" --mode video --resolution 1080 --video-format mp4
ytconv.cmd batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

## PATH problems

CMD:

```cmd
where node
where npm
where ytconv
npm.cmd config get prefix
```

PowerShell:

```powershell
Get-Command node -All
Get-Command npm -All
Get-Command ytconv -All
npm.cmd config get prefix
```

Close and reopen the terminal after installing Node.js or YTConv. If several obsolete commands appear, remove the old installation and reinstall once.

## PowerShell execution policy

An error involving `npm.ps1` or `ytconv.ps1` does not require weakening the system policy. Continue with `npm.cmd` and `ytconv.cmd`.

## Repair media engines

```powershell
$env:NO_COLOR = "1"
ytconv.cmd repair
ytconv.cmd doctor
```

Verified engines are stored under:

```text
%USERPROFILE%\.ytconv\engines
```

Do not install random DLL or executable files from an error popup.

## Clean update

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd --self-test
```

## More documentation

- [Node.js guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/NODEJS.md)
- [Installation guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/INSTALL.md)
- [Troubleshooting](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.2-cli-only-final/cli/docs/TROUBLESHOOTING.md)

## Uninstall

```powershell
npm.cmd uninstall -g ytconv
```

Downloaded media and `~/.ytconv` data are preserved until removed manually.
