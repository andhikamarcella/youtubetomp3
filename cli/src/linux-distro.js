import fs from 'node:fs/promises';
import process from 'node:process';

export function parseOsRelease(content = '') {
  const values = {};
  for (const rawLine of String(content).split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value.replace(/\\n/gu, '\n').replace(/\\"/gu, '"');
  }
  return values;
}

export function packageManagerFor({ id = '', idLike = '', available = [] } = {}) {
  const ids = `${id} ${idLike}`.toLowerCase().split(/\s+/u).filter(Boolean);
  const has = (name) => available.includes(name);
  if (has('apt-get') || ids.some((value) => ['debian', 'ubuntu', 'linuxmint', 'pop', 'kali', 'neon'].includes(value))) return 'apt';
  if (has('dnf') || ids.some((value) => ['fedora', 'rhel', 'centos', 'rocky', 'almalinux', 'nobara'].includes(value))) return 'dnf';
  if (has('pacman') || ids.some((value) => ['arch', 'manjaro', 'endeavouros', 'cachyos', 'garuda'].includes(value))) return 'pacman';
  if (has('zypper') || ids.some((value) => ['opensuse', 'suse'].includes(value))) return 'zypper';
  if (has('apk') || ids.includes('alpine')) return 'apk';
  if (has('xbps-install') || ids.includes('void')) return 'xbps';
  if (has('emerge') || ids.includes('gentoo')) return 'emerge';
  if (has('nix') || ids.includes('nixos')) return 'nix';
  if (has('brew')) return 'brew';
  return 'unknown';
}

export function installPlanFor(manager) {
  const plans = {
    apt: 'sudo apt-get update && sudo apt-get install -y nodejs npm python3 python3-pip ffmpeg',
    dnf: 'sudo dnf install -y nodejs npm python3 python3-pip ffmpeg',
    pacman: 'sudo pacman -S --needed nodejs npm python python-pip ffmpeg',
    zypper: 'sudo zypper --non-interactive install nodejs npm python3 python3-pip ffmpeg',
    apk: 'sudo apk add nodejs npm python3 py3-pip ffmpeg',
    xbps: 'sudo xbps-install -Sy nodejs npm python3 python3-pip ffmpeg',
    emerge: 'sudo emerge --ask=n net-libs/nodejs dev-lang/python media-video/ffmpeg',
    nix: 'nix profile install nixpkgs#nodejs_22 nixpkgs#python3 nixpkgs#ffmpeg',
    brew: 'brew install node python ffmpeg',
  };
  return plans[manager] || 'Install Node.js 22.14+, npm, Python 3, and FFmpeg through the distribution package manager.';
}

export async function detectLinuxDistro({ file = '/etc/os-release', available = [] } = {}) {
  if (process.platform !== 'linux' && process.platform !== 'android') {
    return {
      id: process.platform,
      name: process.platform,
      version: '',
      idLike: '',
      manager: process.platform === 'darwin' ? 'brew' : 'unknown',
      installPlan: installPlanFor(process.platform === 'darwin' ? 'brew' : 'unknown'),
    };
  }
  let values = {};
  try { values = parseOsRelease(await fs.readFile(file, 'utf8')); } catch { /* optional */ }
  const manager = packageManagerFor({ id: values.ID, idLike: values.ID_LIKE, available });
  return {
    id: values.ID || 'linux',
    name: values.PRETTY_NAME || values.NAME || values.ID || 'Linux',
    version: values.VERSION_ID || '',
    idLike: values.ID_LIKE || '',
    manager,
    installPlan: installPlanFor(manager),
  };
}
