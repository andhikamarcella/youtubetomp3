import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, render, useApp, useInput } from 'ink';
import { renderBrand } from './branding.js';
import {
  cookieSourceLabel,
  cookieSourcesForPlatform,
  resolveCookieConfigs,
} from './cookies.js';
import { inspectDependencies, prepareTermuxDependencies } from './dependencies.js';
import { disposePreparedCookieConfig, prepareManagedCookieConfig } from './managed-browser.js';
import { downloadMedia, inspectMedia } from './media-controller.js';
import { progressPhase, progressSummary, spinnerFrame } from './progress-ui.js';
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
import {
  SOCIAL_PLATFORM_KEYS,
  detectSocialPlatform,
  socialPlatformLabel,
  socialPlatformSummary,
} from './social-platforms.js';
import { socialLoginHint } from './social-sessions.js';
import { copyText, openOutputFile, openOutputLocation } from './system-actions.js';
import { readClipboardText } from './terminal-input.js';
import { sanitizeTerminalText } from './terminal-style.js';
import { CLI_VERSION } from './version.js';

const h = React.createElement;
const MODES = ['auto', 'video', 'audio', 'image'];
const VIDEO_QUALITIES = ['best', '2160', '1440', '1080', '720', '480', '360'];
const VIDEO_FORMATS = ['auto', 'mp4', 'mkv', 'webm'];
const AUDIO_FORMATS = ['mp3', 'm4a', 'aac', 'opus', 'flac', 'wav'];
const IMAGE_FORMATS = ['original', 'jpg', 'png', 'webp'];

export function terminalLayout(columns = 80, rows = 24) {
  if (columns && typeof columns === 'object') {
    rows = columns.rows;
    columns = columns.columns;
  }
  const width = Math.max(20, Number(columns) || 80);
  const height = Math.max(8, Number(rows) || 24);
  const panelWidth = Math.max(18, Math.min(88, width - 2));
  return {
    columns: width,
    rows: height,
    panelWidth,
    compactLogo: width < 78,
    tinyLogo: width < 42,
    showDetails: height >= 16,
    showShortcuts: height >= 21,
    minHeight: Math.max(7, height - 1),
  };
}

function safeText(value, maximumLength = 4096) {
  return sanitizeTerminalText(value, { maximumLength });
}

function cycle(values, current) {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length];
}

function validUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function cleanInput(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '')
    .replace(/[\r\n\t]/gu, '')
    .trimStart();
}

function firstUrl(value) {
  return cleanInput(value).match(/https?:\/\/[^\s]+/iu)?.[0] ?? '';
}

function appendInput(current, input) {
  const cleaned = cleanInput(input);
  if (!cleaned) return current;
  return firstUrl(cleaned) || `${current}${cleaned}`.slice(0, 4096);
}

function displayInput(value, width) {
  const chars = Array.from(value);
  const available = Math.max(8, width - 7);
  return chars.length <= available ? value : `…${chars.slice(-(available - 1)).join('')}`;
}

