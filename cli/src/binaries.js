import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { isTermux } from './platform.js';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_DIRECTORY = path.join(PACKAGE_ROOT, 'vendor');
const MINIMUM_BINARY_SIZE = 1024 * 1024;
const MAX_BINARY_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function releaseAsset() {
  if (isTermux()) return null;

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

async function binaryStatus(binaryPath) {
  try {
    const stats = await fs.stat(binaryPath);
    return {
      valid: stats.isFile() && stats.size >= MINIMUM_BINARY_SIZE,
      fresh: Date.now() - stats.mtimeMs < MAX_BINARY_AGE_MS,
    };
  } catch {
    return { valid: false, fresh: false };
  }
}

async function downloadLatest(asset, destination, { silent }) {
  await fs.mkdir(VENDOR_DIRECTORY, { recursive: true });
  const temporary = `${destination}.download`;
  await fs.rm(temporary, { force: true });

  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
  if (!silent) console.log(`YTConv: downloading ${asset}...`);

  let data = null;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'user-agent': 'ytconv-npm-installer',
          accept: 'application/octet-stream',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const candidate = Buffer.from(await response.arrayBuffer());
      if (candidate.length < MINIMUM_BINARY_SIZE) throw new Error('file tidak lengkap');
      data = candidate;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  if (!data) throw new Error(`Gagal mengunduh yt-dlp setelah 3 percobaan (${lastError?.message || 'unknown error'}).`);

  await fs.writeFile(temporary, data);
  if (process.platform !== 'win32') await fs.chmod(temporary, 0o755);
  await fs.rm(destination, { force: true });
  await fs.rename(temporary, destination);
  if (!silent) console.log('YTConv: yt-dlp is ready.');
}

export async function ensureBundledYtDlp({ force = false, silent = false } = {}) {
  if (isTermux()) {
    throw new Error('Termux memakai paket native python-yt-dlp agar kompatibel dengan Android.');
  }

  const asset = releaseAsset();
  if (!asset) {
    throw new Error(`Platform ${process.platform}/${process.arch} belum didukung oleh paket YTConv.`);
  }

  const destination = bundledYtDlpPath();
  const existing = await binaryStatus(destination);
  if (!force && existing.valid && existing.fresh) return destination;

  try {
    await downloadLatest(asset, destination, { silent });
    return destination;
  } catch (error) {
    if (existing.valid) {
      if (!silent) {
        console.warn(`YTConv: pembaruan yt-dlp gagal, memakai versi yang sudah ada. ${error.message}`);
      }
      return destination;
    }
    throw error;
  }
}
