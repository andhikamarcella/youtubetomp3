import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { cookieArgs } from './cookies.js';
import { downloadGallery, inspectGallery, isGalleryPreferredUrl } from './gallery.js';

const MAX_METADATA_BYTES = 12 * 1024 * 1024;

function envValue(name, fallback = '') {
  return process.env[name]?.trim() || fallback;
}

function envFlag(name) {
  return process.env[name] === '1';
}

function optionValue(options, key, envName, fallback = '') {
  const value = options?.[key];
  if (value !== undefined && value !== null && value !== '') return String(value);
  return envValue(envName, fallback);
}

function optionFlag(options, key, envName, fallback = false) {
  if (typeof options?.[key] === 'boolean') return options[key];
  if (process.env[envName] !== undefined) return envFlag(envName);
  return fallback;
}

function commonExtractorArgs(options = {}) {
  const retries = optionValue(options, 'retries', 'YTCONV_RETRIES', '10');
  const fragmentRetries = optionValue(options, 'fragmentRetries', 'YTCONV_FRAGMENT_RETRIES', '10');
  const fileAccessRetries = optionValue(options, 'fileAccessRetries', 'YTCONV_FILE_ACCESS_RETRIES', '3');
  const retrySleep = optionValue(options, 'retrySleep', 'YTCONV_RETRY_SLEEP', 'linear=1::2');
  const args = [
    '--ignore-config', '--js-runtimes', 'node', '--remote-components', 'ejs:github',
    '--socket-timeout', '30', '--retries', retries, '--fragment-retries', fragmentRetries,
    '--file-access-retries', fileAccessRetries, '--extractor-retries', '5',
    '--retry-sleep', retrySleep, '--retry-sleep', `fragment:${retrySleep.replace(/^[^:]+:/u, '')}`,
    '--retry-sleep', `file_access:${retrySleep.replace(/^[^:]+:/u, '')}`, '--geo-bypass',
  ];
  const proxy = optionValue(options, 'proxy', 'YTCONV_PROXY');
  if (proxy) args.push('--proxy', proxy);
  return args;
}

function normalizeYtDlpRunner(value) {
  if (typeof value === 'string') return { command: value, prefixArgs: [], displayPath: value };
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
  return { runner, child: spawn(runner.command, [...runner.prefixArgs, ...args], options) };
}

function platformFromInfo(info, url) {
  const value = `${info?.extractor_key ?? ''} ${info?.extractor ?? ''} ${info?.webpage_url_domain ?? ''} ${url}`.toLowerCase();
  const platforms = [
    ['youtube', 'YouTube'], ['youtu.be', 'YouTube'], ['tiktok', 'TikTok'], ['instagram', 'Instagram'],
    ['threads.com', 'Threads'], ['threads.net', 'Threads'], ['twitter', 'X / Twitter'], ['x.com', 'X / Twitter'],
    ['facebook', 'Facebook'], ['fb.watch', 'Facebook'], ['pinterest', 'Pinterest'], ['pin.it', 'Pinterest'],
    ['reddit', 'Reddit'], ['twitch', 'Twitch'], ['soundcloud', 'SoundCloud'], ['vimeo', 'Vimeo'],
    ['dailymotion', 'Dailymotion'], ['bilibili', 'Bilibili'], ['tumblr', 'Tumblr'], ['snapchat', 'Snapchat'],
    ['linkedin', 'LinkedIn'], ['telegram', 'Telegram'], ['weibo', 'Weibo'], ['vk.com', 'VK'],
    ['streamable', 'Streamable'], ['rumble', 'Rumble'], ['kick', 'Kick'], ['bandcamp', 'Bandcamp'],
    ['mixcloud', 'Mixcloud'], ['imgur', 'Imgur'], ['odysee', 'Odysee'], ['9gag', '9GAG'],
  ];
  return platforms.find(([needle]) => value.includes(needle))?.[1] ?? info?.extractor_key ?? info?.extractor ?? 'Situs media';
}

