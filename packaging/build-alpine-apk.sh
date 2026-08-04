#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUT=${1:-"$ROOT/dist/alpine"}
BUILD="$ROOT/dist/alpine-build"

rm -rf "$OUT" "$BUILD"
mkdir -p "$OUT" "$BUILD"
cp "$ROOT/packaging/alpine/APKBUILD" "$BUILD/APKBUILD"
cp "$ROOT/cli/ish/ytconv.py" "$BUILD/ytconv.py"
cp "$ROOT/cli/ish/ytconv-core.py" "$BUILD/ytconv-core.py"
cp "$ROOT/cli/LICENSE" "$BUILD/LICENSE"

if [ "$(id -u)" = "0" ]; then
  BUILDER=ytconvbuilder
  adduser -D "$BUILDER" 2>/dev/null || true
  addgroup "$BUILDER" abuild 2>/dev/null || true
  chown -R "$BUILDER:$BUILDER" "$BUILD" "$OUT"
  su "$BUILDER" -c "abuild-keygen -a -n >/dev/null 2>&1 || true; cd '$BUILD'; abuild checksum; abuild -r"
  HOME_DIR=$(getent passwd "$BUILDER" | cut -d: -f6)
else
  abuild-keygen -a -n >/dev/null 2>&1 || true
  (cd "$BUILD" && abuild checksum && abuild -r)
  HOME_DIR=$HOME
fi

find "$HOME_DIR/packages" -type f -name 'ytconv-1.6.5-r0.apk' -exec cp {} "$OUT/" \;
PACKAGE=$(find "$OUT" -maxdepth 1 -type f -name 'ytconv-1.6.5-r0.apk' | head -n1)
[ -n "$PACKAGE" ] || { printf 'Alpine package was not produced.\n' >&2; exit 2; }
sha256sum "$PACKAGE" > "$OUT/SHA256SUMS-alpine.txt"
printf '%s\n' "$PACKAGE"
