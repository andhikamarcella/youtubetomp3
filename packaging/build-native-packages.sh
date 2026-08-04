#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUT=${1:-"$ROOT/dist/packages"}
STAGE="$ROOT/dist/portable-linux"
VERSION=$(node -p "require('$ROOT/cli/package.json').version")
MACHINE=${YTCONV_ARCH:-$(uname -m)}

case "$MACHINE" in
  x86_64|amd64) PACKAGE_ARCH=amd64; RPM_ARCH=x86_64; ARCH_ARCH=x86_64 ;;
  aarch64|arm64) PACKAGE_ARCH=arm64; RPM_ARCH=aarch64; ARCH_ARCH=aarch64 ;;
  *) printf 'Unsupported package architecture: %s\n' "$MACHINE" >&2; exit 2 ;;
esac

command -v nfpm >/dev/null 2>&1 || { printf 'nfpm is required. Install github.com/goreleaser/nfpm/v2/cmd/nfpm.\n' >&2; exit 3; }

rm -rf "$OUT"
mkdir -p "$OUT"
"$ROOT/packaging/build-portable-linux.sh" "$STAGE"

CONFIG=$(mktemp)
trap 'rm -f "$CONFIG"' EXIT
node - "$ROOT/packaging/nfpm.yaml" "$CONFIG" "$STAGE" "$VERSION" "$PACKAGE_ARCH" <<'NODE'
const fs = require('node:fs');
const [, , source, destination, stage, version, packageArch] = process.argv;
let config = fs.readFileSync(source, 'utf8');
for (const [name, value] of Object.entries({ STAGE: stage, VERSION: version, PACKAGE_ARCH: packageArch })) {
  config = config.replaceAll(`\${${name}}`, value);
}
if (/\$\{(?:STAGE|VERSION|PACKAGE_ARCH)\}/u.test(config)) {
  throw new Error('An nFPM placeholder was not resolved');
}
fs.writeFileSync(destination, config);
NODE

grep -F "$STAGE/opt/ytconv" "$CONFIG" >/dev/null
nfpm package --config "$CONFIG" --packager deb \
  --target "$OUT/ytconv_${VERSION}_${PACKAGE_ARCH}.deb"
nfpm package --config "$CONFIG" --packager rpm \
  --target "$OUT/ytconv-${VERSION}-1.${RPM_ARCH}.rpm"
nfpm package --config "$CONFIG" --packager archlinux \
  --target "$OUT/ytconv-${VERSION}-1-${ARCH_ARCH}.pkg.tar.zst"

for package in "$OUT"/*; do
  sha256sum "$package"
done > "$OUT/SHA256SUMS-linux.txt"

printf 'Built native Linux packages in %s\n' "$OUT"