export function formatVideoSelector(resolution = 'best', container = 'auto') {
  const limit = resolution === 'best' ? '' : `[height<=${resolution}]`;
  if (container === 'webm') {
    return [`bv*${limit}[ext=webm]+ba[ext=webm]`, `b${limit}[ext=webm]`, `bv*${limit}+ba`, `b${limit}`].join('/');
  }
  return [`bv*${limit}[ext=mp4]+ba[ext=m4a]`, `b${limit}[ext=mp4]`, `bv*${limit}+ba`, `b${limit}`].join('/');
}

function outputTemplate(options) {
  const custom = optionValue(options, 'outputTemplate', 'YTCONV_OUTPUT_TEMPLATE');
  if (custom) return path.join(options.outputDirectory, custom);
  const fileName = '%(title).180B [%(id)s].%(ext)s';
  if (!options.playlist) return path.join(options.outputDirectory, fileName);
  return path.join(options.outputDirectory, '%(playlist_title).120B', '%(playlist_index)03d - %(title).160B [%(id)s].%(ext)s');
}

function isYouTubeMusicUrl(value) {
  try { return new URL(value).hostname.toLowerCase() === 'music.youtube.com'; } catch { return false; }
}

function cookieFailureMessage(stderr) {
  if (/could not copy.*cookie|cookie database|decrypt.*cookie|dpapi|keyring/iu.test(stderr)) {
    return 'Gagal membaca cookies browser. Tutup browser sepenuhnya lalu coba lagi, atau gunakan cookies.txt.';
  }
  if (/cookies?.*(expired|invalid)|sign in|login required|authentication/iu.test(stderr)) {
    return 'Situs meminta login atau cookies aktif. Gunakan --cookies FILE atau --cookies-from-browser BROWSER.';
  }
  return null;
}

function readableError(stderr, fallback) {
  const cookieMessage = cookieFailureMessage(stderr);
  if (cookieMessage) return cookieMessage;
  const usefulLines = String(stderr || '').split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
    .filter((line) => /error|unsupported|login|cookie|private|unavailable|failed|blocked|forbidden|requested format|http error/iu.test(line));
  return usefulLines.at(-1)?.replace(/^ERROR:\s*/u, '') || fallback;
}

function runBuffered(runnerValue, args, { signal, maxBytes = MAX_METADATA_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    let spawned;
    try {
      spawned = spawnYtDlp(runnerValue, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    } catch (error) { reject(error); return; }
    const { child, runner } = spawned;
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (callback) => { if (settled) return; settled = true; signal?.removeEventListener('abort', abort); callback(); };
    const abort = () => { child.kill('SIGTERM'); finish(() => reject(new Error('Proses dibatalkan.'))); };
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
    child.on('error', (error) => finish(() => reject(new Error(`Gagal menjalankan yt-dlp (${runner.displayPath}): ${error.message}`))));
    child.on('close', (code) => {
      if (settled) return;
      if (code === 0) return finish(() => resolve({ stdout, stderr }));
      return finish(() => reject(new Error(readableError(stderr, `yt-dlp selesai dengan kode ${code ?? 'tidak diketahui'}.`))));
    });
  });
}

function formatSummary(format = {}) {
  const hasVideo = format.vcodec && format.vcodec !== 'none';
  const hasAudio = format.acodec && format.acodec !== 'none';
  return {
    id: format.format_id || '',
    ext: format.ext || '',
    type: hasVideo && hasAudio ? 'video+audio' : hasVideo ? 'video' : hasAudio ? 'audio' : 'unknown',
    resolution: format.resolution || (format.height ? `${format.width || '?'}x${format.height}` : ''),
    width: format.width || null,
    height: format.height || null,
    fps: format.fps || null,
    videoCodec: hasVideo ? format.vcodec : null,
    audioCodec: hasAudio ? format.acodec : null,
    audioBitrateKbps: format.abr || null,
    totalBitrateKbps: format.tbr || null,
    sizeBytes: format.filesize || format.filesize_approx || null,
    protocol: format.protocol || '',
    source: 'original',
  };
}

