import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { resolveCookieConfigs } from './cookies.js';
import { inspectDependencies, prepareTermuxDependencies } from './dependencies.js';
import {
  disposePreparedCookieConfig,
  prepareManagedCookieConfig,
} from './managed-browser.js';
import { downloadMedia, inspectMedia } from './media-controller.js';
import {
  beginSocialLoginHandoff,
  confirmSocialLoginHandoff,
  isSocialAuthenticationFailure,
} from './social-auth.js';
import {
  desktopDownloadsDirectory,
  isTermux,
  termuxSharedDownloadsDirectory,
} from './platform.js';
import { detectSocialPlatform, socialPlatformLabel } from './social-platforms.js';
import { openOutputLocation } from './system-actions.js';
import { sanitizeTerminalText } from './terminal-style.js';
import { CLI_VERSION } from './version.js';

const MODES = Object.freeze(['auto', 'video', 'audio', 'image']);
const VIDEO_FORMATS = Object.freeze(['auto', 'mp4', 'mkv', 'webm']);
const VIDEO_QUALITIES = Object.freeze(['best', '2160', '1440', '1080', '720', '480', '360']);
const AUDIO_FORMATS = Object.freeze(['mp3', 'm4a', 'aac', 'opus', 'flac', 'wav']);
const IMAGE_FORMATS = Object.freeze(['original', 'jpg', 'png', 'webp']);

export function terminalLayout(columns = 80, rows = 24) {
  if (columns && typeof columns === 'object') {
    rows = columns.rows;
    columns = columns.columns;
  }
  const width = Math.max(20, Number(columns) || 80);
  const height = Math.max(8, Number(rows) || 24);
  const panelWidth = Math.max(18, Math.min(82, width - 2));
  return {
    columns: width,
    rows: height,
    panelWidth,
    stackedControls: panelWidth < 48,
    compactLogo: width < 78,
    tinyLogo: width < 40,
    minHeight: Math.max(7, height - 1),
    showTagline: height >= 14,
    showDetails: height >= 17,
    showShortcuts: height >= 22 && width >= 48,
  };
}

function safeText(value, maximumLength = 4096) {
  return sanitizeTerminalText(value, { maximumLength, allowNewlines: false });
}

function validUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function defaultOutputDirectory() {
  if (process.env.YTCONV_OUTPUT) return path.resolve(process.env.YTCONV_OUTPUT);
  return isTermux() ? termuxSharedDownloadsDirectory() : desktopDownloadsDirectory();
}

function printBanner() {
  const width = Math.max(48, Math.min(78, process.stdout.columns || 72));
  const line = '═'.repeat(width - 2);
  console.log(`╔${line}╗`);
  console.log(`║ ${`YTConv ${CLI_VERSION}`.padEnd(width - 4)} ║`);
  console.log(`║ ${'YouTube MP4 · YouTube Music MP3 · social media downloader'.padEnd(width - 4)} ║`);
  console.log(`╚${line}╝`);
  console.log('Dependency-free terminal interface · public access first · local processing\n');
}

function normalizedChoice(value, choices, fallback) {
  const candidate = String(value || '').trim().toLowerCase();
  return choices.includes(candidate) ? candidate : fallback;
}

async function ask(terminal, label, fallback = '') {
  const suffix = fallback ? ` [${fallback}]` : '';
  const answer = await terminal.question(`${label}${suffix}: `);
  return String(answer || '').trim() || fallback;
}

async function choose(terminal, label, choices, fallback) {
  const answer = await ask(terminal, `${label} (${choices.join('/')})`, fallback);
  const selected = normalizedChoice(answer, choices, fallback);
  if (selected !== String(answer).toLowerCase()) {
    console.log(`Using ${fallback}; "${safeText(answer, 80)}" is not a supported choice.`);
  }
  return selected;
}

async function confirm(terminal, label, fallback = false) {
  const defaultLabel = fallback ? 'Y/n' : 'y/N';
  const answer = (await terminal.question(`${label} [${defaultLabel}]: `)).trim().toLowerCase();
  if (!answer) return fallback;
  return ['y', 'yes', '1', 'true'].includes(answer);
}

function progressPrinter() {
  let previous = '';
  return ({ percent = '', speed = '', eta = '', total = '' } = {}) => {
    const line = [percent || '...', total, speed, eta ? `ETA ${eta}` : ''].filter(Boolean).join(' · ');
    if (!line || line === previous) return;
    previous = line;
    console.log(`  ${safeText(line, 300)}`);
  };
}

async function appendSessionLog(message, kind = 'info') {
  const target = process.env.YTCONV_LOG_FILE;
  if (!target) return;
  const line = `[${new Date().toISOString()}] [${kind}] ${safeText(message)}\n`;
  await fs.mkdir(path.dirname(target), { recursive: true }).catch(() => {});
  await fs.appendFile(target, line, 'utf8').catch(() => {});
}

