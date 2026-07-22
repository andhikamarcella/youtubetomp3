import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { cookieArgs } from './cookies.js';
import {
  downloadGallery,
  inspectGallery,
  isGalleryPreferredUrl,
} from './gallery.js';

const MAX_METADATA_BYTES = 12 * 1024 * 1024;

function commonExtractorArgs() {
  return [
    '--ignore-config',
    '--js-runtimes',
    'node',
    '--remote-components',
    'ejs:github',
    '--socket-timeout',
    '30',
    '--retries',
    '10',
    '--fragment-retries',
    '10',
    '--extractor-retries',
    '5',
    '--retry-sleep',
    'http:linear=1::2',
    '--retry-sleep',
    'fragment:linear=1::2',
    '--retry-sleep',
    'extractor:linear=1:5:1',
    '--geo-bypass',
  ];
}

function normalizeYtDlpRunner(value) {
  if (typeof value === 'string') {
    return { command: value, prefixArgs: [], displayPath: value };
  }
  const command = value?.command || value?.path;
  if (!command) throw new Error('Executable yt-dlp belum tersedia.');
  return {
    command,
    prefixArgs: Array.isArray(value?.prefixArgs) ? value.prefixArgs : [],
    displayPath: value?.displayPath || value?.path || command,
  };
}

function spawnYtDlp(runnerValue, args, options = {}) {
  const runner = normalizeYtDlpRunner(runnerValue);
  return {
    runner,
    child: spawn(runner.command, [...runner.prefixArgs, ...args], options),
  };
}

function platformFromInfo(info, url) {
  const value = `${info?.extractor_key ?? ''} ${info?.extractor ?? ''} ${info?.webpage_url_domain ?? ''} ${url}`.toLowerCase();
  const platforms = [
    ['youtube', 'YouTube'], ['youtu.be', 'YouTube'], ['tiktok', 'TikTok'],
    ['instagram', 'Instagram'], ['threads.com', 'Threads'], ['threads.net', 'Threads'],
    ['twitter', 'X / Twitter'], ['x.com', 'X / Twitter'], ['facebook', 'Facebook'],
    ['fb.watch', 'Facebook'], ['pinterest', 'Pinterest'], ['pin.it', 'Pinterest'],
    ['reddit', 'Reddit'], ['twitch', 'Twitch'], ['soundcloud', 'SoundCloud'],
    ['vimeo', 'Vimeo'], ['dailymotion', 'Dailymotion'], ['bilibili', 'Bilibili'],
    ['tumblr', 'Tumblr'], ['snapchat', 'Snapchat'], ['linkedin', 'LinkedIn'],
    ['telegram', 'Telegram'], ['weibo', 'Weibo'], ['vk.com', 'VK'],
    ['streamable', 'Streamable'], ['rumble', 'Rumble'], ['kick', 'Kick'],
    ['bandcamp', 'Bandcamp'], ['mixcloud', 'Mixcloud'], ['imgur', 'Imgur'],
    ['odysee', 'Odysee'], ['9gag', '9GAG'],
  ];
  return platforms.find(([needle]) => value.includes(needle))?.[1]
    ?? info?.extractor_key
    ?? info?.extractor
    ?? 'Situs media';
}

export function formatVideoSelector(resolution = 'best', container = 'auto') {
  const limit = resolution === 'best' ? '' : `[height<=${resolution}]`;
  if (container === 'webm') {
    return [
      `bv*${limit}[ext=webm]+ba[ext=webm]`,
      `b${limit}[ext=webm]`,
      `bv*${limit}+ba`,
      `b${limit}`,
    ].join('/');
  }
  return [
    `bv*${limit}[ext=mp4]+ba[ext=m4a]`,
    `b${limit}[ext=mp4]`,
    `bv*${limit}+ba`,
    `b${limit}`,
  ].join('/');
}

function outputTemplate(options) {
  const fileName = '%(title).180B [%(id)s].%(ext)s';
  if (!options.playlist) return path.join(options.outputDirectory, fileName);
  return path.join(
    options.outputDirectory,
    '%(playlist_title).120B',
    '%(playlist_index)03d - %(title).160B [%(id)s].%(ext)s',
  );
}

function isYouTubeMusicUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase() === 'music.youtube.com';
  } catch {
    return false;
  }
}

function envValue(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

function envFlag(name) {
  return process.env[name] === '1';
}

function cookieFailureMessage(stderr) {
  if (/could not copy.*cookie|cookie database|decrypt.*cookie|dpapi|keyring/iu.test(stderr)) {
    return 'Gagal membaca cookies browser. Tutup browser sepenuhnya lalu coba lagi, atau gunakan cookies.txt melalui Ctrl+B.';
  }
  if (/cookies?.*(expired|invalid)|sign in|login required|authentication/iu.test(stderr)) {
    return 'Situs meminta login atau cookies yang masih aktif. Gunakan cookies.txt terbaru atau pilih browser tempat akun tersebut sudah login.';
  }
  return null;
}

function readableError(stderr, fallback) {
  const cookieMessage = cookieFailureMessage(stderr);
  if (cookieMessage) return cookieMessage;
  const usefulLines = String(stderr || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /error|unsupported|login|cookie|private|unavailable|failed|blocked|forbidden|requested format|http error/iu.test(line));
  return usefulLines.at(-1)?.replace(/^ERROR:\s*/u, '') || fallback;
}

function runBuffered(runnerValue, args, { signal, maxBytes = MAX_METADATA_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    let spawned;
    try {
      spawned = spawnYtDlp(runnerValue, args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
    } catch (error) {
      reject(error);
      return;
    }

    const { child, runner } = spawned;
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
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (Buffer.byteLength(stdout, 'utf8') > maxBytes) {
        child.kill('SIGTERM');
        finish(() => reject(new Error('Metadata dari link terlalu besar untuk diproses.')));
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (Buffer.byteLength(stderr, 'utf8') > maxBytes) stderr = stderr.slice(-maxBytes);
    });
    child.on('error', (error) => finish(() => reject(new Error(
      `Gagal menjalankan yt-dlp (${runner.displayPath}): ${error.message}`,
    ))));
    child.on('close', (code) => {
      if (settled) return;
      if (code === 0) return finish(() => resolve({ stdout, stderr }));
      return finish(() => reject(new Error(readableError(
        stderr,
        `yt-dlp selesai dengan kode ${code ?? 'tidak diketahui'}.`,
      ))));
    });
  });
}

async function inspectWithYtDlp({ ytDlp, ytDlpPath, url, cookieConfig, playlist, signal }) {
  const args = [
    '--dump-single-json',
    '--skip-download',
    '--no-warnings',
    ...commonExtractorArgs(),
    ...cookieArgs(cookieConfig),
  ];
  if (playlist) args.push('--yes-playlist', '--flat-playlist');
  else args.push('--no-playlist');
  args.push(url);

  const { stdout } = await runBuffered(ytDlp || ytDlpPath, args, { signal });
  let info;
  try {
    info = JSON.parse(stdout.trim());
  } catch {
    throw new Error('YTConv tidak dapat membaca metadata dari link tersebut.');
  }
  const firstEntry = Array.isArray(info.entries) ? info.entries.find(Boolean) : null;
  const representative = firstEntry ?? info;
  return {
    title: info.title || representative?.title || 'Media tanpa judul',
    uploader: info.uploader || info.channel || representative?.uploader || representative?.channel || '',
    platform: platformFromInfo(info, url),
    duration: info.duration || representative?.duration || null,
    itemCount: Array.isArray(info.entries) ? info.entries.filter(Boolean).length : 1,
    isPlaylist: info._type === 'playlist' || Array.isArray(info.entries),
    originalUrl: info.webpage_url || representative?.webpage_url || url,
    engine: 'yt-dlp',
  };
}

export async function inspectMedia({
  ytDlp,
  ytDlpPath,
  url,
  cookieConfig = { kind: 'none' },
  playlist = false,
  signal,
}) {
  const forceVideo = process.env.YTCONV_FORCE_VIDEO === '1';
  const galleryPreferred = !forceVideo && isGalleryPreferredUrl(url);
  if (galleryPreferred) {
    return inspectGallery({ url, cookieConfig, outputDirectory: process.cwd(), signal });
  }
  try {
    return await inspectWithYtDlp({ ytDlp, ytDlpPath, url, cookieConfig, playlist, signal });
  } catch (ytDlpError) {
    if (forceVideo) throw ytDlpError;
    try {
      return await inspectGallery({ url, cookieConfig, outputDirectory: process.cwd(), signal });
    } catch {
      throw ytDlpError;
    }
  }
}