function parsePercent(value) {
  const number = Number.parseFloat(String(value).replace('%', '').trim());
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

function progressBar(percent, width = 38) {
  const complete = Math.round((parsePercent(percent) / 100) * width);
  return `${'█'.repeat(complete)}${'░'.repeat(Math.max(0, width - complete))}`;
}

function durationText(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

async function appendSessionLog(message, kind = 'info') {
  const target = process.env.YTCONV_LOG_FILE;
  if (!target) return;
  const line = `[${new Date().toISOString()}] [${kind}] ${sanitizeTerminalText(message, { allowNewlines: false })}\n`;
  await fs.mkdir(path.dirname(target), { recursive: true }).catch(() => {});
  await fs.appendFile(target, line, 'utf8').catch(() => {});
}

function Logo({ layout, account }) {
  const logo = renderBrand({
    compact: layout.compactLogo,
    tiny: layout.tinyLogo,
    width: layout.columns,
  });
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center' },
    h(Text, { bold: true }, logo),
    h(Text, { bold: true }, 'paste a social link · download · convert · done'),
    !layout.tinyLogo
      ? h(Text, { dimColor: true }, 'YouTube · Instagram · Facebook · TikTok · X · Pinterest · Reddit · 30+ platforms')
      : null,
    h(Text, { dimColor: true }, `${safeText(account || 'local user', 120)} · private browser recovery · v${CLI_VERSION}`),
  );
}

function MediaCard({ media, panelWidth }) {
  if (!media) return null;
  const details = [media.platform, media.uploader, durationText(media.duration), media.engine]
    .filter(Boolean).join(' · ');
  return h(
    Box,
    { width: panelWidth, borderStyle: 'round', paddingX: 1, flexDirection: 'column' },
    h(Text, { bold: true, wrap: 'truncate-end' }, safeText(media.title || 'Media')),
    details ? h(Text, { dimColor: true, wrap: 'truncate-end' }, safeText(details)) : null,
  );
}

function HomeScreen({
  layout,
  url,
  inputError,
  actionMessage,
  platformHint,
  mode,
  resolution,
  videoFormat,
  audioFormat,
  audioQuality,
  imageFormat,
  subtitles,
  cookieSource,
  playlist,
}) {
  const { panelWidth, showDetails, showShortcuts } = layout;
  const platform = socialPlatformSummary({ selected: platformHint, url });
  const mediaSetting = mode === 'audio'
    ? `${audioFormat}/${audioQuality}`
    : mode === 'image'
      ? imageFormat.toUpperCase()
      : `${videoFormat}/${resolution}`;

  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', alignItems: 'center', marginTop: 1 },
    h(Text, { bold: true }, 'Paste a supported social-media URL'),
    h(
      Box,
      { width: panelWidth, borderStyle: 'double', paddingX: 1 },
      h(Text, null, '▣ '),
      h(Text, { wrap: 'truncate-end' }, displayInput(url, panelWidth) || h(Text, { dimColor: true }, 'https://...')),
      h(Text, { inverse: true }, ' '),
    ),
    inputError ? h(Text, { color: 'red', bold: true, wrap: 'wrap' }, `! ${inputError}`) : null,
    actionMessage ? h(Text, { wrap: 'wrap' }, `✓ ${safeText(actionMessage)}`) : null,
    showDetails ? h(Text, { dimColor: true }, `${platform} · mode:${mode} · format:${mediaSetting}`) : null,
    showDetails ? h(Text, { dimColor: true },
      `subs:${subtitles ? 'on' : 'off'} · access:${cookieSourceLabel(cookieSource)} · playlist:${playlist ? 'on' : 'off'}`) : null,
    h(Box, { marginTop: 1, borderStyle: 'round', paddingX: 2 },
      h(Text, { inverse: true, bold: true }, ' ENTER  DOWNLOAD / CONVERT ')),
    showShortcuts ? h(Text, { dimColor: true }, 'Ctrl+M mode · Ctrl+A audio · Ctrl+T video · Ctrl+Q quality · Ctrl+F image') : null,
    showShortcuts ? h(Text, { dimColor: true }, 'Ctrl+G platform · Ctrl+B access · Ctrl+S subtitles · Ctrl+P playlist · Ctrl+V paste') : null,
    h(Text, { dimColor: true }, 'H help · D diagnostics · Q/Esc exit'),
  );
}

function WorkingScreen({ stage, media, progress, statusText, panelWidth }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((current) => current + 1), 90);
    return () => clearInterval(timer);
  }, []);

  const phase = progressPhase(stage, statusText);
  const percent = progress.percent || '0%';
  const width = Math.max(10, Math.min(44, panelWidth - 6));

  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', alignItems: 'center', marginTop: 1 },
    h(MediaCard, { media, panelWidth }),
    h(
      Box,
      { width: panelWidth, marginTop: 1, borderStyle: 'round', paddingX: 1, flexDirection: 'column', alignItems: 'center' },
      h(Text, { bold: true }, `${spinnerFrame(tick)} ${phase}`),
      h(Text, { bold: true }, progressBar(percent, width)),
      h(Text, { dimColor: true }, progressSummary(progress)),
      h(Text, { wrap: 'truncate-end' }, safeText(statusText || (
        stage === 'probing'
          ? 'detecting platform and choosing the best engine'
          : 'downloading media and preparing the selected output'
      ))),
      h(Text, { dimColor: true }, stage === 'probing'
        ? 'Public access is tried first. Browser login appears only when required.'
        : 'Download, merge, extraction and conversion progress update automatically.'),
    ),
    h(Text, { dimColor: true }, 'Esc/Ctrl+C cancels safely'),
  );
}

