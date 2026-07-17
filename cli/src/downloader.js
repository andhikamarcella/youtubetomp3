import { spawn } from 'node:child_process';
import path from 'node:path';
import { cookieArgs } from './cookies.js';

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

function platformFromInfo(info, url) {
  const value = `${info?.extractor_key ?? ''} ${info?.extractor ?? ''} ${info?.webpage_url_domain ?? ''} ${url}`.toLowerCase();
  const platforms = [
    ['youtube', 'YouTube'],
    ['youtu.be', 'YouTube'],
    ['tiktok', 'TikTok'],
    ['instagram', 'Instagram'],
    ['threads.net', 'Threads'],
    ['twitter', 'X / Twitter'],
    ['x.com', 'X / Twitter'],
    ['facebook', 'Facebook'],
    ['fb.watch', 'Facebook'],
    ['pinterest', 'Pinterest'],
    ['pin.it', 'Pinterest'],
    ['reddit', 'Reddit'],
    ['twitch', 'Twitch'],
    ['soundcloud', 'SoundCloud'],
    ['vimeo', 'Vimeo'],
    ['dailymotion', 'Dailymotion'],
    ['bilibili', 'Bilibili'],
    ['tumblr', 'Tumblr'],
    ['snapchat', 'Snapchat'],
    ['linkedin', 'LinkedIn'],
    ['telegram', 'Telegram'],
    ['weibo', 'Weibo'],
    ['vk.com', 'VK'],
    ['streamable', 'Streamable'],
    ['rumble', 'Rumble'],
    ['kick', 'Kick'],
    ['bandcamp', 'Bandcamp'],
    ['mixcloud', 'Mixcloud'],
    ['imgur', 'Imgur'],
    ['9gag', '9GAG'],
  ];

  return platforms.find(([needle]) => value.includes(needle))?.[1]
    ?? info?.extractor_key
    ?? info?.extractor
    ?? 'Situs media';
}

export function formatVideoSelector(resolution) {
  const limit = resolution === 'best' ? '' : `[height<=${resolution}]`;
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

function cookieFailureMessage(stderr) {
  if (/could not copy.*cookie|cookie database|decrypt.*cookie|dpapi|keyring/iu.test(stderr)) {
    return 'Gagal membaca cookies browser. Tutup browser sepenuhnya lalu coba lagi, '
      + 'atau gunakan cookies.txt melalui Ctrl+B.';
  }
  if (/cookies?.*(expired|invalid)|sign in|login required|authentication/iu.test(stderr)) {
    return 'Situs meminta login atau cookies yang masih aktif. Gunakan cookies.txt terbaru '
      + 'atau pilih browser tempat akun tersebut sudah login.';
  }
  return null;
}

function readableError(stderr, fallback) {
  const cookieMessage = cookieFailureMessage(stderr);
  if (cookieMessage) return cookieMessage;

  const usefulLines = stderr
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => (
      /error|unsupported|login|cookie|private|unavailable|failed|blocked|forbidden|requested format|http error/iu
        .test(line)
    ));

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

export async function inspectMedia({
  ytDlpPath,
  url,
  cookieConfig = { kind: 'none' },
  playlist = false,
  signal,
}) {
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

  if (options.mode === 'audio') {
    args.push(
      '-f',
      'ba/b',
      '-x',
      '--audio-format',
      options.audioFormat,
      '--embed-metadata',
    );

    if (options.audioFormat === 'mp3') args.push('--audio-quality', options.audioQuality);
  } else {
    args.push(
      '-f',
      formatVideoSelector(options.resolution),
      '--merge-output-format',
      'mp4/mkv',
      '--remux-video',
      'mov>mp4/mkv',
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

      onLog?.(cleanLine, isError);
    };

    const consume = (chunk, isError) => {
      const text = chunk.toString();
      if (isError) {
        allStderr = `${allStderr}${text}`.slice(-MAX_METADATA_BYTES);
      }

      const previous = isError ? bufferedStderr : bufferedStdout;
      const combined = previous + text;
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

      const message = readableError(allStderr, `yt-dlp selesai dengan kode ${code ?? 'tidak diketahui'}.`);
      finish(() => reject(new Error(message)));
    });
  });
}
