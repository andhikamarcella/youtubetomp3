# YTConv Android licensing notice

The standalone YTConv Node.js/Python CLI remains licensed under the ISC License.

The Android application in this directory is distributed under **GPL-3.0-only** because it links to `youtubedl-android` and its FFmpeg integration. Its source is provided in this repository next to every APK build.

Bundled Android engine dependencies:

- `io.github.junkfood02.youtubedl-android:library:0.18.1` — GPL-3.0
- `io.github.junkfood02.youtubedl-android:ffmpeg:0.18.1` — see the upstream component notices and FFmpeg licenses bundled by the dependency
- yt-dlp and Python components bundled by youtubedl-android — see their upstream license notices

Upstream source and GPL-3.0 text:

- https://github.com/yausername/youtubedl-android
- https://github.com/yausername/youtubedl-android/blob/master/LICENSE

The APK does not contain YTConv npm credentials, GitHub credentials, browser cookies, telemetry, advertisements, or a remote configuration channel.
