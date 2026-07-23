#!/bin/sh
set -eu
printf '%s\n' 'YTConv 1.2.3 installer untuk Linux/macOS/SSH'
command -v node >/dev/null 2>&1 || { printf '%s\n' 'Node.js 18+ belum terpasang.' >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { printf '%s\n' 'npm belum terpasang.' >&2; exit 1; }
major=$(node -p 'process.versions.node.split(".")[0]')
[ "$major" -ge 18 ] || { printf '%s\n' 'Node.js terlalu lama. Minimal 18.' >&2; exit 1; }
npm uninstall -g ytconv >/dev/null 2>&1 || true
npm cache verify
npm install -g ytconv@1.2.3 --force
ytconv --version
ytconv --self-test
printf '%s\n' 'SSH/non-TTY: ytconv --headless "LINK"'
