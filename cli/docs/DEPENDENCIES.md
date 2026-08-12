# Media engines and runtimes

YTConv 1.7.3 coordinates four local components:

| Component | Purpose | Update path |
|---|---|---|
| Node.js 22.14+ | CLI and safe process orchestration | current Node.js LTS or OS package |
| yt-dlp | video/audio extraction | ytconv repair or yt-dlp[default] |
| gallery-dl | images, carousels, and supported social posts | ytconv repair or Python package |
| FFmpeg/ffprobe | merge, codec conversion, audio, thumbnails, and upscaling | operating-system package preferred |

Deno 2.3+ is the preferred optional JavaScript runtime for current yt-dlp extraction challenges; Node.js is the built-in fallback. See [DENO.md](DENO.md).

YTConv repair downloads official yt-dlp and gallery-dl release assets through allowlisted HTTPS endpoints and verifies the GitHub-provided SHA-256 digest before replacement. System FFmpeg is preferred. If FFmpeg is missing on supported Linux x64/ARM64 or Windows x86/x64/ARM64 devices, 1.7.3 downloads the current `yt-dlp/FFmpeg-Builds` GPL archive, verifies its GitHub SHA-256 digest, validates safe archive paths, and installs both FFmpeg and ffprobe. macOS, Termux, iSH, and unsupported architectures keep using the matching OS package instead of an incompatible desktop binary.

Deno is a JavaScript runtime, not Java and not an authentication bypass. It helps yt-dlp execute supported YouTube player challenges. It cannot replace a login, cookies, PO Token, account permission, or regional availability.

Inspect the exact versions and paths on your device:

    ytconv --diagnose
    ytconv doctor
    yt-dlp --version
    gallery-dl --version
    ffmpeg -version
    deno --version
