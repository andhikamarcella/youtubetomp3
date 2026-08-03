import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  downloadMedia as downloadWithEngines,
  inspectMedia as inspectWithEngines,
} from './downloader.js';
import {
  detectSocialPlatform,
  socialPlatformLabel,
  socialRouteMode,
  validatePlatformHint,
} from './social-platforms.js';
import { socialLoginHint } from './social-sessions.js';
import { monochromeChildEnvironment, sanitizeTerminalText } from './terminal-style.js';

const STATIC_IMAGE_EXTENSIONS = new Set([
  '.avif', '.bmp', '.gif', '.heic', '.jpeg', '.jpg', '.png', '.tif', '.tiff', '.webp',
]);
const AUDIO_OUTPUT_EXTENSIONS = new Set([
  '.aac', '.alac', '.flac', '.m4a', '.mp3', '.oga', '.ogg', '.opus', '.vorbis', '.wav',
]);
const VIDEO_OUTPUT_EXTENSIONS = new Set([
  '.3gp', '.avi', '.flv', '.m4v', '.mkv', '.mov', '.mp4', '.mpeg', '.mpg', '.ts', '.webm',
]);
const SUBTITLE_OUTPUT_EXTENSIONS = new Set([
  '.ass', '.lrc', '.srt', '.ssa', '.ttml', '.vtt',
]);

export function cleanMediaUrl(value) {
  try {
    const parsed = new URL(value);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|igsh$|fbclid$|si$|share_id$|share_app_id$)/iu.test(key)) {
        parsed.searchParams.delete(key);
      }
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

export function effectiveMediaMode({ url, mode = 'auto', platformHint = 'auto' } = {}) {
  if (process.env.YTCONV_GALLERY_INCLUDE) return 'image';
  return socialRouteMode({ url, requestedMode: mode, platformHint });
}

export function automaticFallbackMode({ requestedMode = 'auto', effectiveMode = 'auto', url = '' } = {}) {
  if (effectiveMode === 'audio') return '';
  const socialPlatform = detectSocialPlatform(url);
  const mixedSocialMedia = ['instagram', 'facebook', 'tiktok', 'x', 'pinterest', 'reddit', 'threads'].includes(socialPlatform);
  if (requestedMode !== 'auto' && !mixedSocialMedia) return '';
  if (effectiveMode === 'image') return 'video';
  if (effectiveMode === 'video') return 'image';
  return 'video';
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

function assertPlatformSelection(url, platformHint) {
  const result = validatePlatformHint({ url, platformHint });
  if (result.valid) return result.detected;
  throw new Error(
    `The URL was detected as ${socialPlatformLabel(result.detected)}, not `
    + `${socialPlatformLabel(platformHint)}. Choose AUTO or the matching platform.`,
  );
}

function genericGalleryMetadata(url) {
  const platformKey = detectSocialPlatform(url);
  const kind = instagramMediaKind(url);
  let title = `${socialPlatformLabel(platformKey)} post`;
  if (kind === 'post') title = 'Instagram post';
  else if (kind === 'story') title = 'Instagram Story';
  else if (kind === 'profile') title = 'Instagram profile media';
  else if (platformKey === 'pinterest') title = 'Pinterest Pin';
  else if (platformKey === 'reddit') title = 'Reddit post';
  else if (platformKey === 'facebook') title = 'Facebook post';
  else if (platformKey === 'tiktok') title = 'TikTok post';
  else if (platformKey === 'x') title = 'X / Twitter post';

  return {
    title,
    uploader: '',
    platform: socialPlatformLabel(platformKey),
    duration: null,
    itemCount: 1,
    isPlaylist: false,
    originalUrl: url,
    engine: 'gallery-dl',
  };
}

export async function inspectMedia(options) {
  const url = cleanMediaUrl(options.url);
  assertPlatformSelection(url, options.platformHint || 'auto');
  const requestedMode = options.mode || 'auto';
  const mode = effectiveMediaMode({
    url,
    mode: requestedMode,
    platformHint: options.platformHint,
  });

  // Some social platforms return no rows during gallery-dl simulation even
  // though the real download works. Let the real download be the source of truth.
  if (mode === 'image') return genericGalleryMetadata(url);

  try {
    return await withEngineMode(mode, () => inspectWithEngines({ ...options, url }));
  } catch (primaryError) {
    const fallbackMode = automaticFallbackMode({
      requestedMode,
      effectiveMode: mode,
      url,
    });
    if (!fallbackMode) throw primaryError;
    if (fallbackMode === 'image') return genericGalleryMetadata(url);
    return withEngineMode(fallbackMode, () => inspectWithEngines({ ...options, url }));
  }
}

async function canonicalPath(target) {
  try {
    return await fs.realpath(target);
  } catch {
    return path.resolve(target);
  }
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
      else if (entry.isFile()) files.add(await canonicalPath(target));
    }));
  }
  await walk(directory);
  return files;
}

