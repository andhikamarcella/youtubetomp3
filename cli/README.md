# YTConv CLI 1.6.3

YTConv is a responsive CLI-only media downloader and converter for Windows, macOS, desktop Linux, Android Termux, SSH environments, and iPhone/iPad through iSH. It uses yt-dlp for video and audio, gallery-dl for galleries and mixed posts, and FFmpeg for merging and conversion.

YTConv 1.6.3 fixes invalid yt-dlp retry-sleep arguments that could stop a YouTube conversion before downloading started.

## Retry hotfix

YTConv 1.6.2 could accidentally build a nested fragment retry value such as:

```text
fragment:http:linear=1::2
```

YTConv 1.6.3 normalizes default, command-line, saved-profile, and legacy retry values before creating yt-dlp arguments. The effective retry values are now:

```text
http:linear=1::2
fragment:linear=1::2
file_access:linear=1::2
```

## YouTube output policy

When **mode is AUTO**:

- `music.youtube.com` becomes audio and defaults to **MP3**.
- `youtube.com`, `youtu.be`, and `youtube-nocookie.com` become video and default to **MP4**.
- Other platforms keep their platform-aware routing.

A user selection always overrides AUTO:

```sh
# Force MP3 even when the URL is regular YouTube
ytconv download "YOUTUBE_URL" --mode audio --audio-format mp3

# Force video even when the URL is YouTube Music
ytconv download "YOUTUBE_MUSIC_URL" --mode video --video-format mp4

# Select a different video container
ytconv download "YOUTUBE_URL" --mode video --video-format mkv
ytconv download "YOUTUBE_URL" --mode video --video-format webm
```

For MP4, YTConv first prefers compatible AVC/H.264 video plus M4A audio. When YouTube exposes only another codec combination, YTConv downloads the available streams and uses FFmpeg to produce a real MP4 instead of attempting an incompatible remux.

## No more false success

YTConv verifies paths reported by yt-dlp against the filesystem. Exit code zero is not considered a successful conversion unless a real output file exists.

The download archive remains useful for playlists and repeated jobs. When a URL is recorded in the archive but its output file was deleted, YTConv retries that item once without the archive and restores the missing file. If the retry still produces nothing, the command fails clearly instead of reporting a fake result.

## Requirements

The npm CLI requires:

```text
Node.js 22.14.0 or newer
npm 10 or newer
```

Install Node.js first on Windows, macOS, Linux, WSL, SSH, Chromebook Linux, or Termux. iSH is the supported exception and uses the Python frontend.

## Install or update

Windows CMD or PowerShell:

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

Linux, macOS, WSL, SSH, and Termux:

```sh
node --version
npm --version
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
ytconv repair
ytconv --self-test
ytconv doctor
```

Expected version:

```text
1.6.3
```

## Beginner examples

AUTO YouTube video to MP4:

```sh
ytconv download "https://www.youtube.com/watch?v=VIDEO_ID"
```

AUTO YouTube Music to MP3:

```sh
ytconv download "https://music.youtube.com/watch?v=MUSIC_ID"
```

Choose quality and container:

```sh
ytconv download "YOUTUBE_URL" --mode video --resolution 1080 --video-format mp4
ytconv download "YOUTUBE_URL" --mode video --resolution 720 --video-format mkv
```

Choose audio format and quality:

```sh
ytconv download "URL" --mode audio --audio-format mp3 --audio-quality 320
ytconv download "URL" --mode audio --audio-format flac
```

Playlist and batch:

```sh
ytconv playlist "PLAYLIST_URL" --playlist-items 1-10
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

Inspect source formats before downloading:

```sh
ytconv formats "URL"
ytconv info "URL" --json
```

## Explicit output choices

| Request | Result |
|---|---|
| YouTube Music + AUTO | MP3 audio |
| Regular YouTube + AUTO | MP4 video |
| `--mode audio --audio-format FORMAT` | User-selected audio format |
| `--mode video --video-format mp4` | MP4, with conversion fallback when required |
| `--mode video --video-format mkv` | MKV |
| `--mode video --video-format webm` | WebM |
| `--resolution 1080` | Best available stream up to 1080p |
| `--resolution best` | Best available stream |

## When no file appears

Run:

```sh
ytconv repair
ytconv doctor
ytconv --shell-info
```

Then retry without stored configuration and archives:

```sh
ytconv download "URL" --no-config --no-archive --mode video --video-format mp4
```

On Windows, use `.cmd`:

```cmd
ytconv.cmd download "URL" --no-config --no-archive --mode video --video-format mp4
```

YTConv 1.6.3 prints an error when the engine exits without creating or resolving a real file. It does not treat an exit-zero/no-file engine response as a completed conversion.

## Output folders

Typical desktop output:

```text
~/Downloads/YTConv
```

Termux shared output:

```text
~/storage/downloads/YTConv
```

iSH output:

```text
~/Downloads/YTConv
```

## Documentation

- [Install Node.js first](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/NODEJS.md)
- [Complete installation](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/INSTALL.md)
- [Windows](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/WINDOWS.md)
- [Linux and macOS](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/LINUX.md)
- [Android Termux](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/TERMUX.md)
- [iPhone and iPad through iSH](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/ISH.md)
- [Commands and examples](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/COMMANDS.md)
- [Configuration and profiles](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/CONFIGURATION.md)
- [Dependencies](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/DEPENDENCIES.md)
- [Official browser login](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/AUTH.md)
- [Security model](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/SECURITY.md)
- [Shells and PATH](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/SHELLS.md)
- [Troubleshooting](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/TROUBLESHOOTING.md)
- [Publishing](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/PUBLISHING.md)
- [Release verification](https://github.com/andhikamarcella/youtubetomp3/blob/release/ytconv-1.6.3-cli-only-final/cli/docs/RELEASE.md)

## Security boundaries

- External yt-dlp configuration is ignored.
- Remote extractor components are disabled.
- Normal output is monochrome; actionable errors may be red.
- Browser passwords and OTP codes never enter YTConv.
- Temporary provider cookies are restricted to the selected provider and removed after use.
- Termux and iSH cannot read private browser databases from other Android/iOS applications.

Download only media that you are authorized to access and store.
