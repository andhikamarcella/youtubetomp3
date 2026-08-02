#!/bin/sh
set -eu

VERSION="1.5.0"
CHANNEL="latest"
PRINT_PLAN=0
[ "${YTCONV_INSTALL_DRY_RUN:-0}" = "1" ] && PRINT_PLAN=1
[ "${1:-}" = "--print-plan" ] && PRINT_PLAN=1

say() { printf '%s\n' "$*"; }
fail() { printf 'YTConv installer: %s\n' "$*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

OS_ID=""
OS_LIKE=""
OS_NAME="$(uname -s 2>/dev/null || printf unknown)"
if [ -r /etc/os-release ]; then
  OS_ID=$(sed -n 's/^ID=//p' /etc/os-release | head -n1 | tr -d '"')
  OS_LIKE=$(sed -n 's/^ID_LIKE=//p' /etc/os-release | head -n1 | tr -d '"')
  PRETTY=$(sed -n 's/^PRETTY_NAME=//p' /etc/os-release | head -n1 | tr -d '"')
  [ -n "$PRETTY" ] && OS_NAME="$PRETTY"
fi
IDS="$OS_ID $OS_LIKE"

MANAGER=unknown
if has apt-get || printf '%s' "$IDS" | grep -Eq 'debian|ubuntu|linuxmint|pop|kali|neon'; then MANAGER=apt
elif has dnf || printf '%s' "$IDS" | grep -Eq 'fedora|rhel|centos|rocky|almalinux|nobara'; then MANAGER=dnf
elif has pacman || printf '%s' "$IDS" | grep -Eq 'arch|manjaro|endeavouros|cachyos|garuda'; then MANAGER=pacman
elif has zypper || printf '%s' "$IDS" | grep -Eq 'opensuse|suse'; then MANAGER=zypper
elif has apk || printf '%s' "$IDS" | grep -Eq 'alpine'; then MANAGER=apk
elif has xbps-install || printf '%s' "$IDS" | grep -Eq 'void'; then MANAGER=xbps
elif has emerge || printf '%s' "$IDS" | grep -Eq 'gentoo'; then MANAGER=emerge
elif has nix || printf '%s' "$IDS" | grep -Eq 'nixos'; then MANAGER=nix
elif has brew || [ "$(uname -s 2>/dev/null || true)" = "Darwin" ]; then MANAGER=brew
fi

case "$MANAGER" in
  apt) PLAN='apt-get update && apt-get install -y nodejs npm python3 python3-pip ffmpeg ca-certificates curl' ;;
  dnf) PLAN='dnf install -y nodejs npm python3 python3-pip ffmpeg ca-certificates curl' ;;
  pacman) PLAN='pacman -Syu --needed --noconfirm nodejs npm python python-pip ffmpeg ca-certificates curl' ;;
  zypper) PLAN='zypper --non-interactive install nodejs npm python3 python3-pip ffmpeg ca-certificates curl' ;;
  apk) PLAN='apk add --no-cache nodejs npm python3 py3-pip ffmpeg ca-certificates curl' ;;
  xbps) PLAN='xbps-install -Sy nodejs npm python3 python3-pip ffmpeg ca-certificates curl' ;;
  emerge) PLAN='emerge --ask=n net-libs/nodejs dev-lang/python media-video/ffmpeg net-misc/curl app-misc/ca-certificates' ;;
  nix) PLAN='nix profile install nixpkgs#nodejs_22 nixpkgs#python3 nixpkgs#ffmpeg' ;;
  brew) PLAN='brew install node python ffmpeg' ;;
  *) PLAN='install Node.js 18+, npm, Python 3, FFmpeg, curl, and CA certificates with the system package manager' ;;
esac

say "YTConv $VERSION installer"
say "Channel         : $CHANNEL"
say "System          : $OS_NAME"
say "Package manager : $MANAGER"
say "Package plan    : $PLAN"

[ "$PRINT_PLAN" = "1" ] && exit 0

run_root() {
  if [ "$(id -u)" = "0" ]; then "$@"
  elif has sudo; then sudo "$@"
  else fail "administrator privileges are required for OS packages. Run manually: $PLAN"
  fi
}

install_prerequisites() {
  case "$MANAGER" in
    apt) run_root apt-get update; run_root apt-get install -y nodejs npm python3 python3-pip ffmpeg ca-certificates curl ;;
    dnf) run_root dnf install -y nodejs npm python3 python3-pip ffmpeg ca-certificates curl ;;
    pacman) run_root pacman -Syu --needed --noconfirm nodejs npm python python-pip ffmpeg ca-certificates curl ;;
    zypper) run_root zypper --non-interactive install nodejs npm python3 python3-pip ffmpeg ca-certificates curl ;;
    apk) run_root apk add --no-cache nodejs npm python3 py3-pip ffmpeg ca-certificates curl ;;
    xbps) run_root xbps-install -Sy nodejs npm python3 python3-pip ffmpeg ca-certificates curl ;;
    emerge) run_root emerge --ask=n net-libs/nodejs dev-lang/python media-video/ffmpeg net-misc/curl app-misc/ca-certificates ;;
    nix) sh -c "$PLAN" ;;
    brew) sh -c "$PLAN" ;;
    *) fail "the package manager is not recognized. $PLAN" ;;
  esac
}

if ! has node || ! has npm || ! has python3 || ! has ffmpeg; then
  say "Some dependencies are missing; installing them with $MANAGER..."
  install_prerequisites
fi

has node || fail "Node.js was not found after setup."
has npm || fail "npm was not found after setup."
major=$(node -p 'process.versions.node.split(".")[0]')
[ "$major" -ge 18 ] || fail "Node.js $(node --version) is too old. Use Node.js 18 or newer."

if has python3; then
  python3 -m pip install --user -U --no-cache-dir yt-dlp gallery-dl 2>/dev/null \
    || python3 -m pip install --user -U --no-cache-dir --break-system-packages yt-dlp gallery-dl 2>/dev/null \
    || say "Note: pip fallback engines were not installed; YTConv will still try bundled/PATH engines."
fi

NPM_PREFIX="${NPM_CONFIG_PREFIX:-$HOME/.local}"
mkdir -p "$NPM_PREFIX/bin"
npm config set prefix "$NPM_PREFIX"
PATH="$NPM_PREFIX/bin:$PATH"
export PATH

PROFILE=""
[ -n "${SHELL:-}" ] && PROFILE="$HOME/.$(basename "$SHELL")rc"
[ -z "$PROFILE" ] && PROFILE="$HOME/.profile"
PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'
if [ ! -f "$PROFILE" ] || ! grep -F '$HOME/.local/bin' "$PROFILE" >/dev/null 2>&1; then
  printf '\n%s\n' "$PATH_LINE" >> "$PROFILE"
fi

npm uninstall -g ytconv >/dev/null 2>&1 || true
npm cache verify
npm install -g "ytconv@$CHANNEL" --force
hash -r 2>/dev/null || true

command -v ytconv >/dev/null 2>&1 || fail "ytconv is not in PATH. Run: export PATH=\"$NPM_PREFIX/bin:\$PATH\""
installed=$(ytconv --version)
[ "$installed" = "$VERSION" ] || fail "installed version is $installed; expected $VERSION"
ytconv --self-test
ytconv --shell-info || true
ytconv doctor || true
ytconv quickstart || true
say ""
say "Stable installation completed without sudo npm. Open a new terminal or run: export PATH=\"$NPM_PREFIX/bin:\$PATH\""
say "Sign in once before downloading: ytconv login"