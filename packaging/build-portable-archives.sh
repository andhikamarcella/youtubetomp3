#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUT=${1:-"$ROOT/dist/portable"}
STAGE="$ROOT/dist/portable-linux"
VERSION=$(node -p "require('$ROOT/cli/package.json').version")
MACHINE=$(uname -m)
case "$MACHINE" in
  x86_64) ARCH=x86_64 ;;
  aarch64) ARCH=aarch64 ;;
  *) printf 'Unsupported portable architecture: %s\n' "$MACHINE" >&2; exit 2 ;;
esac

rm -rf "$OUT"
mkdir -p "$OUT"
"$ROOT/packaging/build-portable-linux.sh" "$STAGE"
TAR_GZ="$OUT/YTConv-${VERSION}-linux-${ARCH}.tar.gz"
TAR_ZST="$OUT/YTConv-${VERSION}-linux-${ARCH}.tar.zst"
tar --sort=name --mtime='UTC 2026-08-04' --owner=0 --group=0 --numeric-owner \
  -czf "$TAR_GZ" -C "$STAGE" .
tar --sort=name --mtime='UTC 2026-08-04' --owner=0 --group=0 --numeric-owner \
  --zstd -cf "$TAR_ZST" -C "$STAGE" .
VERIFY=$(mktemp -d)
trap 'rm -rf "$VERIFY"' EXIT
tar -xzf "$TAR_GZ" -C "$VERIFY"
YTCONV_INSTALL_ROOT="$VERIFY/opt/ytconv" "$VERIFY/usr/bin/ytconv" --version | grep -Fx "$VERSION"
sha256sum "$TAR_GZ" "$TAR_ZST" > "$OUT/SHA256SUMS-portable.txt"
printf '%s\n%s\n' "$TAR_GZ" "$TAR_ZST"