function summarizeFormats(info = {}) {
  return (Array.isArray(info.formats) ? info.formats : []).map(formatSummary)
    .filter((item) => item.type !== 'unknown');
}

async function inspectWithYtDlp({ ytDlp, ytDlpPath, url, cookieConfig, playlist, signal, options = {} }) {
  const args = ['--dump-single-json', '--skip-download', '--no-warnings', ...commonExtractorArgs(options), ...cookieArgs(cookieConfig)];
  if (playlist) args.push('--yes-playlist', '--flat-playlist'); else args.push('--no-playlist');
  args.push(url);
  const { stdout } = await runBuffered(ytDlp || ytDlpPath, args, { signal });
  let info;
  try { info = JSON.parse(stdout.trim()); } catch { throw new Error('YTConv tidak dapat membaca metadata dari link tersebut.'); }
  const firstEntry = Array.isArray(info.entries) ? info.entries.find(Boolean) : null;
  const representative = firstEntry ?? info;
  return {
    title: info.title || representative?.title || 'Media tanpa judul',
    uploader: info.uploader || info.channel || representative?.uploader || representative?.channel || '',
    channel: info.channel || representative?.channel || '',
    platform: platformFromInfo(info, url),
    duration: info.duration || representative?.duration || null,
    itemCount: Array.isArray(info.entries) ? info.entries.filter(Boolean).length : 1,
    isPlaylist: info._type === 'playlist' || Array.isArray(info.entries),
    originalUrl: info.webpage_url || representative?.webpage_url || url,
    thumbnail: info.thumbnail || representative?.thumbnail || '',
    uploadDate: info.upload_date || representative?.upload_date || '',
    viewCount: info.view_count || representative?.view_count || null,
    formats: summarizeFormats(representative),
    engine: 'yt-dlp',
  };
}

export async function inspectMedia({ ytDlp, ytDlpPath, url, cookieConfig = { kind: 'none' }, playlist = false, signal, options = {} }) {
  const forceVideo = process.env.YTCONV_FORCE_VIDEO === '1';
  const galleryPreferred = !forceVideo && isGalleryPreferredUrl(url);
  if (galleryPreferred) return inspectGallery({ url, cookieConfig, outputDirectory: process.cwd(), signal });
  try {
    return await inspectWithYtDlp({ ytDlp, ytDlpPath, url, cookieConfig, playlist, signal, options });
  } catch (ytDlpError) {
    if (forceVideo) throw ytDlpError;
    try { return await inspectGallery({ url, cookieConfig, outputDirectory: process.cwd(), signal }); }
    catch { throw ytDlpError; }
  }
}

function appendSponsorBlockArgs(args, options) {
  const mode = optionValue(options, 'sponsorBlockMode', 'YTCONV_SPONSORBLOCK_MODE', 'off');
  if (mode === 'off') return;
  const categories = optionValue(options, 'sponsorBlockCategories', 'YTCONV_SPONSORBLOCK_CATEGORIES', 'sponsor,selfpromo,interaction,intro,outro,preview,music_offtopic');
  args.push(mode === 'remove' ? '--sponsorblock-remove' : '--sponsorblock-mark', categories);
}

function appendMetadataOverrides(args, options) {
  const mappings = [
    ['metadataArtist', 'YTCONV_METADATA_ARTIST', 'meta_artist'],
    ['metadataTitle', 'YTCONV_METADATA_TITLE', 'meta_title'],
    ['metadataAlbum', 'YTCONV_METADATA_ALBUM', 'meta_album'],
    ['metadataTrack', 'YTCONV_METADATA_TRACK', 'meta_track'],
    ['metadataYear', 'YTCONV_METADATA_YEAR', 'meta_date'],
    ['metadataGenre', 'YTCONV_METADATA_GENRE', 'meta_genre'],
  ];
  for (const [key, envName, target] of mappings) {
    const value = optionValue(options, key, envName);
    if (value) args.push('--parse-metadata', `${value.replace(/%/gu, '%%')}:%(${target})s`);
  }
}

