#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUT=${1:-"$ROOT/dist/appimage"}
STAGE="$ROOT/dist/portable-linux"
APPDIR="$ROOT/dist/YTConv.AppDir"
VERSION=$(node -p "require('$ROOT/cli/package.json').version")
APPIMAGETOOL_URL="https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage"
APPIMAGETOOL_SHA256="363dafac070b65cc36ca024b74db1f043c6f5cd7be8fca760e190dce0d18d684"

[ "$(uname -m)" = "x86_64" ] || { printf 'AppImage builder currently supports x86_64.\n' >&2; exit 2; }
rm -rf "$OUT" "$APPDIR"
mkdir -p "$OUT" "$APPDIR/usr"
"$ROOT/packaging/build-portable-linux.sh" "$STAGE"
cp -a "$STAGE/opt" "$APPDIR/usr/"
cp -a "$STAGE/usr/bin" "$APPDIR/usr/"
cp -a "$STAGE/usr/share" "$APPDIR/usr/"
cp "$ROOT/packaging/appimage/ytconv.desktop" "$APPDIR/ytconv.desktop"
cp "$ROOT/packaging/appimage/ytconv.svg" "$APPDIR/ytconv.svg"
cp "$ROOT/packaging/appimage/ytconv.svg" "$APPDIR/.DirIcon"

cat > "$APPDIR/AppRun" <<'SH'
#!/bin/sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export APPDIR="$HERE"
export YTCONV_DISTRIBUTION_PACKAGE=appimage
exec "$HERE/usr/bin/ytconv" "$@"
SH
chmod 0755 "$APPDIR/AppRun"

TOOL="$OUT/appimagetool-x86_64.AppImage"
curl --fail --location --retry 5 --connect-timeout 20 "$APPIMAGETOOL_URL" -o "$TOOL"
printf '%s  %s\n' "$APPIMAGETOOL_SHA256" "$TOOL" | sha256sum --check --strict -
chmod 0755 "$TOOL"
OUTPUT="$OUT/YTConv-${VERSION}-x86_64.AppImage"
ARCH=x86_64 "$TOOL" --appimage-extract-and-run "$APPDIR" "$OUTPUT"
chmod 0755 "$OUTPUT"
"$OUTPUT" --appimage-extract-and-run --version | grep -Fx "$VERSION"
sha256sum "$OUTPUT" > "$OUT/SHA256SUMS-appimage.txt"
rm -f "$TOOL"
printf '%s\n' "$OUTPUT"