function DoneScreen({ media, panelWidth, outputDirectory, outputPath, actionMessage }) {
  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', alignItems: 'center', marginTop: 1 },
    h(MediaCard, { media, panelWidth }),
    h(Box, { width: panelWidth, marginTop: 1, borderStyle: 'double', paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true }, '✓ download and conversion complete'),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, safeText(outputPath || outputDirectory))),
    actionMessage ? h(Text, null, safeText(actionMessage)) : null,
    h(Text, { dimColor: true }, 'O open folder · F open file · C copy path · R another URL · Q exit'),
  );
}

function ErrorScreen({ error, media, panelWidth, cookieSource, actionMessage, url }) {
  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', alignItems: 'center', marginTop: 1 },
    h(MediaCard, { media, panelWidth }),
    h(Box, { width: panelWidth, marginTop: 1, borderStyle: 'double', borderColor: 'red', paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true, color: 'red' }, '× download failed'),
      h(Text, { color: 'red', wrap: 'wrap' }, safeText(error)),
      h(Text, { dimColor: true }, `access: ${cookieSourceLabel(cookieSource)}`)),
    actionMessage ? h(Text, null, safeText(actionMessage)) : null,
    socialLoginHint(url) ? h(Text, null, socialLoginHint(url)) : null,
    h(Text, { dimColor: true }, 'L official browser login · R retry · E edit URL · D diagnostics · Q exit'),
  );
}

function LoginScreen({ handoff, panelWidth, actionMessage }) {
  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', alignItems: 'center', marginTop: 1 },
    h(Box, { width: panelWidth, borderStyle: 'double', paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true }, `${safeText(handoff.label)} official sign-in`),
      h(Text, { wrap: 'wrap' }, 'Finish login, OTP or 2FA in the browser window that YTConv opened.'),
      h(Text, { dimColor: true }, `Browser: ${safeText(handoff.browserDisplay || handoff.browserSpec)}`),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, safeText(handoff.loginUrl))),
    actionMessage ? h(Text, null, safeText(actionMessage)) : null,
    h(Text, { bold: true }, 'Enter verify and retry · B another browser · Q exit'),
    h(Text, { dimColor: true }, 'Passwords and OTP codes never enter YTConv. Temporary cookies are deleted after the attempt.'),
  );
}

function HelpScreen({ panelWidth, termux }) {
  const rows = [
    ['Ctrl+M', 'cycle AUTO / VIDEO / AUDIO / IMAGE'],
    ['Ctrl+A', 'cycle audio format and switch to AUDIO'],
    ['Ctrl+T', 'cycle video container and switch to VIDEO'],
    ['Ctrl+Q', 'cycle video resolution'],
    ['Ctrl+F', 'cycle image format and switch to IMAGE'],
    ['Ctrl+G', 'cycle AUTO and supported social platforms'],
    ['Ctrl+B', 'cycle public/file/browser access'],
    ['Ctrl+S', 'toggle subtitles; default is OFF'],
    ['Ctrl+P', 'toggle playlists'],
    ['Ctrl+V', 'paste a URL from clipboard'],
  ];
  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', marginTop: 1 },
    h(Text, { bold: true }, `YTConv ${CLI_VERSION} help`),
    ...rows.map(([key, description]) => h(Box, { key, flexDirection: 'row' },
      h(Box, { width: 14 }, h(Text, { bold: true }, key)),
      h(Text, { dimColor: true }, description))),
    h(Text, { dimColor: true }, termux
      ? 'Termux downloads public URLs. Private Android browser sessions cannot be read directly.'
      : 'AUTO tries public access first and asks for official browser login only when necessary.'),
    h(Text, null, 'B back · Q exit'),
  );
}

