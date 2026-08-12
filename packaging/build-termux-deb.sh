#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUT=${1:-"$ROOT/dist/termux"}
VERSION=1.7.4
YT_DLP_VERSION=2026.7.4
YT_DLP_SHA256=f11f2b11d5a8ac4059f9bdf29fa4407dc7c6bb00c5097e95ca22a7a9db518266
GALLERY_DL_VERSION=1.32.9
GALLERY_DL_SHA256=271d18fed61e0b9f006d4944be59341b9af136576382e237aa08ba6d060a0e9a
PREFIX=/data/data/com.termux/files/usr

command -v dpkg-deb >/dev/null 2>&1 || { printf 'dpkg-deb is required.\n' >&2; exit 2; }
command -v unzip >/dev/null 2>&1 || { printf 'unzip is required.\n' >&2; exit 2; }
rm -rf "$OUT"
mkdir -p "$OUT"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
PKG="$WORK/ytconv"
APP="$PKG$PREFIX/lib/ytconv"
mkdir -p "$PKG/DEBIAN" "$APP/vendor" "$PKG$PREFIX/bin" "$PKG$PREFIX/share/doc/ytconv"

python3 -m pip download --disable-pip-version-check --no-deps --only-binary=:all: \
  --dest "$WORK" "yt-dlp==$YT_DLP_VERSION" "gallery-dl==$GALLERY_DL_VERSION"
YT_WHEEL=$(find "$WORK" -maxdepth 1 -type f -iname "yt_dlp-${YT_DLP_VERSION//./.}-*.whl" | head -n1)
GALLERY_WHEEL=$(find "$WORK" -maxdepth 1 -type f -iname "gallery_dl-${GALLERY_DL_VERSION//./.}-*.whl" | head -n1)
[ -n "$YT_WHEEL" ] && [ -n "$GALLERY_WHEEL" ] || { printf 'Pinned Python wheels were not downloaded.\n' >&2; exit 3; }
printf '%s  %s\n' "$YT_DLP_SHA256" "$YT_WHEEL" | sha256sum --check --strict -
printf '%s  %s\n' "$GALLERY_DL_SHA256" "$GALLERY_WHEEL" | sha256sum --check --strict -
unzip -q "$YT_WHEEL" -d "$APP/vendor"
unzip -q "$GALLERY_WHEEL" -d "$APP/vendor"

install -m 0755 "$ROOT/cli/ish/ytconv.py" "$APP/ytconv.py"
install -m 0755 "$ROOT/cli/ish/ytconv-core.py" "$APP/ytconv-core.py"
install -m 0644 "$ROOT/cli/LICENSE" "$PKG$PREFIX/share/doc/ytconv/LICENSE"
install -m 0644 "$ROOT/cli/README.md" "$PKG$PREFIX/share/doc/ytconv/README.md"

cat > "$PKG$PREFIX/bin/ytconv" <<'SH'
#!/data/data/com.termux/files/usr/bin/sh
set -eu
PREFIX=/data/data/com.termux/files/usr
export PYTHONPATH="$PREFIX/lib/ytconv/vendor${PYTHONPATH:+:$PYTHONPATH}"
export YTCONV_DISTRIBUTION_PACKAGE=termux-deb
export YTCONV_OUTPUT="${YTCONV_OUTPUT:-$HOME/storage/downloads/YTConv}"
exec "$PREFIX/bin/python" "$PREFIX/lib/ytconv/ytconv.py" "$@"
SH
chmod 0755 "$PKG$PREFIX/bin/ytconv"

cat > "$PKG/DEBIAN/control" <<EOF
Package: ytconv
Version: $VERSION
Architecture: all
Maintainer: Andhika Marcella Fernanda <andhikamarcella546@gmail.com>
Depends: python, ffmpeg, ca-certificates
Section: utilities
Priority: optional
Homepage: https://github.com/andhikamarcella/YTConv
Description: Secure social-media downloader and converter CLI for Termux
 Bundles verified pure-Python yt-dlp and gallery-dl modules while using the
 Termux Python and FFmpeg packages. Public access is tried first and subtitles
 stay disabled unless explicitly requested. No package install script is run.
EOF

PACKAGE="$OUT/ytconv_${VERSION}_all-termux.deb"
dpkg-deb --root-owner-group --build "$PKG" "$PACKAGE"
VERIFY="$WORK/verify"
dpkg-deb -x "$PACKAGE" "$VERIFY"
PYTHONPATH="$VERIFY$PREFIX/lib/ytconv/vendor" python3 "$VERIFY$PREFIX/lib/ytconv/ytconv.py" --version | grep -Fx "$VERSION"
grep -F 'YTCONV_DISTRIBUTION_PACKAGE=termux-deb' "$VERIFY$PREFIX/bin/ytconv"
sha256sum "$PACKAGE" > "$OUT/SHA256SUMS-termux.txt"
printf '%s\n' "$PACKAGE"
