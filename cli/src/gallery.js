import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import which from 'which';
import { isTermux } from './platform.js';

const execFileAsync = promisify(execFile);
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR_DIRECTORY = path.join(PACKAGE_ROOT, 'vendor');
const MINIMUM_BINARY_SIZE = 400 * 1024;
const MAX_BINARY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;
const BUILDS_RELEASE_API = 'https://api.github.com/repos/gdl-org/builds/releases/latest';

const GALLERY_HOSTS = [
  'instagram.com',
  'pinterest.com',
  'pin.it',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'fb.watch',
  'threads.net',
  'reddit.com',
  'redd.it',
  'tumblr.com',
  'imgur.com',
  'flickr.com',
  'deviantart.com',
  'pixiv.net',
  'bsky.app',
  'weibo.com',
  'vk.com',
  'mastodon.social',
  '500px.com',
];

function runnerValue(command, prefixArgs = [], displayPath = command, mode = 'executable') {
  return { command, prefixArgs, path: displayPath, displayPath, mode };
}

async function resolveCommand(names) {
  for (const name of names) {
    try {
      return await which(name);
    } catch {
      // Try the next command name.
    }
  }
  return null;
}

async function readVersion(command, args = ['--version']) {
  if (!command) return null;
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      windowsHide: true,
      timeout: 20_000,
      env: process.env,
    });
    return `${stdout || stderr}`.trim().split(/\r?\n/u)[0] || null;
  } catch {
    return null;
  }
}

async function fileStatus(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return {
      valid: stats.isFile() && stats.size >= MINIMUM_BINARY_SIZE,
      fresh: Date.now() - stats.mtimeMs < MAX_BINARY_AGE_MS,
    };
  } catch {
    return { valid: false, fresh: false };
  }
}

export function bundledGalleryDlPath() {
  return path.join(VENDOR_DIRECTORY, process.platform === 'win32' ? 'gallery-dl.exe' : 'gallery-dl');
}

function assetScore(name) {
  const lower = name.toLowerCase();
  let score = 0;

  if (process.platform === 'win32') {
    if (!lower.endsWith('.exe')) return -1;
    if (lower === 'gallery-dl.exe') score += 100;
    if (lower.includes('gallery-dl')) score += 30;
    if (process.arch === 'x64' && /(x64|amd64|win64)/u.test(lower)) score += 20;
    if (process.arch === 'arm64' && /(arm64|aarch64)/u.test(lower)) score += 25;
    if (/(x86|32bit|win32)/u.test(lower)) score -= 10;
    return score;
  }

  if (process.platform === 'linux') {
    if (!/(gallery-dl|gallery_dl)/u.test(lower)) return -1;
    if (lower === 'gallery-dl.bin') score += 100;
    if (/\.(bin|appimage)$/u.test(lower) || !lower.includes('.')) score += 30;
    if (process.arch === 'x64' && /(x64|amd64|linux64)/u.test(lower)) score += 20;
    if (process.arch === 'arm64' && /(arm64|aarch64)/u.test(lower)) score += 25;
    if (process.arch === 'arm' && /(armv7|armhf)/u.test(lower)) score += 25;
    if (/(sha|sig|txt|json|zip|tar|whl)/u.test(lower)) score -= 100;
    return score;
  }

  return -1;
}

async function latestStandaloneAsset() {
  const response = await fetch(BUILDS_RELEASE_API, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'ytconv-gallery-installer',
    },
  });
  if (!response.ok) throw new Error(`GitHub release API HTTP ${response.status}`);
  const release = await response.json();
  const assets = Array.isArray(release.assets) ? release.assets : [];
  return assets
    .map((asset) => ({ ...asset, score: assetScore(String(asset.name || '')) }))
    .filter((asset) => asset.score >= 0 && asset.browser_download_url)
    .sort((left, right) => right.score - left.score)[0] ?? null;
}

