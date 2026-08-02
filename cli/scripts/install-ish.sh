#!/bin/sh
set -eu

RAW_BASE="https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/release/ytconv-1.5.0/cli"
APP_DIR="/usr/local/lib/ytconv-ish"
APP_FILE="$APP_DIR/ytconv.py"
CORE_FILE="$APP_DIR/ytconv-core.py"
BIN_FILE="/usr/local/bin/ytconv"
TMP_APP="/tmp/ytconv-ish-wrapper.py.$$"
TMP_CORE="/tmp/ytconv-ish-core.py.$$"
VERSION="1.5.0"

say() { printf '%s\n' "$*"; }
fail() { printf 'YTConv iSH installer: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || fail "run this installer as root inside iSH."
[ -f /etc/alpine-release ] || fail "this installer is intended for iSH/Alpine Linux."

say "YTConv iSH $VERSION installer"
say "Installing Python, FFmpeg, yt-dlp, gallery-dl, curl, and CA certificates..."

apk update
apk add --no-cache python3 py3-pip ffmpeg curl ca-certificates
update-ca-certificates >/dev/null 2>&1 || true

pip_install() {
  python3 -m pip install -U --no-cache-dir --break-system-packages "$@" 2>/dev/null \
    || python3 -m pip install -U --no-cache-dir "$@"
}

pip_install yt-dlp gallery-dl
mkdir -p "$APP_DIR" "$HOME/Downloads/YTConv" /usr/local/bin

rm -f "$TMP_APP" "$TMP_CORE"
trap 'rm -f "$TMP_APP" "$TMP_CORE"' EXIT HUP INT TERM

curl -fL --retry 5 --retry-delay 2 --connect-timeout 20 "$RAW_BASE/ish/ytconv.py" -o "$TMP_APP"
curl -fL --retry 5 --retry-delay 2 --connect-timeout 20 "$RAW_BASE/ish/ytconv-beta.py" -o "$TMP_CORE"
python3 -m py_compile "$TMP_APP" "$TMP_CORE" || fail "the downloaded frontend is invalid."

mv "$TMP_APP" "$APP_FILE"
mv "$TMP_CORE" "$CORE_FILE"
trap - EXIT HUP INT TERM
chmod 755 "$APP_FILE" "$CORE_FILE"

cat > "$BIN_FILE" <<'SH'
#!/bin/sh
exec python3 /usr/local/lib/ytconv-ish/ytconv.py "$@"
SH
chmod 755 "$BIN_FILE"
hash -r 2>/dev/null || true

installed=$("$BIN_FILE" --version)
[ "$installed" = "$VERSION" ] || fail "the installed frontend reported $installed; expected $VERSION."

say ""
say "YTConv iSH $VERSION was installed successfully."
"$BIN_FILE" --version
"$BIN_FILE" --diagnose || true
say ""
say "First login: ytconv login"
say "Then download: ytconv URL"
say "Playlist: ytconv playlist URL"
say "Batch: ytconv batch links.txt --continue-on-error"
say "Opt out: --no-subtitles --no-sponsorblock --no-archive"
say "Output: $HOME/Downloads/YTConv"