function appendAdvancedArgs(args, options) {
  const archivePath = optionValue(options, 'archivePath', 'YTCONV_ARCHIVE');
  const clipStart = optionValue(options, 'clipStart', 'YTCONV_CLIP_START');
  const clipEnd = optionValue(options, 'clipEnd', 'YTCONV_CLIP_END');
  const rateLimit = optionValue(options, 'rateLimit', 'YTCONV_RATE_LIMIT');
  const playlistItems = optionValue(options, 'playlistItems', 'YTCONV_PLAYLIST_ITEMS');
  const maxDownloads = optionValue(options, 'maxDownloads', 'YTCONV_MAX_DOWNLOADS');
  const skipPlaylistAfterErrors = optionValue(options, 'skipPlaylistAfterErrors', 'YTCONV_SKIP_PLAYLIST_AFTER_ERRORS');
  if (archivePath) args.push('--download-archive', archivePath);
  if (optionFlag(options, 'writeInfoJson', 'YTCONV_WRITE_INFO_JSON')) args.push('--write-info-json');
  if (optionFlag(options, 'writeDescription', 'YTCONV_WRITE_DESCRIPTION')) args.push('--write-description');
  if (optionFlag(options, 'restrictFilenames', 'YTCONV_RESTRICT_FILENAMES')) args.push('--restrict-filenames');
  if (rateLimit) args.push('--limit-rate', rateLimit);
  if (playlistItems) args.push('--playlist-items', playlistItems);
  if (maxDownloads) args.push('--max-downloads', maxDownloads);
  if (skipPlaylistAfterErrors) args.push('--skip-playlist-after-errors', skipPlaylistAfterErrors);
  if (optionFlag(options, 'liveFromStart', 'YTCONV_LIVE_FROM_START')) args.push('--live-from-start');
  if (clipStart || clipEnd) args.push('--download-sections', `*${clipStart || '0'}-${clipEnd || 'inf'}`, '--force-keyframes-at-cuts');
  appendSponsorBlockArgs(args, options);
  appendMetadataOverrides(args, options);

  const mode = options.mode;
  const audioFormat = optionValue(options, 'audioFormat', 'YTCONV_AUDIO_FORMAT', 'mp3');
  const thumbnailRequested = optionFlag(options, 'writeThumbnail', 'YTCONV_WRITE_THUMBNAIL') || (mode === 'audio' && audioFormat === 'mp3');
  if (thumbnailRequested) args.push('--write-thumbnail', '--convert-thumbnails', 'jpg');

  const subtitles = optionFlag(options, 'subtitles', 'YTCONV_SUBTITLES');
  const subtitleOnly = optionFlag(options, 'subtitleOnly', 'YTCONV_SUBTITLE_ONLY');
  if (mode !== 'audio' && (subtitles || subtitleOnly)) {
    args.push('--write-subs', '--write-auto-subs', '--sub-langs', optionValue(options, 'subtitleLanguages', 'YTCONV_SUBTITLE_LANGS', 'all,-live_chat'), '--sub-format', 'best', '--convert-subs', 'srt');
    if (subtitleOnly) args.push('--skip-download'); else args.push('--embed-subs');
  }
  return { audioFormat, thumbnailRequested, subtitleOnly };
}

