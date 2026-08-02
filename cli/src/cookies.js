import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  desktopDownloadsDirectory,
  isTermux,
  termuxSharedDownloadsDirectory,
} from './platform.js';
import { socialSessionForUrl } from './social-sessions.js';

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

async function directoryExists(directory) {
  if (!directory) return false;
  try {
    const stats = await fs.stat(directory);
    return stats.isDirectory();
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
  return termux ? ['auto', 'none', 'file'] : ['auto', 'none', 'file', ...DESKTOP_BROWSERS];
}

export function cookieSourceLabel(source) {
  if (!source || source === 'none') return 'off';
  if (source === 'auto') return 'AUTO publik + akun browser';
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
    resolveCandidate(path.join(desktopDownloadsDirectory(), 'YTConv', 'cookies.txt')),
    resolveCandidate(isTermux() ? path.join(termuxDownloads, 'cookies.txt') : null),
    resolveCandidate(isTermux() ? path.join(termuxSharedDownloadsDirectory(), 'cookies.txt') : null),
    resolveCandidate(isTermux() ? path.join(os.homedir(), 'storage', 'shared', 'cookies.txt') : null),
    resolveCandidate(isTermux() ? path.join(os.homedir(), 'storage', 'shared', 'Download', 'cookies.txt') : null),
    resolveCandidate(path.join(os.homedir(), 'cookies.txt')),
  ]);
}

function browserDataCandidates() {
  const home = os.homedir();
  const local = process.env.LOCALAPPDATA;
  const roaming = process.env.APPDATA;

  if (process.platform === 'win32') {
    return {
      chrome: [local && path.join(local, 'Google', 'Chrome', 'User Data')],
      edge: [local && path.join(local, 'Microsoft', 'Edge', 'User Data')],
      brave: [local && path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data')],
      chromium: [local && path.join(local, 'Chromium', 'User Data')],
      firefox: [roaming && path.join(roaming, 'Mozilla', 'Firefox', 'Profiles')],
      opera: [roaming && path.join(roaming, 'Opera Software')],
      vivaldi: [local && path.join(local, 'Vivaldi', 'User Data')],
      whale: [local && path.join(local, 'Naver', 'Naver Whale', 'User Data')],
      safari: [],
    };
  }

  if (process.platform === 'darwin') {
    const support = path.join(home, 'Library', 'Application Support');
    return {
      chrome: [path.join(support, 'Google', 'Chrome')],
      edge: [path.join(support, 'Microsoft Edge')],
      brave: [path.join(support, 'BraveSoftware', 'Brave-Browser')],
      chromium: [path.join(support, 'Chromium')],
      firefox: [path.join(support, 'Firefox', 'Profiles')],
      opera: [path.join(support, 'com.operasoftware.Opera')],
      vivaldi: [path.join(support, 'Vivaldi')],
      safari: [path.join(home, 'Library', 'Cookies')],
      whale: [path.join(support, 'Naver', 'Whale')],
    };
  }

  return {
    chrome: [path.join(home, '.config', 'google-chrome')],
    edge: [path.join(home, '.config', 'microsoft-edge')],
    brave: [path.join(home, '.config', 'BraveSoftware', 'Brave-Browser')],
    chromium: [path.join(home, '.config', 'chromium')],
    firefox: [path.join(home, '.mozilla', 'firefox')],
    opera: [path.join(home, '.config', 'opera')],
    vivaldi: [path.join(home, '.config', 'vivaldi')],
    whale: [path.join(home, '.config', 'naver-whale')],
    safari: [],
  };
}

export async function detectSystemBrowsers() {
  if (isTermux()) return [];
  const candidates = browserDataCandidates();
  const preferred = process.env.YTCONV_BROWSER?.trim().toLowerCase();
  const order = unique([preferred, ...DESKTOP_BROWSERS]);
  const detected = [];

  for (const browser of order) {
    const directories = candidates[browser] || [];
    for (const directory of directories) {
      if (await directoryExists(directory)) {
        detected.push(browser);
        break;
      }
    }
  }

  return detected;
}

function browserConfig(source) {
  const profile = process.env.YTCONV_BROWSER_PROFILE?.trim();
  const spec = profile ? `${source}:${profile}` : source;
  return {
    kind: 'browser',
    browser: source,
    spec,
    label: profile ? `${source}:${profile}` : source,
  };
}

function linkedBrowserConfig(session) {
  const spec = session.browserSpec;
  return {
    kind: 'browser',
    browser: spec.split(':', 1)[0],
    spec,
    provider: session.provider,
    linked: true,
    label: `akun ${session.label || session.provider} · ${spec}`,
  };
}

async function firstCookieFile({ outputDirectory } = {}) {
  for (const candidate of cookieFileCandidates({ outputDirectory })) {
    if (await fileExists(candidate)) {
      return {
        kind: 'file',
        path: candidate,
        label: `file:${path.basename(candidate)}`,
      };
    }
  }
  return null;
}

export async function resolveCookieConfigs({ source = 'auto', outputDirectory, url = '', homeDirectory } = {}) {
  if (!source || source === 'none') return [{ kind: 'none', label: 'akses publik' }];

  if (source === 'auto') {
    const configs = [{ kind: 'none', label: 'akses publik' }];
    const linked = url ? await socialSessionForUrl(url, { homeDirectory }) : null;
    if (linked) configs.push(linkedBrowserConfig(linked));
    const file = await firstCookieFile({ outputDirectory });
    if (file) configs.push(file);

    if (!isTermux()) {
      const browsers = await detectSystemBrowsers();
      const existingSpecs = new Set(configs.filter((item) => item.kind === 'browser').map((item) => item.spec));
      configs.push(...browsers.slice(0, 4).map(browserConfig).filter((item) => !existingSpecs.has(item.spec)));
    }

    return configs;
  }

  if (source === 'file') {
    const file = await firstCookieFile({ outputDirectory });
    if (file) return [file];

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
      'Android memisahkan data browser dari Termux. YTConv dapat mendeteksi cookies.txt '
      + 'di penyimpanan bersama, tetapi tidak dapat mengambil database privat Chrome Android secara langsung.',
    );
  }

  if (!DESKTOP_BROWSERS.includes(source)) {
    throw new Error(`Browser cookies "${source}" tidak dikenali.`);
  }

  return [browserConfig(source)];
}

export async function resolveCookieConfig(options = {}) {
  const configs = await resolveCookieConfigs(options);
  return configs.find((config) => config.kind !== 'none') || configs[0];
}
