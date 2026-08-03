#!/data/data/com.termux/files/usr/bin/sh
set -eu
VERSION="1.6.0"
CHANNEL="latest"
printf '%s\n' "YTConv $VERSION installer for Termux"

command -v pkg >/dev/null 2>&1 || { printf '%s\n' 'Run this installer inside the Termux app.' >&2; exit 1; }
pkg update
pkg install -y nodejs python ffmpeg curl ca-certificates

node -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22||(major===22&&minor>=14)?0:1)' \
  || { printf '%s\n' 'Termux needs Node.js 22.14 or newer. Run: pkg update && pkg upgrade' >&2; exit 1; }

if [ ! -d "$HOME/storage/downloads" ]; then
  printf '%s\n' 'Requesting Android shared-storage permission...'
  termux-setup-storage || true
  printf '%s\n' 'Accept the Android permission dialog. Run the installer again if the storage directory does not appear.'
fi

python -m pip install -U --no-cache-dir 'yt-dlp[default]' gallery-dl \
  || python -m pip install -U --no-cache-dir --break-system-packages 'yt-dlp[default]' gallery-dl \
  || printf '%s\n' 'pip could not install the fallback engines; ytconv repair will try again.'

npm uninstall -g ytconv >/dev/null 2>&1 || true
npm cache verify
npm install -g "ytconv@$CHANNEL" --omit=optional --force
installed=$(ytconv --version)
[ "$installed" = "$VERSION" ] || { printf '%s\n' "Installed version is $installed; expected $VERSION" >&2; exit 1; }
ytconv repair || true
ytconv --self-test
ytconv --shell-info || true
ytconv doctor || true
ytconv quickstart || true
printf '%s\n' 'Stable installation completed. Default output: ~/storage/downloads/YTConv'
printf '%s\n' 'Public links are ready. Android browser sessions remain sandboxed from Termux.'