function DiagnosticsScreen({ dependencies, panelWidth, outputDirectory, cookieSource, platformHint, mode, subtitles }) {
  const rows = [
    ['YTConv', CLI_VERSION],
    ['Node.js', dependencies.node?.version || process.version],
    ['Device', dependencies.platform?.termux ? 'Android Termux' : `${process.platform} ${process.arch}`],
    ['Platform', socialPlatformLabel(platformHint)],
    ['Mode', mode],
    ['Subtitles', subtitles ? 'on' : 'off'],
    ['yt-dlp', dependencies.ytDlp.version || 'not found'],
    ['gallery-dl', dependencies.galleryDl?.version || 'not found'],
    ['FFmpeg', dependencies.ffmpeg.version || 'not found'],
    ['Output', outputDirectory],
    ['Access', cookieSourceLabel(cookieSource)],
  ];
  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', marginTop: 1 },
    h(Text, { bold: true }, 'YTConv diagnostics'),
    ...rows.map(([label, value]) => h(Box, { key: label, flexDirection: 'row' },
      h(Box, { width: 15 }, h(Text, { bold: true }, label)),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, safeText(value)))),
    h(Text, null, 'B back · Q exit'),
  );
}

function MissingDependencies({ dependencies, panelWidth }) {
  return h(
    Box,
    { width: panelWidth, borderStyle: 'double', borderColor: 'red', paddingX: 1, flexDirection: 'column' },
    h(Text, { bold: true, color: 'red' }, '! Automatic setup is incomplete'),
    h(Text, { color: 'red' }, `Missing: ${safeText((dependencies.missing || []).join(', ') || 'media engines')}`),
    h(Text, { bold: true }, 'Run: ytconv repair'),
    h(Text, { dimColor: true }, 'Q/Esc exit'),
  );
}

