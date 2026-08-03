# Troubleshooting YTConv 1.6.1

Start with this safe sequence:

```sh
ytconv clean
ytconv repair
ytconv --self-test
ytconv doctor
ytconv --shell-info
```

Do not share cookies, tokens, private URLs, proxy credentials, or browser profile data.

## A documentation link returns `404 - page not found`

The 1.6.0 npm README used relative documentation links. npm or GitHub could resolve those links against a commit that contained `cli/README.md` but did not contain the requested file, such as `cli/docs/ISH.md`.

YTConv 1.6.1 fixes this by using absolute links to the reviewed final release branch and by testing every target before publication.

Use the versioned documentation index:

```text
https://github.com/andhikamarcella/youtubetomp3/tree/release/ytconv-1.6.1-cli-only-final/cli/docs
```

Important guides:

- [Node.js for beginners](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/NODEJS.md)
- [Installation](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/INSTALL.md)
- [Windows](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/WINDOWS.md)
- [Linux and macOS](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/LINUX.md)
- [Termux](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/TERMUX.md)
- [iSH](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/ISH.md)

Remove an old npm-cached README by updating:

```sh
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
```

Expected version: `1.6.1`.

## Node.js or npm is not installed

Install Node.js before YTConv on Windows, macOS, Linux, WSL, SSH servers, and Termux. Follow the [beginner Node.js guide](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.1-cli-only-final/cli/docs/NODEJS.md).

Verify:

```sh
node --version
npm --version
```

Required:

```text
Node.js 22.14.0 or newer
npm 10 or newer
```

iSH uses the supported Python frontend and does not require Node.js.

## The screen stops at `setup incomplete`

```sh
ytconv repair
ytconv doctor
ytconv --self-test
```

Windows:

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd repair
ytconv.cmd doctor
```

Do not use `--ignore-scripts` for a normal desktop installation because it skips the post-install dependency bootstrap.

## PowerShell says scripts are disabled

Use the CMD shims:

```powershell
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd doctor
```

Changing the system execution policy is not required.

## `ytconv: command not found`

Windows:

```cmd
where node
where npm
where ytconv
npm.cmd prefix -g
```

Linux and macOS:

```sh
command -v node
command -v npm
command -v ytconv
npm prefix -g
export PATH="$HOME/.local/bin:$PATH"
```

Persist the PATH in the correct shell profile and reopen the terminal.

## npm reports `EACCES` or permission denied

Do not use `sudo npm install -g`. Configure a user prefix:

```sh
mkdir -p "$HOME/.local/bin"
npm config set prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force
```

## Node.js is too old

```sh
node --version
```

Install a current supported LTS release, reopen the terminal, verify again, and reinstall YTConv.

## Instagram, Facebook, or X asks for login

On a supported desktop system:

```sh
ytconv login instagram
ytconv login facebook --browser edge
ytconv login x --browser firefox
ytconv social status
```

Complete password and OTP/2FA entry only in the provider's official browser page. YTConv saves the provider-to-browser reference only after the exact failed URL succeeds.

Android Termux and iSH cannot read private browser databases because of operating-system sandboxing.

## Browser cookies cannot be read

```sh
ytconv login instagram --browser chrome
ytconv download "URL"
```

YTConv may use a dedicated browser profile and a loopback-only bridge. Provider-scoped temporary cookies are deleted after the attempt. Use Firefox when a Chromium profile cannot be accessed.

## FFmpeg or ffprobe is missing

```sh
ytconv --shell-info
ytconv repair
ytconv doctor
```

FFmpeg is required for merging, conversion, cover art, clipping, and some subtitle operations. ffprobe is recommended for diagnostics.

## Alpine reports that FFmpeg cannot execute

Alpine uses musl. Install system FFmpeg:

```sh
apk add --no-cache ffmpeg
npm install -g ytconv@latest --omit=optional --force
```

## The URL works in a browser but fails in YTConv

Possible causes include:

- authentication is required;
- browser cookies expired or are encrypted;
- media is private, deleted, or region-restricted;
- the extractor needs an update;
- DRM or a paywall is present;
- the provider is rate limiting the connection.

Try:

```sh
ytconv info "URL"
ytconv repair
ytconv download "URL"
```

## HTTP 429 or too many requests

Reduce concurrency and wait before retrying:

```sh
ytconv download "URL" --concurrent-fragments 1 --retry-sleep "linear=2:20:3"
ytconv batch links.txt --jobs 1 --continue-on-error
```

## Timeout, DNS, certificate, or proxy errors

```sh
ytconv doctor
ytconv --shell-info
```

Verify the system clock, CA certificates, DNS configuration, and proxy settings.

## Requested format is not available

```sh
ytconv formats "URL"
ytconv formats "URL" --json
ytconv download "URL" --video-format auto --resolution 720
```

## Subtitles are missing

```sh
ytconv subtitles "URL"
ytconv download "URL" --subtitle-only --subtitle-langs "en,id"
```

Not every source contains the requested subtitle track.

## SponsorBlock does not mark or remove anything

```sh
ytconv download "URL" --sponsorblock mark
```

Community segment data may not exist for the media.

## Batch processing stops early

```sh
ytconv batch links.txt --continue-on-error --jobs 2 --result-json report.json
```

The final exit code remains nonzero when at least one item fails.

## A `.part` file remains

Resume is enabled by default:

```sh
ytconv download "URL" --resume
```

Remove newly created partial files after failure:

```sh
ytconv download "URL" --cleanup-part
```

## iSH is slow or runs out of memory

```sh
ytconv download "URL" --preset mobile
ytconv batch links.txt --jobs 1 --continue-on-error
```

Keep iSH in the foreground, lower media quality, and avoid large playlists.

## Exit codes

```text
0    Success
1    Processing failed
2    Invalid URL or option
3    Missing dependency
4    Authentication required
5    Temporary failure
130  Cancelled
```

## Logs

```sh
ytconv download "URL" --log-file ytconv.log
```

Remove sensitive URLs, usernames, local paths, proxy details, and account information before sharing logs. Never include cookie contents.
