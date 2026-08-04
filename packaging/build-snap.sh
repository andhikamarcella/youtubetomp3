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

PACKAGE="$OUT/ytconv_${VERSION}_amd64.snap"
snap pack "$SNAPROOT" "$PACKAGE"
EXTRACT="$OUT/extracted"
mkdir -p "$EXTRACT"
unsquashfs -d "$EXTRACT/squashfs-root" "$PACKAGE" >/dev/null
SNAP="$EXTRACT/squashfs-root" "$EXTRACT/squashfs-root/usr/bin/ytconv" --version | grep -Fx "$VERSION"
rm -rf "$EXTRACT"
sha256sum "$PACKAGE" > "$OUT/SHA256SUMS-snap.txt"
printf '%s\n' "$PACKAGE"
