# YTConv Android 1.6.5

Native Android application for public media downloads. It is not a WebView and does not require Node.js, Termux, or a cookies.txt file for ordinary public media.

## Routing

- `music.youtube.com` in AUTO mode → MP3
- regular `youtube.com` / `youtu.be` in AUTO mode → MP4
- MP4 or MP3 selected by the user always overrides AUTO

Downloads are written to Android's public `Download/YTConv` directory. Android 10 and newer use the scoped public Downloads location supported by the bundled engine.

## Build

The release workflow uses JDK 17, Android SDK 36, Android Gradle Plugin 8.13.2, Gradle 8.13, and youtubedl-android 0.18.1. The Gradle distribution is downloaded from the official Gradle service and checked against its SHA-256 digest before execution.

The workflow produces:

- `YTConv-1.6.5-debug.apk` — debug-signed, immediately installable for testing
- `YTConv-1.6.5-release-unsigned.apk` — unsigned release build for downstream signing

A public production store release requires a private Android signing key. No signing key is stored in this repository.

## License

The Android app module is GPL-3.0-only because it links to GPL-3.0 youtubedl-android. The standalone YTConv CLI/npm package remains ISC licensed. See `NOTICE.md`.
