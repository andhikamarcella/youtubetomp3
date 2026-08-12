# Troubleshooting YTConv 1.7.5

Start with this safe sequence:

```sh
ytconv clean
ytconv repair
ytconv --self-test
ytconv doctor
ytconv --shell-info
```

On Windows, use `ytconv.cmd` for every command when PowerShell blocks a generated `.ps1` shim.

Do not share cookies, tokens, private URLs, proxy credentials, or browser profile data.

## YouTube finishes but no file appears

YTConv 1.7.5 no longer accepts exit code zero as proof of success. It verifies the output path against the filesystem. If yt-dlp exits without creating or resolving a real file, YTConv returns an error.

First update and repair:

```sh
npm install -g ytconv@latest --force
ytconv repair
ytconv doctor
```

Then retry without saved configuration or archive state:

```sh
ytconv download "YOUTUBE_URL" --no-config --no-archive --mode video --video-format mp4
```

Windows:

```cmd
npm.cmd install -g ytconv@latest --force
ytconv.cmd repair
ytconv.cmd doctor
ytconv.cmd download "YOUTUBE_URL" --no-config --no-archive --mode video --video-format mp4
```

Expected behavior:

- the command reports a real saved path;
- the path exists;
- the file extension is `.mp4` when MP4 was selected;
- a zero-file result is reported as an error, not success.

## The URL was already recorded in the archive

YTConv enables per-profile archives to avoid accidental duplicate playlist downloads. If the archive contains the URL but the previous output file was deleted, YTConv 1.7.5 automatically retries that item once without the archive.

The terminal prints:

```text
The URL was recorded in the archive, but no output file exists. Restoring it once without the archive...
```

To bypass archive behavior manually:

```sh
ytconv download "URL" --no-archive
```

Do not delete archive files during a running parallel batch. Use `--no-archive` for a one-time recovery instead.

## YouTube Music downloads video instead of MP3

Use version 1.7.5 or newer and keep mode on AUTO:

```sh
ytconv download "https://music.youtube.com/watch?v=MUSIC_ID"
```

AUTO policy for YouTube Music is MP3 audio. Confirm the URL hostname is actually `music.youtube.com` and not a copied regular `youtube.com` URL.

Force MP3 explicitly:

```sh
ytconv download "URL" --mode audio --audio-format mp3
```

## Regular YouTube downloads audio instead of video

Regular `youtube.com`, `youtu.be`, and `youtube-nocookie.com` URLs use video in AUTO mode:

```sh
ytconv download "https://www.youtube.com/watch?v=VIDEO_ID"
```

Force video and MP4 explicitly:

```sh
ytconv download "URL" --mode video --video-format mp4
```

Check saved configuration when an old audio profile keeps taking priority:

```sh
ytconv config show
ytconv profile list
ytconv download "URL" --no-config --mode video --video-format mp4
```

## MP4 merge or codec error

YTConv 1.7.5 first requests AVC/H.264 video and M4A audio because those streams are directly compatible with MP4. When YouTube does not offer that combination, YTConv uses a broader stream fallback and FFmpeg recoding.

Repair FFmpeg:

```sh
ytconv repair
ytconv doctor
ffmpeg -version
```

Inspect the source formats:

```sh
ytconv formats "URL"
```

Try a lower resolution:

```sh
ytconv download "URL" --mode video --video-format mp4 --resolution 720
```

Use MKV when conversion speed matters more than MP4 compatibility:

```sh
ytconv download "URL" --mode video --video-format mkv
```

## Requested format is not available

List real formats:

```sh
ytconv formats "URL"
```

Then use AUTO resolution or a lower cap:

```sh
ytconv download "URL" --resolution best --video-format mp4
ytconv download "URL" --resolution 720 --video-format mp4
```

Do not copy a fixed yt-dlp format ID from another video. Format IDs differ between videos and can change over time.

## The selected container is ignored

Explicit selections override URL-based AUTO routing:

```sh
ytconv download "URL" --mode video --video-format mp4
ytconv download "URL" --mode video --video-format mkv
ytconv download "URL" --mode video --video-format webm
```

Check that a saved preset is not being applied before the explicit command. Explicit command-line options should remain last and authoritative. Run once with `--no-config` to confirm.

## FFmpeg is missing

```sh
ytconv repair
ytconv doctor
ytconv --shell-info
```

FFmpeg is required for:

- combining separate video and audio streams;
- converting incompatible codecs into MP4;
- audio extraction;
- cover art and metadata operations;
- clipping and subtitle conversion.

### FFmpeg exits during a short clip or remote stream

An FFmpeg exit code is not proof that YouTube needs an account. Do not add cookies only because FFmpeg failed. First run:

```sh
ytconv repair
ytconv doctor
ytconv download "URL" --mode video --resolution 240 --concurrent-fragments 1
```

If a command using `--start` or `--end` fails while a normal full download works, the network or proxy may be blocking FFmpeg's direct request for the selected stream. Retry without clipping, disable the proxy/VPN, or test from another network. YTConv 1.7.5 only recommends browser login when the provider returns an authentication-related response.

## `ytconv: command not found`

Linux/macOS:

```sh
npm prefix -g
command -v ytconv
export PATH="$HOME/.local/bin:$PATH"
```

Windows:

```cmd
where node
where npm
where ytconv
npm.cmd prefix -g
```

Close and reopen the terminal after installing Node.js or YTConv.

## npm reports permission denied

Do not use `sudo npm install -g`. Configure a user prefix:

```sh
npm config set prefix "$HOME/.local"
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@latest --force
```

## PowerShell says scripts are disabled

Use the `.cmd` shims without changing the system execution policy:

```powershell
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd doctor
```

## Login or cookies are required

Use the official browser flow:

```sh
ytconv login instagram
ytconv social status
```

Complete passwords and OTP/2FA only in the provider's official browser page. YTConv does not receive those values.

Termux and iSH cannot read private browser databases belonging to other Android or iOS applications. Use public URLs there or process account-required media on a supported desktop browser.

## HTTP 429 or rate limiting

Reduce concurrency and wait before retrying:

```sh
ytconv download "URL" --concurrent-fragments 1 --retry-sleep "linear=2:20:3"
ytconv batch links.txt --jobs 1 --continue-on-error
```

Repeated aggressive retries can extend a temporary restriction.

## Certificate, DNS, timeout, or proxy errors

Check the device clock, CA certificates, DNS, and proxy configuration:

```sh
ytconv doctor
ytconv --shell-info
```

Supported proxy forms include:

```text
http://host:port
socks5://host:port
```

## iSH is slow or is killed

Use one item at a time and a smaller resolution:

```sh
ytconv download "URL" --mode video --video-format mp4 --resolution 720
ytconv batch links.txt --jobs 1 --continue-on-error
```

Keep iSH in the foreground and ensure enough free space for both source streams and final conversion output.

## Exit codes

```text
0    Success with verified output or successful utility command
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

Before sharing a log, remove private URLs, usernames, local sensitive paths, proxy details, and account information. Never include cookie contents.
