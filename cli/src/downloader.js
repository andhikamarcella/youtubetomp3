import { spawn } from 'node:child_process';
import path from 'node:path';

const MAX_METADATA_BYTES = 12 * 1024 * 1024;

function browserArgs(browser) {
  return browser && browser !== 'none' ? ['--cookies-from-browser', browser] : [];
}

function platformFromInfo(info, url) {
  const value = `${info?.extractor_key ?? ''} ${info?.extractor ?? ''} ${info?.webpage_url_domain ?? ''} ${url}`.toLowerCase();
  const platforms = [
    ['youtube', 'YouTube'],
    ['youtu.be', 'YouTube'],
    ['tiktok', 'TikTok'],
    ['instagram', 'Instagram'],
    ['twitter', 'X / Twitter'],
    ['x.com', 'X / Twitter'],
    ['facebook', 'Facebook'],
    ['reddit', 'Reddit'],
    ['twitch', 'Twitch'],
    ['soundcloud', 'SoundCloud'],
    ['vimeo', 'Vimeo'],
    ['dailymotion', 'Dailymotion'],
    ['bilibili', 'Bilibili'],
    ['pinterest', 'Pinterest'],
    ['tumblr', 'Tumblr'],
    ['snapchat', 'Snapchat'],
    ['streamable', 'Streamable'],
    ['rumble', 'Rumble'],
    ['kick', 'Kick'],
    ['bandcamp', 'Bandcamp'],
    ['mixcloud', 'Mixcloud'],
  ];

  return platforms.find(([needle]) => value.includes(needle))?.[1]
    ?? info?.extractor_key
    ?? info?.extractor
    ?? 'Situs media';
}

function formatVideoSelector(resolution) {
  if (resolution === 'best') return 'bv*+ba/b';
  return `bv*[height<=${resolution}]+ba/b[height<=${resolution}]`;
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

function readableError(stderr, fallback) {
  const usefulLines = stderr
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /error|unsupported|login|cookie|private|unavailable|failed|blocked/iu.test(line));

  return usefulLines.at(-1)?.replace(/^ERROR:\s*/u, '') || fallback;
}

function runBuffered(command, args, { signal, maxBytes = MAX_METADATA_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
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

    child.on('error', (error) => {
      finish(() => reject(new Error(`Gagal menjalankan yt-dlp: ${error.message}`)));
    });

    child.on('close', (code) => {
      if (settled) return;
      if (code === 0) {
        finish(() => resolve({ stdout, stderr }));
        return;
      }

      const message = readableError(stderr, `yt-dlp selesai dengan kode ${code ?? 'tidak diketahui'}.`);
      finish(() => reject(new Error(message)));
    });
  });
}

export async function inspectMedia({ ytDlpPath, url, cookiesFromBrowser = 'none', playlist = false, signal }) {
  const args = [
    '--dump-single-json',
    '--skip-download',
    '--no-warnings',
    '--ignore-config',
    ...browserArgs(cookiesFromBrowser),
  ];

  if (playlist) args.push('--yes-playlist', '--flat-playlist');
  else args.push('--no-playlist');

  args.push(url);

  const { stdout } = await runBuffered(ytDlpPath, args, { signal });
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
  };
}

export function buildDownloadArgs(options) {
  const args = [
    '--newline',
    '--ignore-config',
    '--windows-filenames',
    '--no-overwrites',
    '--continue',
    '--concurrent-fragments',
    '4',
    '--progress-template',
    'download:ytconv-progress:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    '--print',
    'after_move:ytconv-file:%(filepath)s',
    '--output',
    outputTemplate(options),
    ...browserArgs(options.cookiesFromBrowser),
  ];

  if (options.ffmpegPath) args.push('--ffmpeg-location', options.ffmpegPath);

  if (options.playlist) args.push('--yes-playlist');
  else args.push('--no-playlist');

  if (options.mode === 'audio') {
    args.push('-f', 'ba/b', '-x', '--audio-format', options.audioFormat);

    if (options.audioFormat === 'mp3') args.push('--audio-quality', options.audioQuality);

    args.push('--embed-thumbnail', '--convert-thumbnails', 'jpg', '--embed-metadata');
  } else {
    args.push(
      '-f',
      formatVideoSelector(options.resolution),
      '--merge-output-format',
      'mp4',
      '--embed-thumbnail',
      '--convert-thumbnails',
      'jpg',
      '--embed-metadata',
    );
  }

  args.push(options.url);
  return args;
}

export function downloadMedia({ ytDlpPath, options, onProgress, onLog, signal }) {
  return new Promise((resolve, reject) => {
    const args = buildDownloadArgs(options);
    const child = spawn(ytDlpPath, args, {
      cwd: options.outputDirectory,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let bufferedStdout = '';
    let bufferedStderr = '';
    let lastError = '';
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
      const cleanLine = line.trim();
      if (!cleanLine) return;

      if (cleanLine.startsWith('ytconv-progress:')) {
        const [percent = '', speed = '', eta = ''] = cleanLine.slice('ytconv-progress:'.length).split('|');
        onProgress?.({
          percent: percent.trim(),
          speed: speed.trim(),
          eta: eta.trim(),
        });
        return;
      }

      if (cleanLine.startsWith('ytconv-file:')) {
        outputPath = cleanLine.slice('ytconv-file:'.length).trim();
        onLog?.(`Tersimpan: ${outputPath}`, false);
        return;
      }

      if (isError && /ERROR:/u.test(cleanLine)) lastError = cleanLine;
      onLog?.(cleanLine, isError);
    };

    const consume = (chunk, isError) => {
      const previous = isError ? bufferedStderr : bufferedStdout;
      const combined = previous + chunk.toString();
      const lines = combined.split(/\r?\n/u);
      const remaining = lines.pop() ?? '';

      if (isError) bufferedStderr = remaining;
      else bufferedStdout = remaining;

      for (const line of lines) processLine(line, isError);
    };

    child.stdout.on('data', (chunk) => consume(chunk, false));
    child.stderr.on('data', (chunk) => consume(chunk, true));

    child.on('error', (error) => {
      finish(() => reject(new Error(`Gagal menjalankan yt-dlp: ${error.message}`)));
    });

    child.on('close', (code) => {
      if (settled) return;
      processLine(bufferedStdout, false);
      processLine(bufferedStderr, true);

      if (code === 0) {
        finish(() => resolve({ outputPath }));
        return;
      }

      const message = readableError(lastError || bufferedStderr, `yt-dlp selesai dengan kode ${code ?? 'tidak diketahui'}.`);
      finish(() => reject(new Error(message)));
    });
  });
}