function downloadOptions({
  url,
  mode,
  platformHint,
  resolution,
  videoFormat,
  audioFormat,
  audioQuality,
  imageFormat,
  subtitles,
  writeThumbnail,
  playlist,
  outputDirectory,
  ffmpegPath,
  cookieConfig,
}) {
  return {
    url,
    mode,
    platformHint,
    resolution,
    videoFormat,
    audioFormat,
    audioQuality,
    imageFormat,
    subtitles,
    subtitleLanguages: process.env.YTCONV_SUBTITLE_LANGS || 'all,-live_chat',
    writeThumbnail,
    cookieConfig,
    playlist,
    outputDirectory,
    ffmpegPath,
    archivePath: process.env.YTCONV_ARCHIVE || '',
    galleryArchivePath: process.env.YTCONV_GALLERY_ARCHIVE || '',
    sponsorBlockMode: process.env.YTCONV_SPONSORBLOCK_MODE || 'off',
    retrySleep: process.env.YTCONV_RETRY_SLEEP || 'linear=1::2',
  };
}

async function attemptDownload({
  url,
  settings,
  dependencies,
  configuredCookie,
  pendingHandoff = null,
  signal,
}) {
  let cookieConfig = configuredCookie;
  try {
    cookieConfig = await prepareManagedCookieConfig(configuredCookie);
    const platform = settings.platformHint === 'auto'
      ? detectSocialPlatform(url)
      : settings.platformHint;
    console.log(`\nInspecting ${socialPlatformLabel(platform)} with ${cookieConfig.label || 'public access'}...`);
    const media = await inspectMedia({
      ytDlpPath: dependencies.ytDlp.path,
      url,
      cookieConfig,
      playlist: settings.playlist,
      signal,
      mode: settings.mode,
      platformHint: settings.platformHint,
    });
    console.log(`Title   : ${safeText(media.title || 'Untitled', 300)}`);
    console.log(`Platform: ${safeText(media.platform || socialPlatformLabel(platform), 120)}`);
    console.log(`Engine  : ${safeText(media.engine || 'auto', 80)}`);
    console.log(`Output  : ${settings.outputDirectory}`);

    const result = await downloadMedia({
      ytDlpPath: dependencies.ytDlp.path,
      signal,
      options: downloadOptions({
        url,
        ...settings,
        ffmpegPath: dependencies.ffmpeg.path,
        cookieConfig,
      }),
      onProgress: progressPrinter(),
      onLog: (line, isError) => {
        void appendSessionLog(line, isError ? 'error' : 'info');
        if (isError || /saved|fallback|engine|merger|extractaudio|videoremuxer|gallery|image/iu.test(line)) {
          console.log(`  ${isError ? '!' : '>'} ${safeText(line, 500)}`);
        }
      },
    });

    if (pendingHandoff) await confirmSocialLoginHandoff(pendingHandoff);
    const outputPath = result.outputPath || settings.outputDirectory;
    console.log(`\nCompleted: ${outputPath}`);
    console.log(`Files    : ${result.fileCount || 1}`);
    await appendSessionLog(`DONE ${outputPath}`);
    return { ...result, outputPath };
  } finally {
    await disposePreparedCookieConfig(cookieConfig);
  }
}

