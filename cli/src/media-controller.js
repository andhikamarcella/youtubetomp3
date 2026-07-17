import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  downloadMedia as downloadWithEngines,
  inspectMedia as inspectWithEngines,
} from './downloader.js';

const STATIC_IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.heic',
  '.jpeg',
  '.jpg',
  '.png',
  '.tif',
  '.tiff',
  '.webp',
]);

const GALLERY_HOSTS = new Set([
  'instagram.com',
  'pinterest.com',
  'pin.it',
  'imgur.com',
  'flickr.com',
  'deviantart.com',
  'pixiv.net',
  'bsky.app',
]);

function normalizedHost(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./u, '');
  } catch {
    return '';
  }
}

export function cleanMediaUrl(value) {
  try {
    const parsed = new URL(value);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|igsh$|fbclid$|si$)/iu.test(key)) parsed.searchParams.delete(key);
    }
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return String(value ?? '').trim();
  }
}

export function instagramMediaKind(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase().replace(/^www\./u, '');
    if (host !== 'instagram.com' && !host.endsWith('.instagram.com')) return '';
    const pathname = parsed.pathname.toLowerCase();
    if (/^\/(reel|reels|tv)\//u.test(pathname)) return 'video';
    if (/^\/p\//u.test(pathname)) return 'post';
    if (/^\/stories\//u.test(pathname)) return 'story';
    return 'profile';
  } catch {
    return '';
  }
}

export function effectiveMediaMode({ url, mode = 'auto' } = {}) {
  if (['video', 'audio', 'image'].includes(mode)) return mode;
  const instagramKind = instagramMediaKind(url);
  if (instagramKind === 'video') return 'video';
  if (instagramKind === 'post' || instagramKind === 'story') return 'image';
  if (process.env.YTCONV_GALLERY_INCLUDE) return 'image';
  const host = normalizedHost(url);
  if (GALLERY_HOSTS.has(host) && host !== 'instagram.com') return 'image';
  return 'auto';
}

function restoreEnvironment(previous) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function withEngineMode(mode, callback) {
  const previous = {
    YTCONV_FORCE_GALLERY: process.env.YTCONV_FORCE_GALLERY,
    YTCONV_FORCE_VIDEO: process.env.YTCONV_FORCE_VIDEO,
  };

  if (mode === 'image') {
    process.env.YTCONV_FORCE_GALLERY = '1';
    delete process.env.YTCONV_FORCE_VIDEO;
  } else if (mode === 'video' || mode === 'audio') {
    process.env.YTCONV_FORCE_VIDEO = '1';
    delete process.env.YTCONV_FORCE_GALLERY;
  } else {
    delete process.env.YTCONV_FORCE_VIDEO;
    delete process.env.YTCONV_FORCE_GALLERY;
  }

  try {
    return await callback();
  } finally {
    restoreEnvironment(previous);
  }
}

function genericGalleryMetadata(url) {
  const kind = instagramMediaKind(url);
  let title = 'Media gambar / carousel';
  if (kind === 'post') title = 'Instagram post / carousel';
  else if (kind === 'story') title = 'Instagram Story';
  else if (kind === 'profile') title = 'Instagram profile media';
  else if (normalizedHost(url).includes('pinterest')) title = 'Pinterest image / pin';

  return {
    title,
    uploader: '',
    platform: normalizedHost(url).includes('instagram') ? 'Instagram' : 'Media gallery',
    duration: null,
    itemCount: 1,
    isPlaylist: false,
    originalUrl: url,
    engine: 'gallery-dl',
  };
}

export async function inspectMedia(options) {
  const url = cleanMediaUrl(options.url);
  const mode = effectiveMediaMode({ url, mode: options.mode });

  // gallery-dl's simulated JSON probe can return no rows for Instagram even
  // though a real download succeeds. Use a generic card and let the actual
  // download be the source of truth for image/carousel links.
  if (mode === 'image') return genericGalleryMetadata(url);

  return withEngineMode(mode, () => inspectWithEngines({ ...options, url }));
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

function runFfmpeg(ffmpegPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: process.env,
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-32_000);
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim().split(/\r?\n/u).at(-1) || `FFmpeg exit ${code}`));
    });
  });
}

