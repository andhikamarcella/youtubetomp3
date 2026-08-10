#!/bin/sh
set -eu

VERSION="1.7.2"
CHANNEL="latest"
RELEASE_BRANCH="release/ytconv-1.7.2"
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
  apt) PLAN='apt-get update; apt-get install nodejs npm python3 python3-pip ffmpeg ca-certificates curl' ;;
  dnf) PLAN='dnf install nodejs npm python3 python3-pip ffmpeg ca-certificates curl' ;;
  pacman) PLAN='pacman -Syu nodejs npm python python-pip ffmpeg ca-certificates curl' ;;
  zypper) PLAN='zypper install nodejs npm python3 python3-pip ffmpeg ca-certificates curl' ;;
  apk) PLAN='apk add python3 py3-pip ffmpeg ca-certificates curl; use the Python frontend when Node 22.14+ is unavailable' ;;
  xbps) PLAN='xbps-install -Sy nodejs npm python3 python3-pip ffmpeg ca-certificates curl' ;;
  emerge) PLAN='emerge net-libs/nodejs dev-lang/python media-video/ffmpeg net-misc/curl app-misc/ca-certificates' ;;
  nix) PLAN='nix profile install nixpkgs#nodejs_24 nixpkgs#python3 nixpkgs#ffmpeg nixpkgs#curl' ;;
  brew) PLAN='brew install node python ffmpeg curl' ;;
  *) PLAN='install Node.js 22.14+, npm, Python 3, FFmpeg, curl, and CA certificates' ;;
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
  else fail "administrator privileges are required for OS packages."
  fi
}

install_prerequisites() {
  case "$MANAGER" in
    apt)
      run_root apt-get update
      run_root apt-get install -y nodejs npm python3 python3-pip ffmpeg ca-certificates curl
      ;;
    dnf) run_root dnf install -y nodejs npm python3 python3-pip ffmpeg ca-certificates curl ;;
    pacman) run_root pacman -Syu --needed --noconfirm nodejs npm python python-pip ffmpeg ca-certificates curl ;;
    zypper) run_root zypper --non-interactive install nodejs npm python3 python3-pip ffmpeg ca-certificates curl ;;
    apk) run_root apk add --no-cache python3 py3-pip ffmpeg ca-certificates curl nodejs npm ;;
    xbps) run_root xbps-install -Sy nodejs npm python3 python3-pip ffmpeg ca-certificates curl ;;
    emerge) run_root emerge --ask=n net-libs/nodejs dev-lang/python media-video/ffmpeg net-misc/curl app-misc/ca-certificates ;;
    nix) nix profile install nixpkgs#nodejs_24 nixpkgs#python3 nixpkgs#ffmpeg nixpkgs#curl ;;
    brew) brew install node python ffmpeg curl ;;
    *) fail "the package manager is not recognized. $PLAN" ;;
  esac
}

node_supported() {
  has node && node -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22||(major===22&&minor>=14)?0:1)' >/dev/null 2>&1
}

if ! has node || ! has npm || ! has python3 || ! has ffmpeg || ! has curl; then
  say "Some dependencies are missing; installing them with $MANAGER..."
  install_prerequisites
fi

if [ "$MANAGER" = "apk" ] && ! node_supported; then
  say "The Alpine repository does not provide a supported Node.js version; installing the maintained Python frontend instead."
  TMP_INSTALLER="/tmp/ytconv-alpine-installer.$$"
  trap 'rm -f "$TMP_INSTALLER"' EXIT HUP INT TERM
  curl -fsSL --retry 5 --connect-timeout 20 \
    "https://raw.githubusercontent.com/andhikamarcella/YTConv/$RELEASE_BRANCH/cli/scripts/install-ish.sh" \
    -o "$TMP_INSTALLER"
  run_root sh "$TMP_INSTALLER"
  exit 0
fi

has node || fail "Node.js was not found after setup."
has npm || fail "npm was not found after setup."
node_supported || fail "Node.js $(node --version) is unsupported. Install Node.js 22.14+ or use a native 1.7.2 package."

if has python3; then
  python3 -m pip install --user -U --no-cache-dir 'yt-dlp[default]' gallery-dl 2>/dev/null \
    || python3 -m pip install --user -U --no-cache-dir --break-system-packages 'yt-dlp[default]' gallery-dl 2>/dev/null \
    || say "Note: pip fallback engines were not installed; ytconv repair will try again."
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
npm install -g "ytconv@$CHANNEL" --ignore-scripts --force
hash -r 2>/dev/null || true

command -v ytconv >/dev/null 2>&1 || fail "ytconv is not in PATH. Run: export PATH=\"$NPM_PREFIX/bin:\$PATH\""
installed=$(ytconv --version)
[ "$installed" = "$VERSION" ] || fail "installed version is $installed; expected $VERSION"
ytconv --self-test
ytconv doctor || true
ytconv quickstart || true
say ""
say "AUTO: YouTube Music -> MP3; regular videos and social URLs use provider detection."
say "Subtitles remain off unless explicitly enabled."
say "Stable installation completed without sudo npm."
say "Native DEB, RPM, Arch, Alpine APK, AppImage, Snap, Flatpak, and Nix artifacts are available in the 1.7.2 GitHub release."
