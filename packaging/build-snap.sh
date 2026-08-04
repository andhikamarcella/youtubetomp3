#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUT=${1:-"$ROOT/dist/snap"}
STAGE="$ROOT/dist/portable-linux"
SNAPROOT="$ROOT/dist/snap-root"
VERSION=$(node -p "require('$ROOT/cli/package.json').version")

command -v snap >/dev/null 2>&1 || { printf 'snap command is required.\n' >&2; exit 2; }
command -v unsquashfs >/dev/null 2>&1 || { printf 'squashfs-tools is required.\n' >&2; exit 2; }
rm -rf "$OUT" "$SNAPROOT"
mkdir -p "$OUT" "$SNAPROOT/meta"
"$ROOT/packaging/build-portable-linux.sh" "$STAGE"
cp -a "$STAGE/opt" "$SNAPROOT/"
cp -a "$STAGE/usr" "$SNAPROOT/"
cp "$ROOT/packaging/snap/snap.yaml" "$SNAPROOT/meta/snap.yaml"

snap pack "$SNAPROOT" "$OUT"
BUILT=$(find "$OUT" -maxdepth 1 -type f -name "ytconv_${VERSION}_*.snap" | head -n1)
[ -n "$BUILT" ] || { printf 'snap pack did not create a package file.\n' >&2; exit 3; }
PACKAGE="$OUT/ytconv_${VERSION}_amd64.snap"
if [ "$BUILT" != "$PACKAGE" ]; then
  mv "$BUILT" "$PACKAGE"
fi
[ -s "$PACKAGE" ] || { printf 'Snap package is empty.\n' >&2; exit 3; }

EXTRACT="$OUT/extracted"
mkdir -p "$EXTRACT"
unsquashfs -d "$EXTRACT/squashfs-root" "$PACKAGE" >/dev/null
SNAP="$EXTRACT/squashfs-root" "$EXTRACT/squashfs-root/usr/bin/ytconv" --version | grep -Fx "$VERSION"
rm -rf "$EXTRACT"
(
  cd "$OUT"
  sha256sum "$(basename "$PACKAGE")" > SHA256SUMS-snap.txt
)
printf '%s\n' "$PACKAGE"
