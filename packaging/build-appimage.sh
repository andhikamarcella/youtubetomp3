#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUT=${1:-"$ROOT/dist/appimage"}
STAGE="$ROOT/dist/portable-linux"
APPDIR="$ROOT/dist/YTConv.AppDir"
VERSION=$(node -p "require('$ROOT/cli/package.json').version")
APPIMAGETOOL_REPOSITORY="AppImage/appimagetool"
APPIMAGETOOL_TAG="continuous"
APPIMAGETOOL_ASSET="appimagetool-x86_64.AppImage"

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

RELEASE_JSON="$OUT/appimagetool-release.json"
curl --fail --location --retry 5 --connect-timeout 20 \
  -H 'Accept: application/vnd.github+json' \
  "https://api.github.com/repos/${APPIMAGETOOL_REPOSITORY}/releases/tags/${APPIMAGETOOL_TAG}" \
  -o "$RELEASE_JSON"
mapfile -t ASSET_INFO < <(node - "$RELEASE_JSON" "$APPIMAGETOOL_ASSET" <<'NODE'
const fs = require('node:fs');
const release = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const asset = release.assets?.find((value) => value.name === process.argv[3]);
if (!asset) throw new Error(`release asset not found: ${process.argv[3]}`);
if (!/^sha256:[a-f0-9]{64}$/iu.test(asset.digest ?? '')) {
  throw new Error(`GitHub release asset has no usable SHA-256 digest: ${asset.digest}`);
}
console.log(asset.browser_download_url);
console.log(asset.digest.slice('sha256:'.length).toLowerCase());
NODE
)
[ "${#ASSET_INFO[@]}" -eq 2 ] || { printf 'Could not resolve verified appimagetool asset metadata.\n' >&2; exit 3; }
APPIMAGETOOL_URL=${ASSET_INFO[0]}
APPIMAGETOOL_SHA256=${ASSET_INFO[1]}
TOOL="$OUT/$APPIMAGETOOL_ASSET"
curl --fail --location --retry 5 --connect-timeout 20 "$APPIMAGETOOL_URL" -o "$TOOL"
printf '%s  %s\n' "$APPIMAGETOOL_SHA256" "$TOOL" | sha256sum --check --strict -
chmod 0755 "$TOOL"
OUTPUT="$OUT/YTConv-${VERSION}-x86_64.AppImage"
ARCH=x86_64 "$TOOL" --appimage-extract-and-run "$APPDIR" "$OUTPUT"
chmod 0755 "$OUTPUT"
"$OUTPUT" --appimage-extract-and-run --version | grep -Fx "$VERSION"
(
  cd "$OUT"
  sha256sum "$(basename "$OUTPUT")" > SHA256SUMS-appimage.txt
)
rm -f "$TOOL" "$RELEASE_JSON"
printf '%s\n' "$OUTPUT"
