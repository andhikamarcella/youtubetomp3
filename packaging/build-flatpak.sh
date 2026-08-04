#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUT=${1:-"$ROOT/dist/flatpak"}
STAGE="$ROOT/dist/portable-linux"
BUILD="$ROOT/dist/flatpak-build"
REPO="$ROOT/dist/flatpak-repo"
APP_ID=io.github.andhikamarcella.YTConv
VERSION=$(node -p "require('$ROOT/cli/package.json').version")

command -v flatpak >/dev/null 2>&1 || { printf 'flatpak is required.\n' >&2; exit 2; }
command -v flatpak-builder >/dev/null 2>&1 || { printf 'flatpak-builder is required.\n' >&2; exit 2; }
rm -rf "$OUT" "$BUILD" "$REPO"
mkdir -p "$OUT"
"$ROOT/packaging/build-portable-linux.sh" "$STAGE"

flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user -y flathub org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08
flatpak-builder --user --force-clean --repo="$REPO" "$BUILD" \
  "$ROOT/packaging/flatpak/$APP_ID.yml"
PACKAGE="$OUT/YTConv-${VERSION}.flatpak"
flatpak build-bundle "$REPO" "$PACKAGE" "$APP_ID" stable

flatpak install --user -y --reinstall "$PACKAGE"
flatpak run --user --command=ytconv "$APP_ID" --version | grep -Fx "$VERSION"
flatpak uninstall --user -y "$APP_ID"
sha256sum "$PACKAGE" > "$OUT/SHA256SUMS-flatpak.txt"
printf '%s\n' "$PACKAGE"