function outputKind({ result, completedMode, options }) {
  if (options.subtitleOnly) return 'subtitle';
  if (result?.engine === 'gallery-dl') return 'gallery';
  if (completedMode === 'audio') return 'audio';
  return 'video';
}

function isExpectedOutput(file, kind) {
  const extension = path.extname(file).toLowerCase();
  if (kind === 'audio') return AUDIO_OUTPUT_EXTENSIONS.has(extension);
  if (kind === 'video') return VIDEO_OUTPUT_EXTENSIONS.has(extension);
  if (kind === 'subtitle') return SUBTITLE_OUTPUT_EXTENSIONS.has(extension);
  if (kind === 'gallery') return STATIC_IMAGE_EXTENSIONS.has(extension) || VIDEO_OUTPUT_EXTENSIONS.has(extension);
  return false;
}

async function verifiedReportedPaths(result, outputDirectory, kind) {
  const candidates = [
    ...(Array.isArray(result?.outputPaths) ? result.outputPaths : []),
    result?.outputPath,
  ].filter(Boolean);
  const verified = [];
  for (const candidate of candidates) {
    const resolved = path.isAbsolute(candidate) ? candidate : path.join(outputDirectory, candidate);
    if (!isExpectedOutput(resolved, kind)) continue;
    try {
      const stats = await fs.stat(resolved);
      if (stats.isFile() && stats.size > 0) verified.push(await canonicalPath(resolved));
    } catch {
      // A printed path is not a result until it exists on disk.
    }
  }
  return verified;
}

async function producedFiles({ before, after, result, outputDirectory, kind }) {
  const created = [...after]
    .filter((file) => !before.has(file))
    .filter((file) => isExpectedOutput(file, kind));
  const reported = await verifiedReportedPaths(result, outputDirectory, kind);
  return [...new Set([...created, ...reported])];
}

function runFfmpeg(ffmpegPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: monochromeChildEnvironment(process.env),
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-32_000);
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(sanitizeTerminalText(stderr).trim().split(/\r?\n/u).at(-1) || `FFmpeg exit ${code}`));
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
  if (!ffmpegPath) throw new Error('FFmpeg is required to convert image formats.');

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

    onLog?.(`Converting image ${index + 1}/${imageFiles.length} to ${format.toUpperCase()}...`, false);
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-frames:v', '1'];
    if (format === 'jpg') args.push('-q:v', '2');
    args.push(target);
    await runFfmpeg(ffmpegPath, args);
    await fs.rm(source, { force: true });
    replacements.set(source, target);
    onProgress?.({
      percent: `${Math.min(99, 90 + Math.round(((index + 1) / imageFiles.length) * 9))}%`,
      speed: `${index + 1}/${imageFiles.length} images`,
      eta: '',
    });
  }

  return files.map((file) => replacements.get(file) || file);
}

