import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_DIRECTORY = path.join(PACKAGE_ROOT, 'vendor');
const MINIMUM_BINARY_SIZE = 1024 * 1024;

function releaseAsset() {
  const key = `${process.platform}-${process.arch}`;
  const assets = {
    'win32-x64': 'yt-dlp.exe',
    'win32-arm64': 'yt-dlp_arm64.exe',
    'darwin-x64': 'yt-dlp_macos',
    'darwin-arm64': 'yt-dlp_macos',
    'linux-x64': 'yt-dlp_linux',
    'linux-arm64': 'yt-dlp_linux_aarch64',
    'linux-arm': 'yt-dlp_linux_armv7l',
  };

  return assets[key] ?? null;
}

export function bundledYtDlpPath() {
  return path.join(VENDOR_DIRECTORY, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
}

async function binaryLooksValid(binaryPath) {
  try {
    const stats = await fs.stat(binaryPath);
    return stats.isFile() && stats.size >= MINIMUM_BINARY_SIZE;
  } catch {
    return false;
  }
}

export async function ensureBundledYtDlp({ force = false, silent = false } = {}) {
  const asset = releaseAsset();
  if (!asset) {
    throw new Error(`Platform ${process.platform}/${process.arch} belum didukung oleh paket YTConv.`);
  }

  const destination = bundledYtDlpPath();
  if (!force && await binaryLooksValid(destination)) return destination;

  await fs.mkdir(VENDOR_DIRECTORY, { recursive: true });
  const temporary = `${destination}.download`;
  await fs.rm(temporary, { force: true });

  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
  if (!silent) console.log(`YTConv: downloading ${asset}...`);

  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'ytconv-npm-installer',
      accept: 'application/octet-stream',
    },
  });

  if (!response.ok) {
    throw new Error(`Gagal mengunduh yt-dlp (${response.status} ${response.statusText}).`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  if (data.length < MINIMUM_BINARY_SIZE) {
    throw new Error('File yt-dlp yang diterima tidak valid atau tidak lengkap.');
  }

  await fs.writeFile(temporary, data);
  if (process.platform !== 'win32') await fs.chmod(temporary, 0o755);
  await fs.rm(destination, { force: true });
  await fs.rename(temporary, destination);

  if (!silent) console.log('YTConv: yt-dlp is ready.');
  return destination;
}
