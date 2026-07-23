#!/data/data/com.termux/files/usr/bin/sh
set -eu
VERSION="1.5.0-beta.1"
CHANNEL="beta"
printf '%s\n' "YTConv $VERSION installer untuk Termux"

command -v pkg >/dev/null 2>&1 || { printf '%s\n' 'Jalankan installer ini di aplikasi Termux.' >&2; exit 1; }
pkg update
pkg install -y nodejs python ffmpeg

major=$(node -p 'process.versions.node.split(".")[0]')
[ "$major" -ge 18 ] || { printf '%s\n' 'Node.js Termux terlalu lama. Jalankan pkg upgrade.' >&2; exit 1; }

if [ ! -d "$HOME/storage/downloads" ]; then
  printf '%s\n' 'Meminta izin penyimpanan Android...'
  termux-setup-storage || true
  printf '%s\n' 'Setujui dialog Android, lalu jalankan installer lagi bila folder storage belum muncul.'
fi

python -m pip install -U --no-cache-dir yt-dlp gallery-dl \
  || python -m pip install -U --no-cache-dir --break-system-packages yt-dlp gallery-dl \
  || printf '%s\n' 'Pip gagal; command ytconv repair akan mencoba lagi.'

mkdir -p "$HOME/.ytconv/archives"
npm uninstall -g ytconv >/dev/null 2>&1 || true
npm cache verify
npm install -g "ytconv@$CHANNEL" --omit=optional --force
installed=$(ytconv --version)
[ "$installed" = "$VERSION" ] || { printf '%s\n' "Versi terpasang $installed, seharusnya $VERSION" >&2; exit 1; }
ytconv repair || true
ytconv --self-test
ytconv --shell-info || true
ytconv doctor || true
printf '%s\n' 'Default beta: subtitle ON, SponsorBlock mark ON, archive ON.'
printf '%s\n' 'Matikan: --no-subtitles --no-sponsorblock --no-archive'
printf '%s\n' 'Selesai. Hasil default: ~/storage/downloads/YTConv'
printf '%s\n' 'Batch: ytconv batch links.txt --continue-on-error'