async function availableTarget(source, format) {
  const parsed = path.parse(source);
  let target = path.join(parsed.dir, `${parsed.name}.${format}`);
  if (target.toLowerCase() === source.toLowerCase()) return source;
  try {
    await fs.access(target);
    target = path.join(parsed.dir, `${parsed.name}.ytconv.${format}`);
  } catch {
    // Target does not exist and is safe to use.
  }
  return target;
}

async function convertImages({ files, format, ffmpegPath, onLog, onProgress }) {
  if (!format || format === 'original') return files;
  if (!ffmpegPath) throw new Error('FFmpeg diperlukan untuk mengubah format gambar.');

  const imageFiles = files.filter((file) => STATIC_IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  if (!imageFiles.length) return files;

  const replacements = new Map();
  for (let index = 0; index < imageFiles.length; index += 1) {
    const source = imageFiles[index];
    const target = await availableTarget(source, format);
    if (target === source) {
      replacements.set(source, source);
      continue;
    }

    onLog?.(`Mengubah gambar ${index + 1}/${imageFiles.length} ke ${format.toUpperCase()}...`, false);
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-frames:v', '1'];
    if (format === 'jpg') args.push('-q:v', '2');
    args.push(target);
    await runFfmpeg(ffmpegPath, args);
    await fs.rm(source, { force: true });
    replacements.set(source, target);
    onProgress?.({
      percent: `${Math.min(99, 90 + Math.round(((index + 1) / imageFiles.length) * 9))}%`,
      speed: `${index + 1}/${imageFiles.length} gambar`,
      eta: '',
    });
  }

  return files.map((file) => replacements.get(file) || file);
}

function instagramAccessHint({ cookieConfig, originalError }) {
  const cookieLabel = cookieConfig?.kind === 'browser'
    ? 'Cookies browser belum dapat dibaca dengan benar. Coba tutup Chrome sepenuhnya atau gunakan cookies.txt Netscape.'
    : 'Instagram sering meminta login. Aktifkan cookies Chrome/Edge/Firefox atau gunakan cookies.txt Netscape.';
  return `${originalError} ${cookieLabel}`;
}

export async function downloadMedia({ options, ...rest }) {
  const url = cleanMediaUrl(options.url);
  const mode = effectiveMediaMode({ url, mode: options.mode });
  const outputDirectory = options.outputDirectory;
  const before = await listFiles(outputDirectory);

  let result;
  try {
    result = await withEngineMode(mode, () => downloadWithEngines({
      ...rest,
      options: { ...options, url, mode: mode === 'auto' ? 'video' : mode },
    }));
  } catch (error) {
    if (instagramMediaKind(url)) {
      throw new Error(instagramAccessHint({
        cookieConfig: options.cookieConfig,
        originalError: error instanceof Error ? error.message : String(error),
      }));
    }
    throw error;
  }

  const after = await listFiles(outputDirectory);
  let created = [...after].filter((file) => !before.has(file));
  if (result.engine === 'gallery-dl' && !created.length) {
    throw new Error(instagramMediaKind(url)
      ? instagramAccessHint({
        cookieConfig: options.cookieConfig,
        originalError: 'Instagram tidak mengembalikan file dari link tersebut.',
      })
      : 'Tidak ada file gambar atau media gallery yang berhasil diunduh.');
  }

  if (result.engine === 'gallery-dl') {
    created = await convertImages({
      files: created,
      format: options.imageFormat,
      ffmpegPath: options.ffmpegPath,
      onLog: rest.onLog,
      onProgress: rest.onProgress,
    });
  }

  return {
    ...result,
    outputPath: created.at(-1) || result.outputPath,
    outputPaths: created,
    fileCount: created.length || result.fileCount || 1,
  };
}
