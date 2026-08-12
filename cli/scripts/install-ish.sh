#!/bin/sh
set -eu

VERSION="1.7.5"
RAW_BASE="https://raw.githubusercontent.com/andhikamarcella/YTConv/release/ytconv-1.7.5/cli"
APP_DIR="/usr/local/lib/ytconv-ish"
APP_FILE="$APP_DIR/ytconv.py"
CORE_FILE="$APP_DIR/ytconv-core.py"
BIN_FILE="/usr/local/bin/ytconv"
TMP_DIR="/tmp/ytconv-ish-install.$$"

say() { printf '%s\n' "$*"; }
fail() { printf 'YTConv iSH/Alpine installer: %s\n' "$*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

[ "$(id -u)" = "0" ] || fail "run this installer as root (inside iSH, run: su)."
[ -f /etc/alpine-release ] || fail "this installer is intended for iSH or Alpine Linux."

say "YTConv iSH/Alpine $VERSION installer"
say "This edition uses Python and does not require Node.js."

apk update
apk add --no-cache python3 py3-pip ffmpeg curl ca-certificates
update-ca-certificates >/dev/null 2>&1 || true

pip_install() {
  python3 -m pip install -U --no-cache-dir --break-system-packages "$@" 2>/dev/null \
    || python3 -m pip install -U --no-cache-dir "$@"
}

pip_install 'yt-dlp[default]' gallery-dl \
  || fail "pip could not install yt-dlp and gallery-dl. Check the device clock and internet connection."

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR" "$APP_DIR" "$HOME/Downloads/YTConv" /usr/local/bin
trap 'rm -rf "$TMP_DIR"' EXIT HUP INT TERM

curl -fsSL --retry 5 --retry-delay 2 --connect-timeout 20 \
  "$RAW_BASE/ish/SHA256SUMS" -o "$TMP_DIR/SHA256SUMS"
curl -fsSL --retry 5 --retry-delay 2 --connect-timeout 20 \
  "$RAW_BASE/ish/ytconv.py" -o "$TMP_DIR/ytconv.py"
curl -fsSL --retry 5 --retry-delay 2 --connect-timeout 20 \
  "$RAW_BASE/ish/ytconv-core.py" -o "$TMP_DIR/ytconv-core.py"

(
  cd "$TMP_DIR"
  sha256sum -c SHA256SUMS
) || fail "SHA-256 verification failed. No downloaded file was installed."

python3 -m py_compile "$TMP_DIR/ytconv.py" "$TMP_DIR/ytconv-core.py" \
  || fail "the verified Python frontend failed its syntax check."

install -m 0755 "$TMP_DIR/ytconv.py" "$APP_FILE"
install -m 0755 "$TMP_DIR/ytconv-core.py" "$CORE_FILE"

cat > "$BIN_FILE" <<'SH'
#!/bin/sh
exec python3 /usr/local/lib/ytconv-ish/ytconv.py "$@"
SH
chmod 0755 "$BIN_FILE"
hash -r 2>/dev/null || true

installed=$("$BIN_FILE" --version)
[ "$installed" = "$VERSION" ] || fail "the installed frontend reported $installed; expected $VERSION."
"$BIN_FILE" --diagnose || true

say ""
say "YTConv iSH/Alpine $VERSION installed successfully."
say "AUTO: music.youtube.com -> MP3; regular YouTube -> MP4; social URLs use provider detection."
say "Subtitles remain off unless explicitly requested."
say "Update later with: ytconv update"
say "Repair dependencies with: ytconv repair"
say "Default output: $HOME/Downloads/YTConv"
