#!/bin/sh
set -eu

RAW_BASE="https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/codex/add-ytconv-cli/cli"
APP_DIR="/usr/local/lib/ytconv-ish"
APP_FILE="$APP_DIR/ytconv.py"
BIN_FILE="/usr/local/bin/ytconv"

say() {
  printf '%s\n' "$*"
}

fail() {
  printf 'YTConv iSH: %s\n' "$*" >&2
  exit 1
}

[ "$(id -u)" = "0" ] || fail "jalankan installer sebagai root di iSH."
[ -f /etc/alpine-release ] || fail "installer ini khusus iSH/Alpine Linux."

say "YTConv iSH installer"
say "Menyiapkan Python, FFmpeg, yt-dlp, dan gallery-dl..."

# Bersihkan instalasi npm yang gagal/tertinggal. iSH memakai frontend Python native,
# bukan Ink/Node, karena Node bawaan iSH lama sering gagal mengekstrak dependency npm.
rm -rf /usr/local/lib/node_modules/ytconv 2>/dev/null || true
rm -rf /usr/local/lib/node_modules/.ytconv-* 2>/dev/null || true
rm -f /usr/local/bin/ytconv 2>/dev/null || true

apk update
apk add --no-cache python3 py3-pip ffmpeg curl ca-certificates
update-ca-certificates >/dev/null 2>&1 || true

pip_install() {
  if python3 -m pip install --upgrade --no-cache-dir --break-system-packages "$@"; then
    return 0
  fi
  python3 -m pip install --upgrade --no-cache-dir "$@"
}

# pip memilih rilis yt-dlp terbaru yang masih kompatibel dengan versi Python
# iSH. Python 3.10+ mendapat yt-dlp terbaru; Python 3.9 mendapat rilis kompatibel
# terakhir dan akan diberi catatan oleh diagnostics.
pip_install yt-dlp gallery-dl

mkdir -p "$APP_DIR" "$HOME/Downloads/YTConv" /usr/local/bin
curl -fL --retry 3 --connect-timeout 20 \
  "$RAW_BASE/ish/ytconv.py" \
  -o "$APP_FILE"
chmod 755 "$APP_FILE"

cat > "$BIN_FILE" <<'EOF'
#!/bin/sh
exec python3 /usr/local/lib/ytconv-ish/ytconv.py "$@"
EOF
chmod 755 "$BIN_FILE"

hash -r 2>/dev/null || true

say ""
say "YTConv iSH berhasil dipasang."
"$BIN_FILE" --version
say ""
say "Jalankan:"
say "  ytconv"
say "  ytconv --diagnose"
say ""
say "Hasil tersimpan di: $HOME/Downloads/YTConv"
say "Buka melalui app Files > iSH > root > Downloads > YTConv."
