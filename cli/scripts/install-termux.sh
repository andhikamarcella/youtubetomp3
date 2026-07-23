#!/data/data/com.termux/files/usr/bin/sh
set -eu
VERSION="1.3.0"
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
  || printf '%s\n' 'Pip gagal; command ytconv --repair akan mencoba lagi.'

npm uninstall -g ytconv >/dev/null 2>&1 || true
npm cache verify
npm install -g "ytconv@$VERSION" --omit=optional --force
ytconv --version
ytconv --repair || true
ytconv --self-test || true
ytconv --shell-info || true
printf '%s\n' 'Selesai. Hasil default: ~/storage/downloads/YTConv'
printf '%s\n' 'Batch: ytconv batch links.txt --continue-on-error'
