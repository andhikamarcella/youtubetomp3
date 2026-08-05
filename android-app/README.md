# YTConv Android 1.7.0

Native Android application for social-media downloads and local conversion. It does not require Node.js, Termux, or a cookies file for ordinary public media.

## Features

- AUTO, MP4, MP3, and image/gallery modes
- yt-dlp provider support for YouTube, Instagram, Facebook, TikTok, X/Twitter, Reddit, Pinterest, Threads, Twitch, SoundCloud, Vimeo, Bilibili, and other compatible providers
- visible download and conversion progress
- safe Stop/cancel control
- verified non-empty output files
- public access first
- local browser-login recovery when a provider requires authentication
- temporary Netscape cookie export stored in the application cache
- temporary cookie deletion when the activity closes
- subtitles disabled by default through `--no-write-subs`
- 2026 release metadata

## AUTO routing

- `music.youtube.com` in AUTO mode → MP3
- other supported media URLs in AUTO mode → MP4 when a video stream is available
- MP4, MP3, or Images selected by the user always overrides AUTO

## Browser login

Tap **Browser login** after entering the media URL. YTConv opens the provider's official login page in a local Android WebView. Complete the password, OTP, or 2FA flow there, then tap **Use session**.

Credentials are not passed to yt-dlp or stored as command-line arguments. The application exports only the resulting cookies to its private cache and removes that file when the activity closes.

The login helper includes provider routes for Instagram, Facebook, TikTok, X/Twitter, Reddit, Pinterest, Threads, LinkedIn, and Bilibili. Other supported providers open the media URL directly so their normal sign-in page remains available.

## Output

Downloads are written to Android's `Download/YTConv` directory. The application verifies that a non-empty media file was created after the engine exits.

## Build

The release workflow uses JDK 17, Android SDK 36, Android Gradle Plugin 8.13.2, Gradle 8.13, and youtubedl-android 0.18.1. The Gradle distribution is downloaded from the official Gradle service and checked against its SHA-256 digest before execution.

The workflow produces:

- `YTConv-1.7.0-debug.apk` — debug-signed and installable for testing
- `YTConv-1.7.0-release-unsigned.apk` — unsigned release build for downstream signing
- `YTConv-Android-1.7.0-source.tar.gz` — corresponding source archive

A public production store release requires a private Android signing key. No signing key is stored in this repository.

## License

The Android application module is GPL-3.0-only because it links to GPL-3.0 youtubedl-android. The standalone YTConv CLI/npm package remains ISC licensed. See `NOTICE.md`.
