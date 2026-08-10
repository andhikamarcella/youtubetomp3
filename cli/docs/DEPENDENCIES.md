# Media engines and runtimes

YTConv 1.7.2 coordinates four local components:

| Component | Purpose | Update path |
|---|---|---|
| Node.js 22.14+ | CLI and safe process orchestration | current Node.js LTS or OS package |
| yt-dlp | video/audio extraction | ytconv repair or yt-dlp[default] |
| gallery-dl | images, carousels, and supported social posts | ytconv repair or Python package |
| FFmpeg/ffprobe | merge, codec conversion, audio, thumbnails, and upscaling | operating-system package preferred |

Deno 2.3+ is the preferred optional JavaScript runtime for current yt-dlp extraction challenges; Node.js is the built-in fallback. See [DENO.md](DENO.md).

YTConv repair downloads official yt-dlp and gallery-dl release assets through allowlisted HTTPS endpoints and verifies the GitHub-provided SHA-256 digest before replacement. System FFmpeg is preferred. FFmpeg itself publishes source code, while linked prebuilt executables are third-party builds; YTConv's verified fallback may therefore trail the newest FFmpeg source release.

Inspect the exact versions and paths on your device:

    ytconv --diagnose
    ytconv doctor
    yt-dlp --version
    gallery-dl --version
    ffmpeg -version
    deno --version