function appendVideoContainerArgs(args, videoFormat) {
  if (videoFormat === 'mp4') args.push('--merge-output-format', 'mp4', '--remux-video', 'mp4');
  else if (videoFormat === 'mkv') args.push('--merge-output-format', 'mkv', '--remux-video', 'mkv');
  else if (videoFormat === 'webm') args.push('--merge-output-format', 'webm', '--remux-video', 'webm');
  else args.push('--merge-output-format', 'mp4/mkv', '--remux-video', 'mov>mp4/mkv');
}

export function buildDownloadArgs(options) {
  const overwrite = optionFlag(options, 'overwrite', 'YTCONV_OVERWRITE');
  const resume = optionFlag(options, 'resume', 'YTCONV_RESUME', true);
  const concurrentFragments = optionValue(options, 'concurrentFragments', 'YTCONV_CONCURRENT_FRAGMENTS', '4');
  const args = [
    '--newline', ...commonExtractorArgs(options), '--windows-filenames',
    overwrite ? '--force-overwrites' : '--no-overwrites', resume ? '--continue' : '--no-continue',
    '--no-keep-fragments', '--check-formats', '--concurrent-fragments', concurrentFragments,
    '--progress-template', 'download:ytconv-progress:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_str)s',
    '--print', 'after_move:ytconv-file:%(filepath)s', '--output', outputTemplate(options), ...cookieArgs(options.cookieConfig),
  ];
  if (options.ffmpegPath) args.push('--ffmpeg-location', options.ffmpegPath);
  if (options.playlist) args.push('--yes-playlist', '--no-abort-on-error'); else args.push('--no-playlist');

  const { audioFormat, thumbnailRequested, subtitleOnly } = appendAdvancedArgs(args, options);
  if (!subtitleOnly && options.mode === 'audio') {
    const quality = optionValue(options, 'audioQuality', 'YTCONV_AUDIO_QUALITY', 'best');
    args.push('-f', 'ba/b', '-x', '--audio-format', audioFormat, '--audio-quality', quality === 'best' ? '0' : `${quality}K`, '--embed-metadata', '--embed-chapters');
    if (optionFlag(options, 'keepVideo', 'YTCONV_KEEP_VIDEO')) args.push('--keep-video');
    if (thumbnailRequested && audioFormat !== 'wav') args.push('--embed-thumbnail');
    if (thumbnailRequested && isYouTubeMusicUrl(options.url)) args.push('--ppa', 'ThumbnailsConvertor+ffmpeg_o:-vf crop=ih:ih');
    if (optionFlag(options, 'normalizeAudio', 'YTCONV_NORMALIZE_AUDIO')) args.push('--ppa', 'ExtractAudio+ffmpeg_o:-af loudnorm=I=-16:LRA=11:TP=-1.5');
  } else if (!subtitleOnly) {
    const videoFormat = optionValue(options, 'videoFormat', 'YTCONV_VIDEO_FORMAT', 'auto');
    const resolution = optionValue(options, 'resolution', 'YTCONV_RESOLUTION', 'best');
    args.push('-f', formatVideoSelector(resolution, videoFormat), '--embed-metadata', '--embed-chapters');
    appendVideoContainerArgs(args, videoFormat);
  }
  args.push(options.url);
  return args;
}

export function buildUtilityArgs({ url, cookieConfig, playlist = false, kind, options = {} }) {
  const args = [...commonExtractorArgs(options), ...cookieArgs(cookieConfig), playlist ? '--yes-playlist' : '--no-playlist'];
  if (kind === 'formats') args.push('--list-formats');
  else if (kind === 'subs') args.push('--list-subs');
  else throw new Error(`Utility yt-dlp tidak dikenal: ${kind}`);
  args.push(url);
  return args;
}

