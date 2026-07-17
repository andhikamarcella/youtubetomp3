import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  desktopDownloadsDirectory,
  isTermux,
  termuxSharedDownloadsDirectory,
} from './platform.js';

const DESKTOP_BROWSERS = [
  'chrome',
  'edge',
  'firefox',
  'brave',
  'chromium',
  'opera',
  'vivaldi',
  'safari',
  'whale',
];

async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

function resolveCandidate(candidate) {
  if (!candidate) return null;
  return path.resolve(candidate.replace(/^~(?=$|[\\/])/u, os.homedir()));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function cookieSourcesForPlatform(termux = isTermux()) {
  return termux ? ['none', 'file'] : ['none', 'file', ...DESKTOP_BROWSERS];
}

export function cookieSourceLabel(source) {
  if (!source || source === 'none') return 'off';
  if (source === 'file') return 'cookies.txt';
  return source;
}

export function cookieArgs(config) {
  if (!config || config.kind === 'none') return [];
  if (config.kind === 'file') return ['--cookies', config.path];
  if (config.kind === 'browser') return ['--cookies-from-browser', config.spec];
  return [];
}

export function cookieFileCandidates({ outputDirectory } = {}) {
  const termuxDownloads = path.dirname(termuxSharedDownloadsDirectory());
  return unique([
    resolveCandidate(process.env.YTCONV_COOKIES),
    resolveCandidate(path.join(process.cwd(), 'cookies.txt')),
    resolveCandidate(outputDirectory ? path.join(outputDirectory, 'cookies.txt') : null),
    resolveCandidate(path.join(desktopDownloadsDirectory(), 'cookies.txt')),
    resolveCandidate(isTermux() ? path.join(termuxDownloads, 'cookies.txt') : null),
    resolveCandidate(isTermux() ? path.join(termuxSharedDownloadsDirectory(), 'cookies.txt') : null),
    resolveCandidate(path.join(os.homedir(), 'cookies.txt')),
  ]);
}

export async function resolveCookieConfig({ source = 'none', outputDirectory } = {}) {
  if (!source || source === 'none') {
    return { kind: 'none', label: 'off' };
  }

  if (source === 'file') {
    const candidates = cookieFileCandidates({ outputDirectory });
    for (const candidate of candidates) {
      if (await fileExists(candidate)) {
        return {
          kind: 'file',
          path: candidate,
          label: `file:${path.basename(candidate)}`,
        };
      }
    }

    const suggested = isTermux()
      ? path.join(termuxSharedDownloadsDirectory(), 'cookies.txt')
      : path.join(desktopDownloadsDirectory(), 'cookies.txt');

    throw new Error(
      `cookies.txt tidak ditemukan. Simpan file Netscape cookies di "${suggested}" `
      + 'atau set environment variable YTCONV_COOKIES ke lokasi file.',
    );
  }

  if (isTermux()) {
    throw new Error(
      'Termux tidak dapat membaca cookies langsung dari aplikasi browser Android. '
      + 'Pilih cookies.txt dan simpan file Netscape cookies di folder Download/YTConv.',
    );
  }

  if (!DESKTOP_BROWSERS.includes(source)) {
    throw new Error(`Browser cookies "${source}" tidak dikenali.`);
  }

  const profile = process.env.YTCONV_BROWSER_PROFILE?.trim();
  const spec = profile ? `${source}:${profile}` : source;
  return {
    kind: 'browser',
    browser: source,
    spec,
    label: profile ? `${source}:${profile}` : source,
  };
}
