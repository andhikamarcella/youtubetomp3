#!/usr/bin/env sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUT=${1:-"$ROOT/dist/alpine"}
BUILD="$ROOT/dist/alpine-build"
VERSION=1.7.1

rm -rf "$OUT" "$BUILD"
mkdir -p "$OUT" "$BUILD"
cp "$ROOT/packaging/alpine/APKBUILD" "$BUILD/APKBUILD"
cp "$ROOT/cli/ish/ytconv.py" "$BUILD/ytconv.py"
cp "$ROOT/cli/ish/ytconv-core.py" "$BUILD/ytconv-core.py"
cp "$ROOT/cli/LICENSE" "$BUILD/LICENSE"

copy_built_package() {
  search_root=$1
  find "$search_root" -type f -name "ytconv-${VERSION}-r0.apk" -exec cp {} "$OUT/" \; 2>/dev/null || true
}

build_as_user() {
  user=$1
  home=$2
  su "$user" -c "
    set -u
    abuild-keygen -a -n >/dev/null 2>&1 || true
    cd '$BUILD'
    abuild checksum
    abuild -r || true
  "
  copy_built_package "$home"
}

if [ "$(id -u)" = "0" ]; then
  BUILDER=ytconvbuilder
  adduser -D "$BUILDER" 2>/dev/null || true
  addgroup "$BUILDER" abuild 2>/dev/null || true
  chown -R "$BUILDER:$BUILDER" "$BUILD" "$OUT"
  HOME_DIR=$(getent passwd "$BUILDER" | cut -d: -f6)
  build_as_user "$BUILDER" "$HOME_DIR"
else
  abuild-keygen -a -n >/dev/null 2>&1 || true
  (cd "$BUILD" && abuild checksum && { abuild -r || true; })
  copy_built_package "$HOME"
fi

PACKAGE=$(find "$OUT" -maxdepth 1 -type f -name "ytconv-${VERSION}-r0.apk" | head -n1)
[ -n "$PACKAGE" ] || { printf 'Alpine package was not produced.\n' >&2; exit 2; }
[ -s "$PACKAGE" ] || { printf 'Alpine package is empty.\n' >&2; exit 2; }
PACKAGE_NAME=$(basename "$PACKAGE")
(
  cd "$OUT"
  sha256sum "$PACKAGE_NAME" > SHA256SUMS-alpine.txt
)
printf '%s\n' "$PACKAGE"