function appendAdvancedArgs(args, options) {
  const archivePath = envValue('YTCONV_ARCHIVE');
  const clipStart = envValue('YTCONV_CLIP_START');
  const clipEnd = envValue('YTCONV_CLIP_END');
  if (archivePath) args.push('--download-archive', archivePath);
  if (envFlag('YTCONV_WRITE_INFO_JSON')) args.push('--write-info-json');
  if (envFlag('YTCONV_WRITE_DESCRIPTION')) args.push('--write-description');
  if (clipStart || clipEnd) {
    args.push(
      '--download-sections',
      `*${clipStart || '0'}-${clipEnd || 'inf'}`,
      '--force-keyframes-at-cuts',
    );
  }

  const mode = options.mode;
  const audioFormat = envValue('YTCONV_AUDIO_FORMAT', options.audioFormat || 'mp3');
  const thumbnailRequested = envFlag('YTCONV_WRITE_THUMBNAIL') || (mode === 'audio' && audioFormat === 'mp3');
  if (thumbnailRequested) args.push('--write-thumbnail', '--convert-thumbnails', 'jpg');

  if (mode !== 'audio' && envFlag('YTCONV_SUBTITLES')) {
    args.push(
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs',
      envValue('YTCONV_SUBTITLE_LANGS', 'all,-live_chat'),
      '--sub-format',
      'best',
      '--convert-subs',
      'srt',
      '--embed-subs',
    );
  }

  return { audioFormat, thumbnailRequested };
}

function appendVideoContainerArgs(args, videoFormat) {
  if (videoFormat === 'mp4') {
    args.push('--merge-output-format', 'mp4', '--remux-video', 'mp4');
  } else if (videoFormat === 'mkv') {
    args.push('--merge-output-format', 'mkv', '--remux-video', 'mkv');
  } else if (videoFormat === 'webm') {
    args.push('--merge-output-format', 'webm', '--remux-video', 'webm');
  } else {
    args.push('--merge-output-format', 'mp4/mkv', '--remux-video', 'mov>mp4/mkv');
  }
}

export function buildDownloadArgs(options) {
  const args = [
    '--newline',
    ...commonExtractorArgs(),
    '--windows-filenames',
    '--no-overwrites',
    '--continue',
    '--check-formats',
    '--concurrent-fragments',
    '4',
    '--progress-template',
    'download:ytconv-progress:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    '--print',
    'after_move:ytconv-file:%(filepath)s',
    '--output',
    outputTemplate(options),
    ...cookieArgs(options.cookieConfig),
  ];

  if (options.ffmpegPath) args.push('--ffmpeg-location', options.ffmpegPath);
  if (options.playlist) args.push('--yes-playlist', '--no-abort-on-error');
  else args.push('--no-playlist');

  const { audioFormat, thumbnailRequested } = appendAdvancedArgs(args, options);
  if (options.mode === 'audio') {
    const quality = envValue('YTCONV_AUDIO_QUALITY', options.audioQuality || 'best');
    args.push(
      '-f',
      'ba/b',
      '-x',
      '--audio-format',
      audioFormat,
      '--audio-quality',
      quality === 'best' ? '0' : `${quality}K`,
      '--embed-metadata',
      '--embed-chapters',
    );
    if (thumbnailRequested && audioFormat !== 'wav') args.push('--embed-thumbnail');
    if (thumbnailRequested && isYouTubeMusicUrl(options.url)) {
      args.push('--ppa', 'ThumbnailsConvertor+ffmpeg_o:-vf crop=ih:ih');
    }
  } else {
    const videoFormat = envValue('YTCONV_VIDEO_FORMAT', 'auto');
    const resolution = envValue('YTCONV_RESOLUTION', options.resolution || 'best');
    args.push(
      '-f',
      formatVideoSelector(resolution, videoFormat),
      '--embed-metadata',
      '--embed-chapters',
    );
    appendVideoContainerArgs(args, videoFormat);
  }

  args.push(options.url);
  return args;
}

