#!/bin/sh
set -eu

RAW_BASE="https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/codex/add-ytconv-cli/cli"
APP_DIR="/usr/local/lib/ytconv-ish"
APP_FILE="$APP_DIR/ytconv.py"
BIN_FILE="/usr/local/bin/ytconv"
TMP_FILE="/tmp/ytconv-ish.py.$$"

say() { printf '%s\n' "$*"; }
fail() { printf 'YTConv iSH: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || fail "jalankan sebagai root di iSH."
[ -f /etc/alpine-release ] || fail "installer ini khusus iSH/Alpine Linux."

say "YTConv iSH 1.2.3 installer"
say "Menyiapkan Python, FFmpeg, yt-dlp, gallery-dl, curl, dan sertifikat..."

apk update
apk add --no-cache python3 py3-pip ffmpeg curl ca-certificates
update-ca-certificates >/dev/null 2>&1 || true

pip_install() {
  python3 -m pip install -U --no-cache-dir --break-system-packages "$@" 2>/dev/null \
    || python3 -m pip install -U --no-cache-dir "$@"
}

pip_install yt-dlp gallery-dl
mkdir -p "$APP_DIR" "$HOME/Downloads/YTConv" /usr/local/bin

rm -f "$TMP_FILE"
curl -fL --retry 5 --retry-delay 2 --connect-timeout 20 \
  "$RAW_BASE/ish/ytconv.py" -o "$TMP_FILE"
python3 -m py_compile "$TMP_FILE" || fail "frontend yang terunduh tidak valid."
mv "$TMP_FILE" "$APP_FILE"
chmod 755 "$APP_FILE"

cat > "$BIN_FILE" <<'SH'
#!/bin/sh
exec python3 /usr/local/lib/ytconv-ish/ytconv.py "$@"
SH
chmod 755 "$BIN_FILE"
hash -r 2>/dev/null || true

say ""
say "YTConv iSH berhasil dipasang."
"$BIN_FILE" --version
"$BIN_FILE" --diagnose || true
say ""
say "Jalankan: ytconv"
say "Batch: ytconv --batch-file links.txt --continue-on-error"
say "Repair: ytconv --repair"
say "Hasil: $HOME/Downloads/YTConv"