function App({
  dependencies,
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
}) {
  const { exit } = useApp();
  const controllerRef = useRef(null);
  const submittedRef = useRef(false);
  const termux = dependencies.platform?.termux ?? isTermux();
  const cookieOptions = cookieSourcesForPlatform(termux);

  const [layout, setLayout] = useState(() => terminalLayout(process.stdout.columns, process.stdout.rows));
  const [url, setUrl] = useState(initialUrl);
  const [stage, setStage] = useState('home');
  const [returnStage, setReturnStage] = useState('home');
  const [platformHint, setPlatformHint] = useState(SOCIAL_PLATFORM_KEYS.includes(initialPlatform) ? initialPlatform : 'auto');
  const [mode, setMode] = useState(MODES.includes(initialMode) ? initialMode : 'auto');
  const [resolution, setResolution] = useState(VIDEO_QUALITIES.includes(initialResolution) ? initialResolution : 'best');
  const [videoFormat, setVideoFormat] = useState(VIDEO_FORMATS.includes(initialVideoFormat) ? initialVideoFormat : 'auto');
  const [audioFormat, setAudioFormat] = useState(AUDIO_FORMATS.includes(initialAudioFormat) ? initialAudioFormat : 'mp3');
  const [audioQuality] = useState(initialAudioQuality || 'best');
  const [imageFormat, setImageFormat] = useState(IMAGE_FORMATS.includes(initialImageFormat) ? initialImageFormat : 'original');
  const [subtitles, setSubtitles] = useState(Boolean(initialSubtitles));
  const [writeThumbnail] = useState(Boolean(initialWriteThumbnail));
  const [cookieSource, setCookieSource] = useState(process.env.YTCONV_COOKIES ? 'file' : 'auto');
  const [playlist, setPlaylist] = useState(Boolean(initialPlaylist));
  const [inputError, setInputError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [media, setMedia] = useState(null);
  const [progress, setProgress] = useState({ percent: '0%', speed: '', eta: '' });
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [loginHandoff, setLoginHandoff] = useState(null);

  const outputDirectory = process.env.YTCONV_OUTPUT
    ? path.resolve(process.env.YTCONV_OUTPUT)
    : (termux ? termuxSharedDownloadsDirectory() : desktopDownloadsDirectory());
  const ready = dependencies.ytDlp.installed && dependencies.ffmpeg.installed && dependencies.galleryDl?.installed;

  useEffect(() => {
    const resize = () => setLayout(terminalLayout(process.stdout.columns, process.stdout.rows));
    process.stdout.on?.('resize', resize);
    return () => process.stdout.off?.('resize', resize);
  }, []);

  const quit = () => {
    controllerRef.current?.abort();
    exit();
  };

  const reset = () => {
    controllerRef.current?.abort();
    setUrl('');
    setStage('home');
    setInputError('');
    setActionMessage('');
    setMedia(null);
    setProgress({ percent: '0%', speed: '', eta: '' });
    setStatusText('');
    setError('');
    setOutputPath('');
    setLoginHandoff(null);
  };

  const showOverlay = (next) => {
    if (stage !== 'help' && stage !== 'diagnostics') setReturnStage(stage);
    setStage(next);
  };

  const paste = () => {
    const value = readClipboardText({ termux });
    if (!value) {
      setInputError(termux ? 'Long-press in Termux and choose Paste.' : 'Clipboard text could not be read.');
      return;
    }
    setUrl((current) => appendInput(current, value));
    setInputError('');
    setActionMessage('link pasted');
  };

  const startDownload = async (candidate = url, {
    cookieConfigsOverride = null,
    allowLoginRecovery = true,
    pendingHandoff = null,
  } = {}) => {
    const value = candidate.trim();
    if (!validUrl(value)) {
      setInputError('Paste a valid HTTP or HTTPS link.');
      setStage('home');
      return;
    }
    if (!ready || stage === 'probing' || stage === 'downloading') return;

    setInputError('');
    setActionMessage('');
    setError('');
    setMedia(null);
    setOutputPath('');
    setProgress({ percent: '0%', speed: '', eta: '' });
    await appendSessionLog(`START ${value} mode=${mode}`);

    let cookieConfigs;
    try {
      await fs.mkdir(outputDirectory, { recursive: true });
      cookieConfigs = cookieConfigsOverride
        || await resolveCookieConfigs({ source: cookieSource, outputDirectory, url: value });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStage('error');
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    let lastError = null;

    try {
      for (let index = 0; index < cookieConfigs.length; index += 1) {
        const configuredCookie = cookieConfigs[index];
        let cookieConfig = configuredCookie;
        const platformKey = platformHint === 'auto' ? detectSocialPlatform(value) : platformHint;
        setStage('probing');
        setStatusText(`${socialPlatformLabel(platformKey)} · trying ${configuredCookie.label}`);

        try {
          cookieConfig = await prepareManagedCookieConfig(configuredCookie);
          const inspected = await inspectMedia({
            ytDlpPath: dependencies.ytDlp.path,
            url: value,
            cookieConfig,
            playlist,
            signal: controller.signal,
            mode,
            platformHint,
          });
          setMedia(inspected);
          setStage('downloading');
          setStatusText(`${inspected.platform || socialPlatformLabel(platformKey)} · ${cookieConfig.label}`);

          const result = await downloadMedia({
            ytDlpPath: dependencies.ytDlp.path,
            signal: controller.signal,
            options: {
              url: value,
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
              ffmpegPath: dependencies.ffmpeg.path,
            },
            onProgress: setProgress,
            onLog: (line, isError) => {
              void appendSessionLog(line, isError ? 'error' : 'info');
              if (/Saved:|Destination:|Downloading|gallery|image|carousel|Merger|ExtractAudio|VideoRemuxer|FFmpeg|Convert|SponsorBlock/iu.test(line)) {
                setStatusText(line);
              }
            },
          });

          const finalPath = result.outputPath || outputDirectory;
          setOutputPath(finalPath);
          setProgress((current) => ({ ...current, percent: '100%' }));
          setStatusText(`${result.fileCount || 1} file · ${result.engine || 'done'}`);
          if (pendingHandoff) {
            try {
              await confirmSocialLoginHandoff(pendingHandoff);
              setLoginHandoff(null);
              setActionMessage(`${pendingHandoff.label} session verified on this device.`);
            } catch (linkError) {
              setActionMessage(`Download succeeded, but the browser link could not be saved: ${linkError instanceof Error ? linkError.message : String(linkError)}`);
            }
          }
          setStage('done');
          await appendSessionLog(`DONE ${finalPath}`);
          return;
        } catch (caught) {
          if (controller.signal.aborted) return;
          lastError = caught;
          void appendSessionLog(caught instanceof Error ? caught.message : String(caught), 'error');
          if (cookieConfigs[index + 1]) {
            setStatusText(`access failed · trying ${cookieConfigs[index + 1].label}`);
          }
        } finally {
          await disposePreparedCookieConfig(cookieConfig);
        }
      }

      throw lastError || new Error('No media engine could process this URL.');
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (allowLoginRecovery && cookieSource === 'auto' && isSocialAuthenticationFailure(caught)) {
        try {
          const handoff = await beginSocialLoginHandoff({ url: value });
          if (handoff) {
            setLoginHandoff(handoff);
            setActionMessage('Finish the official browser sign-in, then press Enter.');
            setStage('login');
            return;
          }
        } catch (loginError) {
          setActionMessage(loginError instanceof Error ? loginError.message : String(loginError));
        }
      }
      setError(caught instanceof Error ? caught.message : String(caught));
      setStage('error');
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const verifyLogin = () => {
    if (!loginHandoff) return;
    setActionMessage(`verifying ${loginHandoff.label} session...`);
    void startDownload(url, {
      cookieConfigsOverride: [loginHandoff.cookieConfig],
      allowLoginRecovery: false,
      pendingHandoff: loginHandoff,
    });
  };

  const openLogin = async ({ nextBrowser = false } = {}) => {
    try {
      const alternatives = loginHandoff?.alternatives || [];
      const currentIndex = alternatives.indexOf(loginHandoff?.browserSpec);
      const browserSpec = nextBrowser && alternatives.length > 1
        ? alternatives[(Math.max(0, currentIndex) + 1) % alternatives.length]
        : loginHandoff?.browserSpec;
      const handoff = await beginSocialLoginHandoff({ url, browserSpec });
      if (!handoff) return;
      setLoginHandoff(handoff);
      setActionMessage('Finish the official sign-in, then press Enter.');
      setStage('login');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStage('error');
    }
  };

  useEffect(() => {
    if (!initialUrl || submittedRef.current || !ready) return;
    submittedRef.current = true;
    void startDownload(initialUrl);
  }, [initialUrl, ready]);

  useInput((input, key) => {
    const lower = input.toLowerCase();
    if (key.escape || (key.ctrl && lower === 'c')) return quit();
    if (lower === 'q' && stage !== 'home') return quit();

    if (stage === 'help' || stage === 'diagnostics') {
      if (lower === 'b' || key.backspace) setStage(returnStage);
      return;
    }

    if (lower === 'h' && stage !== 'probing' && stage !== 'downloading') return showOverlay('help');
    if (lower === 'd' && stage !== 'probing' && stage !== 'downloading') return showOverlay('diagnostics');
    if (!ready) return;

    if (stage === 'login') {
      if (key.return) verifyLogin();
      else if (lower === 'b') void openLogin({ nextBrowser: true });
      return;
    }

    if (stage === 'done') {
      if (lower === 'o') void openOutputLocation({ directory: outputDirectory, filePath: outputPath });
      else if (lower === 'f') void openOutputFile(outputPath);
      else if (lower === 'c') setActionMessage(copyText(outputPath || outputDirectory, { termux }) ? 'path copied' : 'copy failed');
      else if (lower === 'r') reset();
      return;
    }

    if (stage === 'error') {
      if (lower === 'r') void startDownload(url);
      else if (lower === 'l') void openLogin();
      else if (lower === 'e') setStage('home');
      return;
    }

    if (stage !== 'home') return;
    if (key.return) return void startDownload(url);
    if (key.ctrl && lower === 'v') return paste();
    if (key.ctrl && lower === 'm') return setMode((current) => cycle(MODES, current));
    if (key.ctrl && lower === 'a') {
      setAudioFormat((current) => cycle(AUDIO_FORMATS, current));
      setMode('audio');
      return;
    }
    if (key.ctrl && lower === 't') {
      setVideoFormat((current) => cycle(VIDEO_FORMATS, current));
      setMode('video');
      return;
    }
    if (key.ctrl && lower === 'q') return setResolution((current) => cycle(VIDEO_QUALITIES, current));
    if (key.ctrl && lower === 'f') {
      setImageFormat((current) => cycle(IMAGE_FORMATS, current));
      setMode('image');
      return;
    }
    if (key.ctrl && lower === 'g') return setPlatformHint((current) => cycle(SOCIAL_PLATFORM_KEYS, current));
    if (key.ctrl && lower === 'b') return setCookieSource((current) => cycle(cookieOptions, current));
    if (key.ctrl && lower === 's') return setSubtitles((current) => !current);
    if (key.ctrl && lower === 'p') return setPlaylist((current) => !current);
    if (key.backspace || key.delete) return setUrl((current) => Array.from(current).slice(0, -1).join(''));
    if (input && !key.ctrl && !key.meta) setUrl((current) => appendInput(current, input));
  });

  let content;
  if (!ready) content = h(MissingDependencies, { dependencies, panelWidth: layout.panelWidth });
  else if (stage === 'home') content = h(HomeScreen, {
    layout,
    url,
    inputError,
    actionMessage,
    platformHint,
    mode,
    resolution,
    videoFormat,
    audioFormat,
    audioQuality,
    imageFormat,
    subtitles,
    cookieSource,
    playlist,
  });
  else if (stage === 'probing' || stage === 'downloading') content = h(WorkingScreen, {
    stage, media, progress, statusText, panelWidth: layout.panelWidth,
  });
  else if (stage === 'done') content = h(DoneScreen, {
    media, panelWidth: layout.panelWidth, outputDirectory, outputPath, actionMessage,
  });
  else if (stage === 'login' && loginHandoff) content = h(LoginScreen, {
    handoff: loginHandoff, panelWidth: layout.panelWidth, actionMessage,
  });
  else if (stage === 'help') content = h(HelpScreen, { panelWidth: layout.panelWidth, termux });
  else if (stage === 'diagnostics') content = h(DiagnosticsScreen, {
    dependencies,
    panelWidth: layout.panelWidth,
    outputDirectory,
    cookieSource,
    platformHint,
    mode,
    subtitles,
  });
  else content = h(ErrorScreen, {
    error, media, panelWidth: layout.panelWidth, cookieSource, actionMessage, url,
  });

  return h(
    Box,
    { width: '100%', minHeight: layout.minHeight, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
    h(Logo, { layout, account: process.env.YTCONV_ACCOUNT_LABEL }),
    content,
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enterAlternateScreen() {
  if (!process.stdout.isTTY) return false;
  process.stdout.write('\u001b[?1049h\u001b[2J\u001b[H');
  return true;
}

function leaveAlternateScreen(enabled) {
  if (enabled && process.stdout.writable) process.stdout.write('\u001b[?1049l');
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
  process.stdout.write('Preparing YTConv...\r');
  let dependencies = await inspectDependencies();

  if (dependencies.platform?.termux
    && (!dependencies.ytDlp.installed || !dependencies.ffmpeg.installed || !dependencies.galleryDl?.installed)) {
    console.clear();
    console.log('YTConv first-run setup for Termux');
    console.log('Installing Python, yt-dlp, gallery-dl and FFmpeg. Please wait...\n');
    try {
      await prepareTermuxDependencies();
    } catch (error) {
      console.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`);
      await sleep(1500);
    }
    dependencies = await inspectDependencies();
  }

  const alternate = enterAlternateScreen();
  let instance;
  try {
    console.clear();
    instance = render(h(App, {
      dependencies,
      initialUrl,
      initialMode,
      initialPlaylist,
      initialImageFormat,
      initialPlatform,
      initialAudioFormat,
      initialAudioQuality,
      initialVideoFormat,
      initialResolution,
      initialSubtitles,
      initialWriteThumbnail,
    }), { exitOnCtrlC: false });
    await instance.waitUntilExit();
  } finally {
    instance?.unmount();
    leaveAlternateScreen(alternate);
  }
}