async function downloadWithRecovery({ terminal, url, settings, dependencies }) {
  const cookieSource = process.env.YTCONV_COOKIES ? 'file' : 'auto';
  const cookieConfigs = await resolveCookieConfigs({
    source: cookieSource,
    outputDirectory: settings.outputDirectory,
    url,
  });
  const controller = new AbortController();
  const abort = () => controller.abort(new Error('Cancelled by user.'));
  process.once('SIGINT', abort);
  let lastError;

  try {
    for (const configuredCookie of cookieConfigs) {
      try {
        return await attemptDownload({
          url,
          settings,
          dependencies,
          configuredCookie,
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) throw error;
        lastError = error;
        console.error(`  ! ${safeText(error instanceof Error ? error.message : String(error), 800)}`);
      }
    }

    if (lastError && isSocialAuthenticationFailure(lastError) && !isTermux()) {
      const openLogin = await confirm(terminal, 'Public access failed. Open the official provider login in a private YTConv browser?', false);
      if (openLogin) {
        const handoff = await beginSocialLoginHandoff({ url });
        if (handoff) {
          console.log(`Finish the official ${handoff.label} login in the opened browser.`);
          await terminal.question('Press Enter here after login is complete: ');
          return await attemptDownload({
            url,
            settings,
            dependencies,
            configuredCookie: handoff.cookieConfig,
            pendingHandoff: handoff,
            signal: controller.signal,
          });
        }
      }
    }

    throw lastError || new Error('No media engine could process this URL.');
  } finally {
    process.off('SIGINT', abort);
  }
}

async function prepareDependencies() {
  let dependencies = await inspectDependencies({ repair: true });
  if (dependencies.platform?.termux
    && (!dependencies.ytDlp.installed || !dependencies.ffmpeg.installed || !dependencies.galleryDl?.installed)) {
    console.log('Preparing Python, yt-dlp, gallery-dl, and FFmpeg for Termux...');
    await prepareTermuxDependencies();
    dependencies = await inspectDependencies({ repair: false });
  }
  if (!dependencies.ready) {
    const missing = dependencies.missing?.join(', ') || 'media engines';
    throw new Error(`YTConv could not prepare ${missing}. Run: ytconv repair, then ytconv doctor.`);
  }
  return dependencies;
}

export async function runApp({
  initialUrl = '',
  initialMode = 'auto',
  initialPlaylist = false,
  initialImageFormat = 'original',
  initialPlatform = 'auto',
  initialAudioFormat = 'mp3',
  initialAudioQuality = 'best',
  initialVideoFormat = 'auto',
  initialResolution = 'best',
  initialSubtitles = false,
  initialWriteThumbnail = false,
} = {}) {
  process.title = `YTConv ${CLI_VERSION}`;
  printBanner();
  const dependencies = await prepareDependencies();
  const terminal = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  try {
    let nextInitialUrl = String(initialUrl || '').trim();
    while (true) {
      let url = nextInitialUrl || await ask(terminal, 'Paste an HTTP or HTTPS media URL');
      nextInitialUrl = '';
      while (!validUrl(url)) {
        console.log('Please enter a valid HTTP or HTTPS URL. Type q to exit.');
        url = await ask(terminal, 'URL');
        if (['q', 'quit', 'exit'].includes(url.toLowerCase())) return;
      }

      const mode = await choose(terminal, 'Mode', MODES, normalizedChoice(initialMode, MODES, 'auto'));
      const videoFormat = mode === 'audio' || mode === 'image'
        ? normalizedChoice(initialVideoFormat, VIDEO_FORMATS, 'auto')
        : await choose(terminal, 'Video container', VIDEO_FORMATS, normalizedChoice(initialVideoFormat, VIDEO_FORMATS, 'auto'));
      const resolution = mode === 'audio' || mode === 'image'
        ? normalizedChoice(initialResolution, VIDEO_QUALITIES, 'best')
        : await choose(terminal, 'Maximum resolution', VIDEO_QUALITIES, normalizedChoice(initialResolution, VIDEO_QUALITIES, 'best'));
      const audioFormat = mode === 'audio'
        ? await choose(terminal, 'Audio format', AUDIO_FORMATS, normalizedChoice(initialAudioFormat, AUDIO_FORMATS, 'mp3'))
        : normalizedChoice(initialAudioFormat, AUDIO_FORMATS, 'mp3');
      const imageFormat = mode === 'image'
        ? await choose(terminal, 'Image format', IMAGE_FORMATS, normalizedChoice(initialImageFormat, IMAGE_FORMATS, 'original'))
        : normalizedChoice(initialImageFormat, IMAGE_FORMATS, 'original');
      const playlist = await confirm(terminal, 'Download playlists/carousels when the URL contains one?', Boolean(initialPlaylist));
      const subtitles = mode === 'audio' || mode === 'image'
        ? false
        : await confirm(terminal, 'Download subtitles when available?', Boolean(initialSubtitles));
      const writeThumbnail = await confirm(terminal, 'Save thumbnail/cover when available?', Boolean(initialWriteThumbnail));
      const outputDirectory = path.resolve(await ask(terminal, 'Output directory', defaultOutputDirectory()));
      await fs.mkdir(outputDirectory, { recursive: true });

      const settings = {
        mode,
        platformHint: initialPlatform || 'auto',
        resolution,
        videoFormat,
        audioFormat,
        audioQuality: initialAudioQuality || 'best',
        imageFormat,
        subtitles,
        writeThumbnail,
        playlist,
        outputDirectory,
      };

      try {
        await appendSessionLog(`START ${url} mode=${mode} video=${videoFormat}/${resolution} audio=${audioFormat}`);
        const result = await downloadWithRecovery({ terminal, url, settings, dependencies });
        if (await confirm(terminal, 'Open the output folder?', false)) {
          await openOutputLocation({ directory: outputDirectory, filePath: result.outputPath });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await appendSessionLog(message, 'error');
        console.error(`\nYTConv failed: ${safeText(message, 1200)}`);
      }

      if (!await confirm(terminal, '\nConvert another URL?', false)) return;
      console.log('');
    }
  } finally {
    terminal.close();
  }
}
