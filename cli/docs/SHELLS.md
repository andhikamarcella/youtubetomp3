# YTConv 1.5.6 Shell Guide

## Windows CMD

```cmd
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd doctor
ytconv.cmd download "URL" --audio-format mp3 --audio-quality 192
ytconv.cmd playlist "URL" --archive downloaded.txt
ytconv.cmd batch links.txt --jobs 2 --result-json report.json
```

Find the active installation:

```cmd
where ytconv
where node
where npm
npm.cmd prefix -g
```

## Windows PowerShell

Prefer the `.cmd` shims:

```powershell
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd doctor
ytconv.cmd download "URL"
```

Find every matching command:

```powershell
Get-Command ytconv -All
Get-Command ytconv.cmd -All
Get-Command node -All
Get-Command npm.cmd -All
```

PowerShell line continuation uses a backtick:

```powershell
ytconv.cmd download "URL" `
  --artist "Artist" `
  --title "Title"
```

If `ytconv.ps1` is blocked, continue using `ytconv.cmd`, or deliberately allow signed/local scripts for the current user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Bash and Zsh

```bash
npm config set prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force

ytconv --version
ytconv doctor
ytconv download "URL" --preset music
ytconv playlist "URL" --playlist-items "1-10" --archive downloaded.txt
```

Persist PATH in `~/.profile`, `~/.bashrc`, or `~/.zshrc`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Fish

```fish
npm config set prefix $HOME/.local
fish_add_path $HOME/.local/bin
npm install -g ytconv@latest --force
ytconv --version
```

## SSH and non-TTY terminals

YTConv automatically selects headless mode when stdin or stdout is not a TTY. It can also be forced:

```bash
ytconv --headless "URL"
ytconv --headless --preset music "URL"
```

Batch:

```bash
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

Pipe:

```bash
printf '%s\n' "URL1" "URL2" | ytconv --stdin --jobs 2 --continue-on-error
```

Cron should use absolute paths:

```cron
0 2 * * * /home/user/.local/bin/ytconv --headless --output /home/user/Downloads/YTConv "URL" >>/home/user/ytconv.log 2>&1
```

## Android Termux

```bash
ytconv --version
ytconv doctor
ytconv repair
ytconv download "URL" --preset mobile
ytconv batch links.txt --continue-on-error
```

Shared output directory:

```text
~/storage/downloads/YTConv
```

Termux cannot directly read the private Chrome Android cookie database. Use a legally exported Netscape cookie file:

```bash
ytconv download "URL" --cookies ~/storage/downloads/cookies.txt
```

## iPhone/iPad iSH

```sh
ytconv --version
ytconv doctor
ytconv repair
ytconv download "URL" --preset music
ytconv playlist "URL" --archive downloaded.txt
ytconv batch links.txt --continue-on-error --result-json report.json
```

Default output:

```text
~/Downloads/YTConv
```

The iSH frontend processes batch items sequentially to reduce memory pressure.

## Cross-platform batch files

Use UTF-8, one URL per line:

```text
# comments are ignored
https://example.com/1
https://example.com/2
```

CMD:

```cmd
ytconv.cmd batch links.txt --jobs 2
```

PowerShell:

```powershell
ytconv.cmd batch .\links.txt --jobs 2
```

Linux/macOS/Termux/iSH:

```bash
ytconv batch ./links.txt --jobs 2
```

## JSON output

CMD:

```cmd
ytconv.cmd info "URL" --json > info.json
```

PowerShell:

```powershell
ytconv.cmd info "URL" --json | Set-Content -Encoding utf8 info.json
```

Linux/macOS:

```bash
ytconv info "URL" --json > info.json
```

## Safe cancellation

Press `Ctrl+C`. YTConv forwards cancellation to the media engine and returns exit code 130 when detected. Partial `.part` files can normally resume on the next run.
