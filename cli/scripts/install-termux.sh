#!/data/data/com.termux/files/usr/bin/sh
set -eu
VERSION="1.5.0-beta.2"
CHANNEL="beta"
printf '%s\n' "YTConv $VERSION installer for Termux"

command -v pkg >/dev/null 2>&1 || { printf '%s\n' 'Run this installer inside the Termux app.' >&2; exit 1; }
pkg update
pkg install -y nodejs python ffmpeg curl ca-certificates

major=$(node -p 'process.versions.node.split(".")[0]')
[ "$major" -ge 18 ] || { printf '%s\n' 'The Termux Node.js package is too old. Run pkg upgrade.' >&2; exit 1; }

if [ ! -d "$HOME/storage/downloads" ]; then
  printf '%s\n' 'Requesting Android shared-storage permission...'
  termux-setup-storage || true
  printf '%s\n' 'Accept the Android permission dialog. Run the installer again if the storage directory does not appear.'
fi

python -m pip install -U --no-cache-dir yt-dlp gallery-dl \
  || python -m pip install -U --no-cache-dir --break-system-packages yt-dlp gallery-dl \
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
printf '%s\n' 'Beta installation completed. Default output: ~/storage/downloads/YTConv'
printf '%s\n' 'Return to stable: npm install -g ytconv@latest --omit=optional --force'