function downloadWithYtDlp({ ytDlp, ytDlpPath, options, onProgress, onLog, signal }) {
  return new Promise((resolve, reject) => {
    const args = buildDownloadArgs(options);
    let spawned;
    try {
      spawned = spawnYtDlp(ytDlp || ytDlpPath, args, {
        cwd: options.outputDirectory,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
    } catch (error) {
      reject(error);
      return;
    }

    const { child, runner } = spawned;
    let bufferedStdout = '';
    let bufferedStderr = '';
    let allStderr = '';
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
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });

    const processLine = (line, isError = false) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;
      if (cleanLine.startsWith('ytconv-progress:')) {
        const [percent = '', speed = '', eta = ''] = cleanLine.slice('ytconv-progress:'.length).split('|');
        onProgress?.({ percent: percent.trim(), speed: speed.trim(), eta: eta.trim() });
        return;
      }
      if (cleanLine.startsWith('ytconv-file:')) {
        outputPath = cleanLine.slice('ytconv-file:'.length).trim();
        onLog?.(`Tersimpan: ${outputPath}`, false);
        return;
      }
      onLog?.(cleanLine, isError);
    };

    const consume = (chunk, isError) => {
      const text = chunk.toString();
      if (isError) allStderr = `${allStderr}${text}`.slice(-MAX_METADATA_BYTES);
      const previous = isError ? bufferedStderr : bufferedStdout;
      const lines = `${previous}${text}`.split(/\r?\n/u);
      const remaining = lines.pop() ?? '';
      if (isError) bufferedStderr = remaining;
      else bufferedStdout = remaining;
      for (const line of lines) processLine(line, isError);
    };

    child.stdout.on('data', (chunk) => consume(chunk, false));
    child.stderr.on('data', (chunk) => consume(chunk, true));
    child.on('error', (error) => finish(() => reject(new Error(
      `Gagal menjalankan yt-dlp (${runner.displayPath}): ${error.message}`,
    ))));
    child.on('close', (code) => {
      if (settled) return;
      processLine(bufferedStdout, false);
      processLine(bufferedStderr, true);
      if (code === 0) return finish(() => resolve({ outputPath, engine: 'yt-dlp' }));
      return finish(() => reject(new Error(readableError(
        allStderr,
        `yt-dlp selesai dengan kode ${code ?? 'tidak diketahui'}.`,
      ))));
    });
  });
}

export async function downloadMedia({ ytDlp, ytDlpPath, options, onProgress, onLog, signal }) {
  const forceVideo = process.env.YTCONV_FORCE_VIDEO === '1';
  const forceGallery = process.env.YTCONV_FORCE_GALLERY === '1';
  const mayUseGallery = options.mode !== 'audio' && !forceVideo;

  if (mayUseGallery && (forceGallery || isGalleryPreferredUrl(options.url))) {
    onLog?.('Using gallery engine for images, carousels, stories, reels, and mixed posts.', false);
    return downloadGallery({
      url: options.url,
      cookieConfig: options.cookieConfig,
      outputDirectory: options.outputDirectory,
      onProgress,
      onLog,
      signal,
    });
  }

  try {
    return await downloadWithYtDlp({ ytDlp, ytDlpPath, options, onProgress, onLog, signal });
  } catch (ytDlpError) {
    if (!mayUseGallery) throw ytDlpError;
    onLog?.('yt-dlp could not handle this media; trying the gallery/image engine...', true);
    try {
      return await downloadGallery({
        url: options.url,
        cookieConfig: options.cookieConfig,
        outputDirectory: options.outputDirectory,
        onProgress,
        onLog,
        signal,
      });
    } catch (galleryError) {
      throw new Error(
        `${ytDlpError instanceof Error ? ytDlpError.message : String(ytDlpError)} `
        + `Gallery fallback: ${galleryError instanceof Error ? galleryError.message : String(galleryError)}`,
      );
    }
  }
}
