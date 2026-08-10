# Android with Termux

Use a maintained Termux build and update it first:

    pkg update
    pkg upgrade -y
    pkg install -y nodejs python ffmpeg curl ca-certificates
    termux-setup-storage
    node --version
    npm --version
    npm install -g ytconv@1.7.2 --omit=optional
    ytconv repair
    ytconv doctor

Default shared output is ~/storage/downloads/YTConv. Keep the app in the foreground for long conversions.

Termux cannot read another Android app's private browser database. Use public media, a cookies file you control and protect, or a desktop browser-session workflow for account-required media. Prefer one job and 720p or audio on low-memory phones.

If FFmpeg is missing:

    pkg install -y ffmpeg
    hash -r
    command -v ffmpeg
    ffmpeg -version
