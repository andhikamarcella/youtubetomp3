#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CLI="$ROOT/cli"
DIST=${1:-"$ROOT/dist/portable-linux"}
NODE_VERSION=${NODE_VERSION:-24.18.0}
MACHINE=${YTCONV_ARCH:-$(uname -m)}

case "$MACHINE" in
  x86_64|amd64) NODE_ARCH=x64; PACKAGE_ARCH=amd64 ;;
  aarch64|arm64) NODE_ARCH=arm64; PACKAGE_ARCH=arm64 ;;
  *) printf 'Unsupported portable Linux architecture: %s\n' "$MACHINE" >&2; exit 2 ;;
esac

VERSION=$(node -p "require('$CLI/package.json').version")
[ "$VERSION" = "1.7.3" ] || { printf 'Expected YTConv 1.7.3, got %s\n' "$VERSION" >&2; exit 3; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
rm -rf "$DIST"
mkdir -p "$DIST/opt/ytconv/app" "$DIST/opt/ytconv/node" \
  "$DIST/usr/bin" "$DIST/usr/share/doc/ytconv" "$DIST/usr/share/ytconv"

printf 'Building YTConv %s portable Linux root for %s...\n' "$VERSION" "$PACKAGE_ARCH"

PACK_JSON="$WORK/pack.json"
(
  cd "$CLI"
  npm pack --ignore-scripts --json --pack-destination "$WORK" > "$PACK_JSON"
)
TARBALL=$(node -e "const p=require(process.argv[1])[0];process.stdout.write(require('path').join(process.argv[2],p.filename))" "$PACK_JSON" "$WORK")
tar -xzf "$TARBALL" -C "$DIST/opt/ytconv/app" --strip-components=1
(
  cd "$DIST/opt/ytconv/app"
  npm install --omit=dev --ignore-scripts --no-audit --no-fund --no-package-lock
)

NODE_FILE="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
NODE_BASE="https://nodejs.org/dist/v${NODE_VERSION}"
curl --fail --location --retry 5 --connect-timeout 20 "$NODE_BASE/SHASUMS256.txt" -o "$WORK/SHASUMS256.txt"
curl --fail --location --retry 5 --connect-timeout 20 "$NODE_BASE/$NODE_FILE" -o "$WORK/$NODE_FILE"
(
  cd "$WORK"
  grep "  $NODE_FILE\$" SHASUMS256.txt | sha256sum --check --strict -
)
tar -xJf "$WORK/$NODE_FILE" -C "$DIST/opt/ytconv/node" --strip-components=1

cat > "$DIST/usr/bin/ytconv" <<'SH'
#!/bin/sh
set -eu
if [ -n "${APPDIR:-}" ] && [ -x "$APPDIR/usr/opt/ytconv/node/bin/node" ]; then
  ROOT="$APPDIR/usr/opt/ytconv"
elif [ -n "${SNAP:-}" ] && [ -x "$SNAP/opt/ytconv/node/bin/node" ]; then
  ROOT="$SNAP/opt/ytconv"
elif [ -x "/app/opt/ytconv/node/bin/node" ]; then
  ROOT="/app/opt/ytconv"
else
  ROOT="${YTCONV_INSTALL_ROOT:-/opt/ytconv}"
fi
export YTCONV_DISTRIBUTION_PACKAGE="${YTCONV_DISTRIBUTION_PACKAGE:-portable-linux}"
exec "$ROOT/node/bin/node" "$ROOT/app/bin/ytconv-auth.js" "$@"
SH
chmod 0755 "$DIST/usr/bin/ytconv"

cp "$CLI/LICENSE" "$DIST/usr/share/doc/ytconv/LICENSE"
cp "$CLI/README.md" "$DIST/usr/share/doc/ytconv/README.md"
printf '%s\n' portable-linux > "$DIST/usr/share/ytconv/package-manager"
printf '%s\n' "$VERSION" > "$DIST/usr/share/ytconv/version"
printf '%s\n' "$PACKAGE_ARCH" > "$DIST/usr/share/ytconv/architecture"

"$DIST/opt/ytconv/node/bin/node" "$DIST/opt/ytconv/app/bin/ytconv.js" --version | grep -Fx "$VERSION"
printf '%s\n' "$DIST"
