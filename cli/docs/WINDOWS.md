# YTConv 1.6.0 on Windows

## Requirements

- Windows 10 or 11 on x64 or ARM64.
- Node.js 22.14.0 or newer and npm 10 or newer.
- CMD, PowerShell, or Windows Terminal.
- A current Chrome, Edge, Firefox, Brave, or compatible browser for account-required media.

The npm CLI supports Windows ARM64. The automatic yt-dlp asset supports ARM64; when no matching fallback FFmpeg asset exists, install an ARM64 FFmpeg build through a trusted package manager and confirm it is on PATH.

## Install in CMD

```cmd
node.exe --version
npm.cmd --version
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd repair
ytconv.cmd --self-test
ytconv.cmd doctor
```

## Install in PowerShell

Use `npm.cmd` and `ytconv.cmd` to avoid PowerShell script-policy conflicts:

```powershell
node.exe --version
npm.cmd --version
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd repair
ytconv.cmd doctor
```

Expected output includes `1.6.0` and `Status: ready to use.`

## Run the repository installer

From a checked-out `cli` directory:

```cmd
scripts\install-windows.cmd --local
```

```powershell
.\scripts\install-windows.ps1 -Local
```

The local installer runs syntax and unit tests before global installation. The public installer path always uses `ytconv@latest`.

## Official Instagram login

```powershell
ytconv.cmd social logout instagram
ytconv.cmd login instagram
```

Complete sign-in and OTP/2FA in the browser window opened by YTConv. Return to the terminal only after Instagram visibly shows the signed-in account. YTConv then validates the original URL. If regular Chrome/Edge cookie encryption blocks access, the dedicated YTConv profile and loopback browser bridge are used.

Use another browser:

```powershell
ytconv.cmd login instagram --browser firefox
ytconv.cmd login instagram --browser edge --profile "Profile 2"
```

## Commands

```cmd
ytconv.cmd download "URL"
ytconv.cmd download "URL" --mode audio --audio-format mp3 --audio-quality 320
ytconv.cmd download "URL" --mode video --resolution 1080 --video-format mp4
ytconv.cmd batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

## PATH problems

```cmd
where node
where npm
where ytconv
npm.cmd config get prefix
```

Close and reopen the terminal after installing Node.js or YTConv. If multiple YTConv commands appear, remove obsolete global prefixes and reinstall once.

PowerShell inspection:

```powershell
Get-Command node -All
Get-Command npm -All
Get-Command ytconv -All
npm.cmd config get prefix
```

## PowerShell execution policy

An error about `npm.ps1` or `ytconv.ps1` does not require weakening system policy. Use `npm.cmd` and `ytconv.cmd`. Do not globally set an unrestricted execution policy solely for YTConv.

## Repair FFmpeg and engines

```powershell
$env:NO_COLOR = "1"
ytconv.cmd repair
ytconv.cmd doctor
```

Verified engines are stored in:

```text
%USERPROFILE%\.ytconv\engines
```

Do not download a random DLL or executable suggested by an error popup. Use `repair`, an official package manager, or a documented upstream release.

## Clean update

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd --self-test
```

## Uninstall

```powershell
npm.cmd uninstall -g ytconv
```

Downloaded media and `~/.ytconv` data are intentionally preserved. Review and delete those separately only if no longer needed.
