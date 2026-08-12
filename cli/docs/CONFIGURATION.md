# YTConv Configuration, Profiles, History, and Completion

This document applies to YTConv `1.7.5`.

## Storage locations

YTConv stores user data under:

```text
~/.ytconv/
```

Files and directories:

```text
config.json            Persistent defaults and named profiles
history.jsonl          Privacy-limited headless/batch history
archives/              yt-dlp text archives and gallery-dl SQLite archives
update-check-*.json    Update caches; legacy names are removed by cache cleanup
social-sessions.json   Provider + browser/profile references (never raw cookies)
```

On Windows, `~` resolves to the current account home directory, normally `%USERPROFILE%`.

## Security model

The config command accepts only a documented allowlist of non-secret settings. It does not store:

- cookie contents
- raw browser sessions or cookie values
- authentication tokens
- npm credentials
- proxy passwords
- `.env` files

History records only the execution time, YTConv version, command, URLs, mode, preset, profile, output directory, and exit code. History is capped at 500 entries.

Config writes use a temporary file, user-only permissions when supported, and an atomic rename.

## Automatic updates

Stable updates are checked from npm and installed automatically only in an interactive terminal. CI, pipes, cron, SSH/headless automation, and JSON output are not changed automatically. Disable the check for one run with:

```sh
ytconv --no-update-check
```

Disable automatic updates through the environment while retaining manual `ytconv update`:

```sh
YTCONV_AUTO_UPDATE=0 ytconv
```

## List configuration

```bash
ytconv config list
```

Machine-readable location:

```bash
ytconv config path
```

## Save defaults

```bash
ytconv config set output "$HOME/Downloads/YTConv"
ytconv config set preset balanced
ytconv config set audioFormat mp3
ytconv config set audioQuality 192
ytconv config set videoFormat mp4
ytconv config set resolution 1080
ytconv config set subtitles true
ytconv config set subtitleLanguages "en,id"
ytconv config set sponsorBlock mark
ytconv config set archive false
ytconv config set concurrentFragments 4
ytconv config set rateLimit 2M
ytconv config set restrictFilenames true
ytconv config set normalizeAudio false
ytconv config set retries 20
ytconv config set fragmentRetries 30
```

Supported keys:

```text
preset
output
audioFormat
audioQuality
videoFormat
resolution
subtitleLanguages
subtitles
sponsorBlock
archive
concurrentFragments
rateLimit
restrictFilenames
normalizeAudio
retries
fragmentRetries
```

## Read or remove one default

```bash
ytconv config get output
ytconv config unset audioQuality
```

## Reset configuration and profiles

```bash
ytconv config reset
```

This resets persistent defaults and named profiles. It preserves download history, downloaded files, and download archives.

## Ignore configuration for one run

```bash
ytconv --no-config download "URL"
```

## Create named profiles

```bash
ytconv profile set music preset=music audioQuality=320
ytconv profile set phone preset=mobile resolution=720
ytconv profile set archive preset=archive restrictFilenames=true
```

Profile names use lowercase letters, numbers, dots, underscores, and hyphens and are limited to 40 characters.

## List and inspect profiles

```bash
ytconv profile list
ytconv profile show music
```

The active profile is marked with `*`.

## Activate a profile

```bash
ytconv profile use phone
ytconv download "URL"
```

Clear the active profile:

```bash
ytconv profile clear
```

Delete a profile:

```bash
ytconv profile delete phone
```

## Use a profile once

```bash
ytconv --profile music download "URL"
```

This does not change the active profile.

## Precedence rules

From lowest to highest priority:

1. built-in stable defaults
2. persistent global defaults
3. active or one-run profile
4. explicit command-line options

Examples:

```bash
# The profile requests 720p, but the explicit option wins.
ytconv --profile phone download "URL" --resolution 1080

# The saved subtitle default is ignored for this run.
ytconv download "URL" --no-subtitles

# All saved settings are ignored.
ytconv --no-config download "URL" --preset hd
```

An explicit preset removes conflicting saved media-format settings while preserving unrelated settings such as the saved output directory.

## History

Show recent entries:

```bash
ytconv history
```

JSON:

```bash
ytconv history --json
```

Limit rows:

```bash
ytconv history --limit 50
```

Clear history:

```bash
ytconv history clear
```

Interactive TUI-only sessions may not produce the same history detail as headless and batch executions.

## Shell completion

Bash:

```bash
ytconv completion bash >> ~/.bashrc
source ~/.bashrc
```

Zsh:

```zsh
ytconv completion zsh >> ~/.zshrc
source ~/.zshrc
```

Fish:

```fish
mkdir -p ~/.config/fish/completions
ytconv completion fish > ~/.config/fish/completions/ytconv.fish
```

PowerShell:

```powershell
ytconv.cmd completion powershell | Add-Content $PROFILE
. $PROFILE
```

Review generated completion text before adding it to a shell profile.

## Backup

```bash
cp -a "$HOME/.ytconv" "$HOME/ytconv-backup"
```

Windows PowerShell:

```powershell
Copy-Item "$HOME\.ytconv" "$HOME\ytconv-backup" -Recurse
```

Never publish a backup without reviewing it. Although config/history exclude known secrets, paths and URLs may still be private.

## Remove all local YTConv data

First uninstall YTConv:

```bash
npm uninstall -g ytconv
```

Then, only when the configuration, history, and archives are no longer needed:

```bash
rm -rf "$HOME/.ytconv"
```

Windows PowerShell:

```powershell
Remove-Item "$HOME\.ytconv" -Recurse -Force
```

These commands are intentionally separate from normal uninstall and cache cleanup to prevent accidental data loss.
