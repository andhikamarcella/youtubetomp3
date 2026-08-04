#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OUT=${1:-"$ROOT/dist/flatpak"}
STAGE="$ROOT/dist/portable-linux"
BUILD="$ROOT/dist/flatpak-build"
REPO="$ROOT/dist/flatpak-repo"
APP_ID=io.github.andhikamarcella.YTConv
VERSION=$(node -p "require('$ROOT/cli/package.json').version")
ARCH=$(flatpak --default-arch)
FLATHUB_REPO="https://dl.flathub.org/repo/flathub.flatpakrepo"

command -v flatpak >/dev/null 2>&1 || { printf 'flatpak is required.\n' >&2; exit 2; }
command -v flatpak-builder >/dev/null 2>&1 || { printf 'flatpak-builder is required.\n' >&2; exit 2; }
rm -rf "$OUT" "$BUILD" "$REPO"
mkdir -p "$OUT"
"$ROOT/packaging/build-portable-linux.sh" "$STAGE"

export XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
mkdir -p "$XDG_DATA_HOME/flatpak"
flatpak remote-delete --user flathub >/dev/null 2>&1 || true
flatpak remote-add --user --from flathub "$FLATHUB_REPO"
flatpak remotes --user --columns=name,url | grep -E '^flathub[[:space:]]'
flatpak install --user --noninteractive -y flathub \
  "org.freedesktop.Platform/${ARCH}/24.08" \
  "org.freedesktop.Sdk/${ARCH}/24.08"

flatpak-builder --user --force-clean --default-branch=stable --repo="$REPO" "$BUILD" \
  "$ROOT/packaging/flatpak/$APP_ID.yml"
PACKAGE="$OUT/YTConv-${VERSION}.flatpak"
flatpak build-bundle "$REPO" "$PACKAGE" "$APP_ID" stable

flatpak install --user --noninteractive -y --reinstall "$PACKAGE"
flatpak run --user --command=ytconv "$APP_ID" --version | grep -Fx "$VERSION"
flatpak uninstall --user --noninteractive -y "$APP_ID"
(
  cd "$OUT"
  sha256sum "$(basename "$PACKAGE")" > SHA256SUMS-flatpak.txt
)
printf '%s\n' "$PACKAGE"