export function runYtDlpUtility({ ytDlp, ytDlpPath, url, cookieConfig, playlist, kind, options = {} }) {
  return new Promise((resolve, reject) => {
    let spawned;
    try {
      spawned = spawnYtDlp(ytDlp || ytDlpPath, buildUtilityArgs({ url, cookieConfig, playlist, kind, options }), { windowsHide: true, stdio: 'inherit', env: process.env });
    } catch (error) { reject(error); return; }
    spawned.child.once('error', (error) => reject(new Error(`Gagal menjalankan yt-dlp (${spawned.runner.displayPath}): ${error.message}`)));
    spawned.child.once('close', (code) => code === 0 ? resolve(0) : reject(new Error(`yt-dlp selesai dengan kode ${code ?? 'tidak diketahui'}.`)));
  });
}

function downloadWithYtDlp({ ytDlp, ytDlpPath, options, onProgress, onLog, signal }) {
  return new Promise((resolve, reject) => {
    const args = buildDownloadArgs(options);
    let spawned;
    try {
      spawned = spawnYtDlp(ytDlp || ytDlpPath, args, { cwd: options.outputDirectory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    } catch (error) { reject(error); return; }
    const { child, runner } = spawned;
    let bufferedStdout = '';
    let bufferedStderr = '';
    let allStderr = '';
    let outputPath = '';
    let settled = false;
    const finish = (callback) => { if (settled) return; settled = true; signal?.removeEventListener('abort', abort); callback(); };
    const abort = () => { child.kill('SIGTERM'); finish(() => reject(new Error('Unduhan dibatalkan.'))); };
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });

    const processLine = (line, isError = false) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;
      if (cleanLine.startsWith('ytconv-progress:')) {
        const [percent = '', speed = '', eta = '', total = ''] = cleanLine.slice('ytconv-progress:'.length).split('|');
        onProgress?.({ percent: percent.trim(), speed: speed.trim(), eta: eta.trim(), total: total.trim() });
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
      if (isError) bufferedStderr = remaining; else bufferedStdout = remaining;
      for (const line of lines) processLine(line, isError);
    };
    child.stdout.on('data', (chunk) => consume(chunk, false));
    child.stderr.on('data', (chunk) => consume(chunk, true));
    child.on('error', (error) => finish(() => reject(new Error(`Gagal menjalankan yt-dlp (${runner.displayPath}): ${error.message}`))));
    child.on('close', (code) => {
      if (settled) return;
      processLine(bufferedStdout, false); processLine(bufferedStderr, true);
      if (code === 0) return finish(() => resolve({ outputPath, engine: 'yt-dlp' }));
      return finish(() => reject(new Error(readableError(allStderr, `yt-dlp selesai dengan kode ${code ?? 'tidak diketahui'}.`))));
    });
  });
}

export async function downloadMedia({ ytDlp, ytDlpPath, options, onProgress, onLog, signal }) {
  const forceVideo = process.env.YTCONV_FORCE_VIDEO === '1';
  const forceGallery = process.env.YTCONV_FORCE_GALLERY === '1';
  const mayUseGallery = options.mode !== 'audio' && !forceVideo;
  if (mayUseGallery && (forceGallery || isGalleryPreferredUrl(options.url))) {
    onLog?.('Menggunakan gallery engine untuk gambar, carousel, story, Reel, dan post campuran.', false);
    return downloadGallery({ url: options.url, cookieConfig: options.cookieConfig, outputDirectory: options.outputDirectory, onProgress, onLog, signal });
  }
  try {
    return await downloadWithYtDlp({ ytDlp, ytDlpPath, options, onProgress, onLog, signal });
  } catch (ytDlpError) {
    if (!mayUseGallery) throw ytDlpError;
    onLog?.('yt-dlp tidak dapat menangani media ini; mencoba gallery engine...', true);
    try {
      return await downloadGallery({ url: options.url, cookieConfig: options.cookieConfig, outputDirectory: options.outputDirectory, onProgress, onLog, signal });
    } catch (galleryError) {
      throw new Error(`${ytDlpError instanceof Error ? ytDlpError.message : String(ytDlpError)} Gallery fallback: ${galleryError instanceof Error ? galleryError.message : String(galleryError)}`);
    }
  }
}