async function downloadFile(url, destination, { silent = false } = {}) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.download`;
  await fs.rm(temporary, { force: true });

  if (!silent) console.log('YTConv: downloading gallery-dl image engine...');
  let data = null;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          accept: 'application/octet-stream',
          'user-agent': 'ytconv-gallery-installer',
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
  if (!data) throw new Error(`gallery-dl gagal setelah 3 percobaan (${lastError?.message || 'unknown error'})`);

  await fs.writeFile(temporary, data);
  if (process.platform !== 'win32') await fs.chmod(temporary, 0o755);
  await fs.rm(destination, { force: true });
  await fs.rename(temporary, destination);
  if (!silent) console.log('YTConv: gallery-dl is ready.');
  return destination;
}

export async function ensureBundledGalleryDl({ force = false, silent = false } = {}) {
  if (isTermux()) {
    throw new Error('Termux menjalankan gallery-dl melalui modul Python.');
  }
  if (!['win32', 'linux'].includes(process.platform)) {
    throw new Error('Standalone gallery-dl tersedia otomatis untuk Windows dan Linux.');
  }

  const destination = bundledGalleryDlPath();
  const existing = await fileStatus(destination);
  if (!force && existing.valid && existing.fresh) return destination;

  const errors = [];
  try {
    const asset = await latestStandaloneAsset();
    if (asset) {
      try {
        return await downloadFile(asset.browser_download_url, destination, { silent });
      } catch (error) {
        errors.push(`aset GitHub API: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    errors.push(`GitHub Release API: ${error instanceof Error ? error.message : String(error)}`);
  }

  const fallbackName = process.platform === 'win32' ? 'gallery-dl.exe' : 'gallery-dl.bin';
  const fallbackUrl = `https://github.com/gdl-org/builds/releases/latest/download/${fallbackName}`;
  try {
    return await downloadFile(fallbackUrl, destination, { silent });
  } catch (error) {
    errors.push(`URL release langsung: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (existing.valid) {
    if (!silent) console.warn(`YTConv: memakai gallery-dl lama karena update gagal. ${errors.join('; ')}`);
    return destination;
  }
  throw new Error(`gallery-dl tidak dapat diunduh. ${errors.join('; ')}`);
}

async function resolvePythonModuleRunner() {
  const candidates = [
    { names: ['python'], prefix: ['-m', 'gallery_dl'] },
    { names: ['python3'], prefix: ['-m', 'gallery_dl'] },
    { names: ['py'], prefix: ['-3', '-m', 'gallery_dl'] },
  ];

  for (const candidate of candidates) {
    const command = await resolveCommand(candidate.names);
    if (!command) continue;
    const version = await readVersion(command, [...candidate.prefix, '--version']);
    if (version) {
      return {
        ...runnerValue(command, candidate.prefix, `${command} ${candidate.prefix.join(' ')}`, 'python-module'),
        version,
      };
    }
  }
  return null;
}

export async function installGalleryDlPython({ visible = false } = {}) {
  const candidates = [
    { names: ['python'], prefix: [] },
    { names: ['python3'], prefix: [] },
    { names: ['py'], prefix: ['-3'] },
  ];

  for (const candidate of candidates) {
    const command = await resolveCommand(candidate.names);
    if (!command) continue;
    const args = [
      ...candidate.prefix,
      '-m',
      'pip',
      'install',
      '--upgrade',
      '--no-cache-dir',
      'gallery-dl',
    ];
    const result = spawnSync(command, args, {
      stdio: visible ? 'inherit' : 'ignore',
      windowsHide: true,
      env: process.env,
    });
    if (!result.error && result.status === 0) return resolvePythonModuleRunner();
  }
  return null;
}

export async function resolveGalleryDlRunner({ install = false, silent = true } = {}) {
  const system = await resolveCommand(['gallery-dl', 'gallery-dl.exe']);
  const systemVersion = await readVersion(system);
  if (system && systemVersion) {
    return { ...runnerValue(system), version: systemVersion };
  }

  const pythonRunner = await resolvePythonModuleRunner();
  if (pythonRunner) return pythonRunner;

  if (!isTermux()) {
    const bundled = bundledGalleryDlPath();
    const bundledVersion = await readVersion(bundled);
    if (bundledVersion) {
      return { ...runnerValue(bundled, [], bundled, 'bundled'), version: bundledVersion };
    }
  }

  if (!install) return null;

  if (!isTermux() && ['win32', 'linux'].includes(process.platform)) {
    try {
      const bundled = await ensureBundledGalleryDl({ silent });
      const version = await readVersion(bundled);
      if (version) return { ...runnerValue(bundled, [], bundled, 'bundled'), version };
    } catch {
      // Fall through to Python installation.
    }
  }

  return installGalleryDlPython({ visible: !silent });
}

export function isGalleryPreferredUrl(url) {
  if (process.env.YTCONV_FORCE_GALLERY === '1') return true;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./u, '');
    return GALLERY_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
  } catch {
    return false;
  }
}

function platformLabel(url) {
  const value = String(url).toLowerCase();
  const labels = [
    ['instagram', 'Instagram'],
    ['pinterest', 'Pinterest'],
    ['pin.it', 'Pinterest'],
    ['tiktok', 'TikTok'],
    ['twitter', 'X / Twitter'],
    ['x.com', 'X / Twitter'],
    ['facebook', 'Facebook'],
    ['threads', 'Threads'],
    ['reddit', 'Reddit'],
    ['tumblr', 'Tumblr'],
    ['imgur', 'Imgur'],
    ['flickr', 'Flickr'],
    ['deviantart', 'DeviantArt'],
    ['pixiv', 'Pixiv'],
    ['bsky', 'Bluesky'],
  ];
  return labels.find(([needle]) => value.includes(needle))?.[1] ?? 'Media gallery';
}

function galleryCookieArgs(config) {
  if (!config || config.kind === 'none') return [];
  if (config.kind === 'file') return ['--cookies', config.path];
  if (config.kind === 'browser') return ['--cookies-from-browser', config.spec];
  return [];
}

function normalizeRunner(value) {
  const command = value?.command || value?.path;
  if (!command) throw new Error('gallery-dl belum tersedia.');
  return {
    command,
    prefixArgs: Array.isArray(value.prefixArgs) ? value.prefixArgs : [],
    displayPath: value.displayPath || value.path || command,
  };
}

function spawnRunner(runnerValue, args, options = {}) {
  const runner = normalizeRunner(runnerValue);
  return {
    runner,
    child: spawn(runner.command, [...runner.prefixArgs, ...args], options),
  };
}

function commonGalleryArgs({ cookieConfig, outputDirectory, simulate = false } = {}) {
  const include = process.env.YTCONV_GALLERY_INCLUDE?.trim();
  const args = [
    '--config-ignore',
    '--no-colors',
    '--no-input',
    '--retries',
    '10',
    '--http-timeout',
    '30',
    '--windows-filenames',
    '--destination',
    outputDirectory,
    '--option',
    'extractor.instagram.static-videos=false',
    '--option',
    'extractor.instagram.videos=true',
    '--option',
    'extractor.pinterest.stories=true',
    '--option',
    'extractor.pinterest.videos=true',
    '--option',
    'extractor.tiktok.covers=false',
    ...galleryCookieArgs(cookieConfig),
  ];
  if (include) args.push('--option', `extractor.instagram.include=${include}`);
  if (simulate) args.push('--dump-json', '--simulate');
  else args.push('--Print', 'file:ytconv-file:{_path}');
  return args;
}

function galleryError(stderr, fallback) {
  const text = String(stderr || '');
  if (/429|too many requests/iu.test(text)) {
    return 'Situs membatasi terlalu banyak permintaan (429). Tunggu beberapa menit, kurangi concurrency, lalu coba lagi dengan sesi akun resmi bila diperlukan.';
  }
  if (/login|cookies?|authentication|private|not authorized/iu.test(text)) {
    return 'Media memerlukan akun yang sudah login. Jalankan `ytconv login PROVIDER`, lalu ulangi link.';
  }
  if (/unsupported|no suitable extractor|not found/iu.test(text)) {
    return 'Link gambar/gallery belum didukung atau posting sudah tidak tersedia.';
  }
  const useful = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /error|warning|failed|unsupported|login|cookie|private|429/iu.test(line));
  return useful.at(-1)?.replace(/^\[[^\]]+\]\s*/u, '') || fallback;
}

function runBuffered(runnerValue, args, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const { child, runner } = spawnRunner(runnerValue, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      callback();
    };
    const abort = () => {
      child.kill('SIGTERM');
      finish(() => reject(new Error('Proses dibatalkan.')));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });

    child.stdout.on('data', (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-MAX_OUTPUT_BYTES);
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-MAX_OUTPUT_BYTES);
    });
    child.on('error', (error) => finish(() => reject(new Error(
      `Gagal menjalankan gallery-dl (${runner.displayPath}): ${error.message}`,
    ))));
    child.on('close', (code) => {
      if (code === 0) finish(() => resolve({ stdout, stderr }));
      else finish(() => reject(new Error(galleryError(stderr, `gallery-dl selesai dengan kode ${code}.`))));
    });
  });
}

function metadataFromJsonLines(stdout) {
  const rows = String(stdout || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  const metadata = rows
    .flatMap((row) => (Array.isArray(row) ? row : [row]))
    .find((value) => value && typeof value === 'object' && !Array.isArray(value)) ?? {};
  return { rows, metadata };
}

export async function inspectGallery({ url, cookieConfig, outputDirectory, signal } = {}) {
  const runner = await resolveGalleryDlRunner({ install: true, silent: true });
  if (!runner) throw new Error('Engine gambar gallery-dl tidak dapat disiapkan pada perangkat ini.');

  const args = [...commonGalleryArgs({ cookieConfig, outputDirectory, simulate: true }), url];
  const { stdout } = await runBuffered(runner, args, { signal });
  const { rows, metadata } = metadataFromJsonLines(stdout);
  if (!rows.length) throw new Error('Tidak ada gambar, video, story, atau media gallery yang ditemukan.');

  const title = metadata.title
    || metadata.description
    || metadata.caption
    || metadata.filename
    || `${platformLabel(url)} media`;
  const uploader = metadata.username || metadata.user || metadata.author || metadata.owner || '';
  return {
    title: String(title).replace(/\s+/gu, ' ').trim().slice(0, 180),
    uploader: String(uploader || ''),
    platform: platformLabel(url),
    duration: null,
    itemCount: Math.max(1, rows.length),
    isPlaylist: rows.length > 1,
    originalUrl: url,
    engine: 'gallery-dl',
  };
}

async function listFiles(directory) {
  const files = new Set();
  async function walk(current) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    await Promise.all(entries.map(async (entry) => {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.isFile()) files.add(target);
    }));
  }
  await walk(directory);
  return files;
}

export async function downloadGallery({
  url,
  cookieConfig,
  outputDirectory,
  onProgress,
  onLog,
  signal,
} = {}) {
  const runner = await resolveGalleryDlRunner({ install: true, silent: false });
  if (!runner) throw new Error('Engine gambar gallery-dl tidak dapat disiapkan pada perangkat ini.');

  await fs.mkdir(outputDirectory, { recursive: true });
  const before = await listFiles(outputDirectory);
  const args = [...commonGalleryArgs({ cookieConfig, outputDirectory }), url];

  return new Promise((resolve, reject) => {
    const { child, runner: normalized } = spawnRunner(runner, args, {
      cwd: outputDirectory,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let stderrAll = '';
    let downloadedCount = 0;
    let outputPath = '';
    let settled = false;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      callback();
    };
    const abort = () => {
      child.kill('SIGTERM');
      finish(() => reject(new Error('Unduhan dibatalkan.')));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });

    const processLine = (line, isError = false) => {
      const clean = line.trim();
      if (!clean) return;
      if (clean.startsWith('ytconv-file:')) {
        outputPath = clean.slice('ytconv-file:'.length).trim();
        downloadedCount += 1;
        onProgress?.({
          percent: `${Math.min(95, 5 + downloadedCount * 7)}%`,
          speed: `${downloadedCount} file`,
          eta: '',
        });
        onLog?.(`Tersimpan: ${outputPath}`, false);
        return;
      }
      onLog?.(clean, isError);
    };

    const consume = (chunk, isError) => {
      const text = chunk.toString();
      if (isError) stderrAll = `${stderrAll}${text}`.slice(-MAX_OUTPUT_BYTES);
      const previous = isError ? stderrBuffer : stdoutBuffer;
      const lines = `${previous}${text}`.split(/\r?\n/u);
      const rest = lines.pop() ?? '';
      if (isError) stderrBuffer = rest;
      else stdoutBuffer = rest;
      for (const line of lines) processLine(line, isError);
    };

    child.stdout.on('data', (chunk) => consume(chunk, false));
    child.stderr.on('data', (chunk) => consume(chunk, true));
    child.on('error', (error) => finish(() => reject(new Error(
      `Gagal menjalankan gallery-dl (${normalized.displayPath}): ${error.message}`,
    ))));
    child.on('close', async (code) => {
      if (settled) return;
      processLine(stdoutBuffer, false);
      processLine(stderrBuffer, true);
      if (code !== 0) {
        finish(() => reject(new Error(galleryError(stderrAll, `gallery-dl selesai dengan kode ${code}.`))));
        return;
      }

      const after = await listFiles(outputDirectory);
      const created = [...after].filter((filePath) => !before.has(filePath));
      if (!outputPath && created.length) outputPath = created.at(-1);
      const count = Math.max(downloadedCount, created.length);
      onProgress?.({ percent: '100%', speed: `${count || 1} file`, eta: '' });
      finish(() => resolve({
        outputPath: outputPath || outputDirectory,
        fileCount: count,
        engine: 'gallery-dl',
      }));
    });
  });
}