function accessHint({ url, cookieConfig, originalError }) {
  const platform = socialPlatformLabel(detectSocialPlatform(url));
  const officialLogin = socialLoginHint(url);
  const browserHint = cookieConfig?.managedBrowser
    ? `The private YTConv browser session was read, but this URL still was not accessible.${officialLogin ? ` Reopen the official login: ${officialLogin}` : ''}`
    : cookieConfig?.kind === 'browser'
      ? `A regular browser session was detected but could not be decrypted. Use the private YTConv login window instead.${officialLogin ? ` Open it with: ${officialLogin}` : ''}`
    : `Public access was attempted.${officialLogin ? ` ${officialLogin}` : ' Run ytconv social help for official login instructions.'}`;
  return `${originalError} ${platform}: ${browserHint}`;
}

async function runDownloadMode({ mode, options, rest, url }) {
  return withEngineMode(mode, () => downloadWithEngines({
    ...rest,
    options: { ...options, url, mode: mode === 'auto' ? 'video' : mode },
  }));
}

export async function downloadMedia({ options, ...rest }) {
  const url = cleanMediaUrl(options.url);
  assertPlatformSelection(url, options.platformHint || 'auto');
  const requestedMode = options.mode || 'auto';
  const mode = effectiveMediaMode({
    url,
    mode: requestedMode,
    platformHint: options.platformHint,
  });
  const outputDirectory = options.outputDirectory;
  const before = await listFiles(outputDirectory);

  let result;
  let completedMode = mode;
  try {
    result = await runDownloadMode({ mode, options, rest, url });
  } catch (primaryError) {
    const fallbackMode = automaticFallbackMode({
      requestedMode,
      effectiveMode: mode,
      url,
    });

    if (!fallbackMode) {
      throw new Error(accessHint({
        url,
        cookieConfig: options.cookieConfig,
        originalError: primaryError instanceof Error ? primaryError.message : String(primaryError),
      }));
    }

    rest.onLog?.(
      `${mode === 'image' ? 'gallery-dl' : 'yt-dlp'} failed; trying `
      + `${fallbackMode === 'image' ? 'gallery-dl' : 'yt-dlp'}...`,
      true,
    );

    try {
      result = await runDownloadMode({ mode: fallbackMode, options, rest, url });
      completedMode = fallbackMode;
    } catch (fallbackError) {
      const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(accessHint({
        url,
        cookieConfig: options.cookieConfig,
        originalError: `${primaryMessage} Fallback ${fallbackMode}: ${fallbackMessage}`,
      }));
    }
  }

  let kind = outputKind({ result, completedMode, options });
  let after = await listFiles(outputDirectory);
  let produced = await producedFiles({ before, after, result, outputDirectory, kind });

  if (!produced.length && result.engine === 'yt-dlp' && result.archiveSkipped && options.archivePath) {
    rest.onLog?.(
      'The URL was recorded in the archive, but no output file exists. Restoring it once without the archive...',
      false,
    );
    const retryOptions = { ...options, archivePath: '', galleryArchivePath: '' };
    try {
      result = await runDownloadMode({
        mode: completedMode,
        options: retryOptions,
        rest,
        url,
      });
    } catch (retryError) {
      throw new Error(accessHint({
        url,
        cookieConfig: options.cookieConfig,
        originalError: `The archive recovery retry failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
      }));
    }
    kind = outputKind({ result, completedMode, options });
    after = await listFiles(outputDirectory);
    produced = await producedFiles({ before, after, result, outputDirectory, kind });
  }

  if (!produced.length) {
    throw new Error(accessHint({
      url,
      cookieConfig: options.cookieConfig,
      originalError: `${result.engine || 'The media engine'} exited successfully but produced no ${kind} file. YTConv did not mark this conversion as successful.`,
    }));
  }

  if (result.engine === 'gallery-dl') {
    produced = await convertImages({
      files: produced,
      format: options.imageFormat,
      ffmpegPath: options.ffmpegPath,
      onLog: rest.onLog,
      onProgress: rest.onProgress,
    });
  }

  return {
    ...result,
    outputPath: produced.at(-1),
    outputPaths: produced,
    fileCount: produced.length,
  };
}
