#!/data/data/com.termux/files/usr/bin/sh
set -eu
printf '%s\n' 'YTConv 1.2.3 installer untuk Termux'
pkg update
pkg install -y nodejs python ffmpeg
if [ ! -d "$HOME/storage/downloads" ]; then
  printf '%s\n' 'Meminta izin penyimpanan Android...'
  termux-setup-storage || true
fi
python -m pip install -U --no-cache-dir yt-dlp gallery-dl || true
npm uninstall -g ytconv >/dev/null 2>&1 || true
npm install -g ytconv@1.2.3 --omit=optional --force
ytconv --version
ytconv --repair
ytconv --self-test
printf '%s\n' 'Selesai. Hasil default: ~/storage/downloads/YTConv'
