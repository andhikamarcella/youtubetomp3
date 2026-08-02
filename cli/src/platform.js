import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

export function isTermux() {
  const prefix = process.env.PREFIX ?? '';
  const home = process.env.HOME ?? '';

  return process.platform === 'android'
    || Boolean(process.env.TERMUX_VERSION)
    || prefix.includes('com.termux')
    || home.includes('com.termux');
}

export function termuxSharedDownloadsDirectory() {
  return path.join(os.homedir(), 'storage', 'downloads', 'YTConv');
}

export function desktopDownloadsDirectory() {
  return path.join(os.homedir(), 'Downloads');
}
