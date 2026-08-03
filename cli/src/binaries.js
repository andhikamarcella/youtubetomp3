import process from 'node:process';
import { engineFileStatus, enginePath } from './engine-storage.js';
import { isTermux } from './platform.js';
import { downloadVerifiedGitHubAsset } from './verified-download.js';

const YT_DLP_REPOSITORY = 'yt-dlp/yt-dlp';
const MINIMUM_BINARY_SIZE = 1024 * 1024;

export function ytDlpReleaseAsset({ platform = process.platform, architecture = process.arch } = {}) {
  const assets = {
    'win32-x64': 'yt-dlp.exe',
    'win32-arm64': 'yt-dlp_arm64.exe',
    'darwin-x64': 'yt-dlp_macos',
    'darwin-arm64': 'yt-dlp_macos',
    'linux-x64': 'yt-dlp_linux',
    'linux-arm64': 'yt-dlp_linux_aarch64',
  };
  return assets[`${platform}-${architecture}`] ?? null;
}

export function bundledYtDlpPath(options = {}) {
  return enginePath(process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp', options);
}

export async function ensureBundledYtDlp({
  force = false,
  silent = false,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (isTermux()) {
    throw new Error('Termux uses the native Python yt-dlp package for Android compatibility.');
  }

  const asset = ytDlpReleaseAsset();
  if (!asset) {
    throw new Error(`No official standalone yt-dlp executable is available for ${process.platform}/${process.arch}; YTConv will try Python instead.`);
  }

  const destination = bundledYtDlpPath();
  const existing = await engineFileStatus(destination, { minimumBytes: MINIMUM_BINARY_SIZE });
  if (!force && existing.valid && existing.fresh) return destination;

  try {
    await downloadVerifiedGitHubAsset({
      repository: YT_DLP_REPOSITORY,
      release: 'latest',
      assetName: asset,
      destination,
      minimumBytes: MINIMUM_BINARY_SIZE,
      fetchImpl,
      silent,
    });
    return destination;
  } catch (error) {
    if (existing.valid) {
      if (!silent) console.warn(`YTConv: the verified yt-dlp update failed; using the existing engine. ${error.message}`);
      return destination;
    }
    throw error;
  }
}
