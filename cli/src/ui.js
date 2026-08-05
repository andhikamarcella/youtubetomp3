import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, render, useApp, useInput } from 'ink';
import {
  cookieSourceLabel,
  cookieSourcesForPlatform,
  resolveCookieConfigs,
} from './cookies.js';
import { inspectDependencies, prepareTermuxDependencies } from './dependencies.js';
import { disposePreparedCookieConfig, prepareManagedCookieConfig } from './managed-browser.js';
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
import {
  SOCIAL_PLATFORM_KEYS,
  detectSocialPlatform,
  socialPlatformLabel,
  socialPlatformSummary,
} from './social-platforms.js';
import { socialLoginHint } from './social-sessions.js';
import { copyText, openOutputFile, openOutputLocation } from './system-actions.js';
import { createTerminalInputDecoder, readClipboardText } from './terminal-input.js';
import { sanitizeTerminalText } from './terminal-style.js';
import { CLI_VERSION } from './version.js';


const h = React.createElement;
const MODES = ['auto', 'video', 'audio', 'image'];
const VIDEO_QUALITIES = ['best', '2160', '1440', '1080', '720', '480', '360'];
const VIDEO_FORMATS = ['auto', 'mp4', 'mkv', 'webm'];
const AUDIO_FORMATS = ['mp3', 'm4a', 'aac', 'opus', 'flac', 'wav'];
const IMAGE_FORMATS = ['original', 'jpg', 'png', 'webp'];
const EXIT_COMMANDS = new Set(['q', 'quit', 'exit', ':q']);
const OVERLAYS = new Set(['help', 'diagnostics']);

const LOGO_WIDE = [
  '██╗   ██╗████████╗ ██████╗ ██████╗ ███╗   ██╗██╗   ██╗',
  '╚██╗ ██╔╝╚══██╔══╝██╔════╝██╔═══██╗████╗  ██║██║   ██║',
  ' ╚████╔╝    ██║   ██║     ██║   ██║██╔██╗ ██║██║   ██║',
  '  ╚██╔╝     ██║   ╚██████╗╚██████╔╝██║╚████║╚██████╔╝',
  '   ╚═╝      ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═══╝ ╚═════╝ ',
].join('\n');
const LOGO_COMPACT = 'YTCONV';

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
  return sanitizeTerminalText(value, { maximumLength });
}

function cycle(values, current) {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length];
}

function isValidUrl(value) {
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

function applyText(current, incoming) {
  const cleaned = cleanInput(incoming);
  if (!cleaned) return current;
  const url = firstUrl(cleaned);
  return url || `${current}${cleaned}`.slice(0, 4096);
}

function displayInput(value, width) {
  const chars = Array.from(value);
  const available = Math.max(8, width - 5);
  return chars.length <= available ? value : `…${chars.slice(-(available - 1)).join('')}`;
}

function parsePercent(value) {
  const number = Number.parseFloat(String(value).replace('%', '').trim());
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

function progressBar(percent, width = 34) {
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

function Logo({ compact, tiny, account, showTagline }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center' },
    h(Text, { bold: true }, tiny ? 'YTCONV' : (compact ? LOGO_COMPACT : LOGO_WIDE)),
    showTagline ? h(Text, { bold: true }, 'paste a social link. convert. done.') : null,
    showTagline && !tiny ? h(Text, { dimColor: true }, 'YouTube · Instagram · Facebook · TikTok · X · Pinterest · Reddit · + more') : null,
    h(Box, { marginTop: tiny ? 0 : 1 },
      h(Text, { bold: true }, `● ${safeText(account || 'local user', 160)}`),
      h(Text, { dimColor: true }, ` · local device · v${CLI_VERSION}`)),
  );
}

function HomeScreen(props) {
  const {
    panelWidth,
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
    writeThumbnail,
    cookieSource,
    playlist,
    autoOpen,
    activeControl,
    stackedControls,
    showDetails,
    showShortcuts,
  } = props;
  const inputWidth = stackedControls ? panelWidth : Math.max(20, panelWidth - 14);
  const buttonFocused = activeControl === 'convert';
  const platform = socialPlatformSummary({ selected: platformHint, url });
  const mediaSetting = mode === 'audio'
    ? `audio:${audioFormat}/${audioQuality}`
    : mode === 'image'
      ? `image:${imageFormat.toUpperCase()}`
      : `video:${videoFormat}/${resolution}`;
  const inputControl = h(
    Box,
    {
      width: inputWidth,
      borderStyle: activeControl === 'input' ? 'double' : 'round',
      paddingX: 1,
    },
    h(Text, null, '▣ '),
    h(Text, { wrap: 'truncate-end' }, displayInput(url, inputWidth) || h(Text, { dimColor: true }, 'https://...')),
    activeControl === 'input' ? h(Text, { inverse: true }, ' ') : null,
  );
  const convertControl = h(
    Box,
    {
      width: stackedControls ? panelWidth : 12,
      marginLeft: stackedControls ? 0 : 1,
      marginTop: stackedControls ? 1 : 0,
      borderStyle: buttonFocused ? 'double' : 'round',
      justifyContent: 'center',
    },
    h(Text, { inverse: buttonFocused, bold: true }, buttonFocused ? '» convert «' : ' convert '),
  );
  const controls = h(
    Box,
    { width: panelWidth, flexDirection: stackedControls ? 'column' : 'row' },
    inputControl,
    convertControl,
  );

  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(Box, { width: panelWidth, paddingLeft: 1 }, h(Text, { bold: true }, 'Paste a social-media URL')),
    controls,
    inputError ? h(Text, { color: 'red', bold: true, wrap: 'wrap' }, `! ${inputError}`) : null,
    actionMessage ? h(Text, { wrap: 'wrap' }, `✓ ${safeText(actionMessage)}`) : null,
    showDetails ? h(
      Box,
      { marginTop: 1 },
      h(Text, { dimColor: true },
        `${platform} · mode:${mode} · ${mediaSetting}`
        + ` · subs:${subtitles ? 'on' : 'off'} · thumb:${writeThumbnail ? 'on' : 'auto'}`),
    ) : null,
    showDetails ? h(Text, { dimColor: true },
      `access:${cookieSourceLabel(cookieSource)} · playlist:${playlist ? 'on' : 'off'} · auto-open:${autoOpen ? 'on' : 'off'}`) : null,
    showShortcuts ? h(Text, { dimColor: true }, 'Ctrl+M mode · Ctrl+A audio · Ctrl+T container · Ctrl+Q quality') : null,
    showShortcuts ? h(Text, { dimColor: true }, 'Ctrl+S subtitles · Ctrl+N thumbnail · Ctrl+F images · Ctrl+G social') : null,
    showShortcuts ? h(Text, { dimColor: true }, 'Ctrl+B account access · Ctrl+P playlist · Ctrl+O auto-open · Ctrl+H help') : null,
  );
}

function MediaCard({ media, panelWidth }) {
  if (!media) return null;
  const details = [media.platform, media.uploader, durationText(media.duration), media.engine]
    .filter(Boolean).join(' · ');
  return h(
    Box,
    { width: panelWidth, borderStyle: 'round', paddingX: 1, flexDirection: 'column' },
    h(Text, { bold: true, wrap: 'truncate-end' }, safeText(media.title)),
    h(Text, { dimColor: true, wrap: 'truncate-end' }, safeText(`${details}${media.itemCount > 1 ? ` · ${media.itemCount} item` : ''}`)),
  );
}

function WorkingScreen({ stage, media, progress, statusText, panelWidth }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, panelWidth }),
    h(Box, { marginTop: 1, flexDirection: 'column', alignItems: 'center' },
      h(Text, { bold: true }, stage === 'probing' ? 'checking the social link...' : progressBar(progress.percent, Math.max(10, Math.min(34, panelWidth - 6)))),
      h(Text, { dimColor: true }, stage === 'probing'
        ? 'detecting platform and choosing the best engine'
        : [progress.percent || '0%', progress.speed, progress.eta ? `ETA ${progress.eta}` : ''].filter(Boolean).join(' · ')),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, safeText(statusText || 'please wait')),
    ),
    h(Text, { dimColor: true }, 'Esc/Ctrl+C cancels and exits'),
  );
}

function DoneScreen({ media, panelWidth, outputDirectory, outputPath, actionMessage }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, panelWidth }),
    h(Box, { marginTop: 1, borderStyle: 'double', width: panelWidth, paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true }, '✓ conversion complete'),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, safeText(outputPath || outputDirectory)),
    ),
    actionMessage ? h(Text, { wrap: 'wrap' }, actionMessage) : null,
    h(Text, { dimColor: true }, 'O open folder · F open file · C copy path · R another URL'),
    h(Text, { dimColor: true }, 'H help · D diagnostics · Q/Esc exit'),
  );
}

function ErrorScreen({ error, media, panelWidth, cookieSource, actionMessage, url }) {
  const loginHint = socialLoginHint(url);
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, panelWidth }),
    h(Box, { marginTop: 1, borderStyle: 'double', borderColor: 'red', width: panelWidth, paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true, color: 'red' }, '× conversion failed'),
      h(Text, { color: 'red', wrap: 'wrap' }, safeText(error)),
      h(Text, { dimColor: true }, `access: ${cookieSourceLabel(cookieSource)}`),
    ),
    actionMessage ? h(Text, { wrap: 'wrap' }, actionMessage) : null,
    h(Text, { dimColor: true }, 'L official login · B another browser · R retry · E edit URL · D diagnostics · Q/Esc exit'),
    loginHint ? h(Text, null, loginHint) : null,
    h(Text, { dimColor: true }, 'Account sessions remain in the browser under browser/OS encryption.'),
  );
}

function SocialLoginScreen({ handoff, panelWidth, actionMessage }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(Box, { borderStyle: 'double', width: panelWidth, paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true }, `${safeText(handoff.label, 160)} sign-in required`),
      h(Text, { wrap: 'wrap' }, 'The official login page is open in your browser. Finish sign-in and any OTP/2FA there.'),
      h(Text, null, `Browser: ${safeText(handoff.browserDisplay || handoff.browserSpec, 200)}`),
      h(Text, { dimColor: true, wrap: 'wrap' }, safeText(handoff.loginUrl, 2048)),
      h(Text, { dimColor: true, wrap: 'wrap' }, 'YTConv will verify this exact media URL before saving the browser/profile link.'),
    ),
    actionMessage ? h(Text, { wrap: 'wrap' }, safeText(actionMessage)) : null,
    h(Text, { bold: true }, 'Enter verify session and retry · B another browser · Q/Esc exit'),
    h(Text, { dimColor: true }, 'Passwords and OTP codes never enter YTConv. Temporary provider cookies stay local and are deleted after the attempt.'),
  );
}

function HelpScreen({ panelWidth, termux }) {
  const rows = [
    ['Ctrl+M', 'mode AUTO/VIDEO/AUDIO/IMAGE'],
    ['Ctrl+A / Ctrl+T', 'audio format / video container'],
    ['Ctrl+Q / Ctrl+F', 'video resolution / image format'],
    ['Ctrl+S / Ctrl+N', 'subtitles / separate thumbnail'],
    ['Ctrl+G', 'choose social platform / AUTO all platforms'],
    ['Ctrl+B', 'AUTO / public / legacy file / browser access'],
    ['Ctrl+P / Ctrl+O', 'playlist / open results automatically'],
    ['Enter/click', 'convert URL'],
    ['O / F / C', 'open folder / file / copy path'],
  ];
  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', marginTop: 1 },
    h(Text, { bold: true }, `YTConv ${CLI_VERSION} · keyboard help`),
    ...rows.map(([key, description]) => h(Box, { key, flexDirection: 'row' },
      h(Box, { width: 18 }, h(Text, { bold: true }, key)),
      h(Text, { dimColor: true }, description))),
    h(Text, { dimColor: true }, termux
      ? 'Termux cannot read private Android browser sessions. Public URLs can still be downloaded.'
      : 'AUTO tries public access, followed by the browser account linked with ytconv login PROVIDER.'),
    h(Text, null, 'B back · Q/Esc exit'),
  );
}

function DiagnosticsScreen({
  dependencies,
  panelWidth,
  outputDirectory,
  cookieSource,
  platformHint,
  mode,
  audioFormat,
  videoFormat,
  resolution,
  subtitles,
}) {
  const rows = [
    ['YTConv', CLI_VERSION],
    ['Node.js', `${dependencies.node?.version || process.version}${dependencies.node?.supported === false ? ' (unsupported)' : ''}`],
    ['npm', dependencies.npm?.version || 'not found'],
    ['Python', dependencies.python?.version || 'not found (optional)'],
    ['JS runtime', dependencies.javaScriptRuntimes?.map((runtime) => runtime.name).join(', ') || 'not found'],
    ['Device', dependencies.platform?.termux ? 'Android Termux' : `${process.platform} ${process.arch}`],
    ['Social', socialPlatformLabel(platformHint)],
    ['Mode', mode],
    ['Audio', audioFormat],
    ['Video', `${videoFormat}/${resolution}`],
    ['Subtitle', subtitles ? 'on' : 'off'],
    ['yt-dlp', dependencies.ytDlp.version || 'not found'],
    ['gallery-dl', dependencies.galleryDl?.version || 'not found'],
    ['FFmpeg', dependencies.ffmpeg.version || 'not found'],
    ['ffprobe', dependencies.ffprobe?.version || 'not found (optional)'],
    ['Browsers', dependencies.browsers?.map((browser) => browser.name || browser).join(', ') || 'none detected'],
    ['Output', outputDirectory],
    ['Account access', cookieSourceLabel(cookieSource)],
  ];
  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', marginTop: 1 },
    h(Text, { bold: true }, 'YTConv diagnostics'),
    ...rows.map(([label, value]) => h(Box, { key: label, flexDirection: 'row' },
      h(Box, { width: 16 }, h(Text, { bold: true }, label)),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, safeText(value)))),
    h(Text, null, 'B back · Q/Esc exit'),
  );
}

function MissingDependencies({ dependencies, panelWidth }) {
  const missing = dependencies.missing?.length ? dependencies.missing.join(', ') : 'media engines';
  const errors = (dependencies.errors || []).slice(0, 2);
  return h(
    Box,
    { width: panelWidth, borderStyle: 'double', borderColor: 'red', paddingX: 1, flexDirection: 'column' },
    h(Text, { bold: true, color: 'red' }, '! Automatic setup is incomplete'),
    h(Text, { color: 'red' }, `Not ready: ${safeText(missing)}`),
    ...errors.map((item) => h(Text, { key: item, dimColor: true, wrap: 'wrap' }, `• ${item}`)),
    h(Text, { bold: true }, 'Run: ytconv repair'),
    h(Text, { dimColor: true, wrap: 'wrap' }, dependencies.platform?.setupCommand || 'If repair still fails, run ytconv doctor and follow the displayed solution.'),
    h(Text, { dimColor: true }, 'Q/Esc/Ctrl+C exit'),
  );
}

function logoLines({ compactLogo, tinyLogo }) {
  if (tinyLogo) return 1;
  return (compactLogo ? LOGO_COMPACT : LOGO_WIDE).split('\n').filter(Boolean).length;
}

function controlBounds({ layout }) {
  const { columns, panelWidth, minHeight, stackedControls } = layout;
  const rootHeight = minHeight;
  const logoHeight = logoLines(layout) + (layout.showTagline ? 3 : 1);
  const homeHeight = 14;
  const rootTop = Math.max(1, Math.floor((rootHeight - logoHeight - homeHeight) / 2) + 1);
  const panelLeft = Math.max(1, Math.floor((columns - panelWidth) / 2) + 1);
  const inputWidth = stackedControls ? panelWidth : Math.max(20, panelWidth - 14);
  const inputTop = rootTop + logoHeight + 2;
  return {
    input: { left: panelLeft - 1, right: panelLeft + inputWidth, top: inputTop - 1, bottom: inputTop + 3 },
    convert: stackedControls
      ? { left: panelLeft - 1, right: panelLeft + panelWidth, top: inputTop + 3, bottom: inputTop + 7 }
      : { left: panelLeft + inputWidth, right: panelLeft + inputWidth + 13, top: inputTop - 1, bottom: inputTop + 3 },
  };
}

function inside(event, bounds) {
  return event.x >= bounds.left && event.x <= bounds.right && event.y >= bounds.top && event.y <= bounds.bottom;
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
  const termux = dependencies.platform?.termux ?? isTermux();
  const decoderRef = useRef(createTerminalInputDecoder());
  const controllerRef = useRef(null);
  const submittedRef = useRef(false);
  const cookieOptions = cookieSourcesForPlatform(termux);

  const [url, setUrl] = useState(initialUrl);
  const [stage, setStage] = useState('home');
  const [returnStage, setReturnStage] = useState('home');
  const [platformHint, setPlatformHint] = useState(
    SOCIAL_PLATFORM_KEYS.includes(initialPlatform) ? initialPlatform : 'auto',
  );
  const [mode, setMode] = useState(MODES.includes(initialMode) ? initialMode : 'auto');
  const [resolution, setResolution] = useState(
    VIDEO_QUALITIES.includes(initialResolution) ? initialResolution : 'best',
  );
  const [videoFormat, setVideoFormat] = useState(
    VIDEO_FORMATS.includes(initialVideoFormat) ? initialVideoFormat : 'auto',
  );
  const [audioFormat, setAudioFormat] = useState(
    AUDIO_FORMATS.includes(initialAudioFormat) ? initialAudioFormat : 'mp3',
  );
  const [audioQuality] = useState(initialAudioQuality || 'best');
  const [imageFormat, setImageFormat] = useState(
    IMAGE_FORMATS.includes(initialImageFormat) ? initialImageFormat : 'original',
  );
  const [subtitles, setSubtitles] = useState(Boolean(initialSubtitles));
  const [writeThumbnail, setWriteThumbnail] = useState(Boolean(initialWriteThumbnail));
  const [cookieSource, setCookieSource] = useState(process.env.YTCONV_COOKIES ? 'file' : 'auto');
  const [playlist, setPlaylist] = useState(Boolean(initialPlaylist));
  const [autoOpen, setAutoOpen] = useState(false);
  const [activeControl, setActiveControl] = useState('input');
  const [inputError, setInputError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [media, setMedia] = useState(null);
  const [progress, setProgress] = useState({ percent: '0%', speed: '', eta: '' });
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [loginHandoff, setLoginHandoff] = useState(null);
  const [terminalSize, setTerminalSize] = useState(() => terminalLayout(process.stdout.columns, process.stdout.rows));
  const {
    panelWidth, compactLogo, tinyLogo, stackedControls, minHeight,
    showTagline, showDetails, showShortcuts,
  } = terminalSize;
  const outputDirectory = process.env.YTCONV_OUTPUT
    ? path.resolve(process.env.YTCONV_OUTPUT)
    : (termux ? termuxSharedDownloadsDirectory() : desktopDownloadsDirectory());
  const hasDependencies = dependencies.ytDlp.installed
    && dependencies.ffmpeg.installed
    && dependencies.galleryDl?.installed;

  const quit = () => {
    controllerRef.current?.abort();
    exit();
  };

  useEffect(() => {
    const resize = () => setTerminalSize(terminalLayout(process.stdout.columns, process.stdout.rows));
    process.stdout.on?.('resize', resize);
    return () => process.stdout.off?.('resize', resize);
  }, []);

  const showOverlay = (next) => {
    if (!OVERLAYS.has(stage)) setReturnStage(stage);
    setStage(next);
  };

  const pasteClipboard = () => {
    const value = readClipboardText({ termux });
    if (!value) {
      setInputError(termux ? 'Long-press in Termux and choose Paste.' : 'The clipboard could not be read.');
      return;
    }
    setUrl((current) => applyText(current, value));
    setInputError('');
    setActionMessage('link pasted');
    setActiveControl('input');
  };

  const reset = () => {
    controllerRef.current?.abort();
    decoderRef.current.reset();
    setUrl('');
    setStage('home');
    setActiveControl('input');
    setInputError('');
    setActionMessage('');
    setMedia(null);
    setProgress({ percent: '0%', speed: '', eta: '' });
    setStatusText('');
    setError('');
    setOutputPath('');
    setLoginHandoff(null);
  };

  const openFolder = async () => {
    setActionMessage('opening output folder...');
    const result = await openOutputLocation({ directory: outputDirectory, filePath: outputPath });
    setActionMessage(result.ok ? `opened with ${result.label}` : `could not open folder: ${outputDirectory}`);
  };

  const openFile = async () => {
    const result = await openOutputFile(outputPath);
    setActionMessage(result.ok ? `opened with ${result.label}` : `could not open file: ${result.error?.message || outputPath}`);
  };

  const copyPath = () => {
    const target = outputPath || outputDirectory;
    setActionMessage(copyText(target, { termux }) ? 'output path copied' : `copy failed: ${target}`);
  };

  const startDownload = async (candidate = url, {
    cookieConfigsOverride = null,
    allowLoginRecovery = true,
    pendingHandoff = null,
  } = {}) => {
    const value = candidate.trim();
    if (EXIT_COMMANDS.has(value.toLowerCase())) return quit();
    if (!isValidUrl(value)) {
      setInputError('Paste a valid HTTP or HTTPS link.');
      setActiveControl('input');
      return;
    }
    if (!hasDependencies || ['probing', 'downloading'].includes(stage)) return;

    setInputError('');
    setActionMessage('');
    setError('');
    setMedia(null);
    setOutputPath('');
    setProgress({ percent: '0%', speed: '', eta: '' });
    await appendSessionLog(`START ${value} mode=${mode} audio=${audioFormat}/${audioQuality} video=${videoFormat}/${resolution}`);

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
              if (/Saved:/u.test(line)) setStatusText(line);
              else if (/gallery|image|carousel|Merger|ExtractAudio|VideoRemuxer|SponsorBlock/iu.test(line)) setStatusText(line);
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
              setActionMessage(`${pendingHandoff.label} session verified and linked on this device.`);
            } catch (linkError) {
              setActionMessage(`Download succeeded, but the verified browser link could not be saved: ${linkError instanceof Error ? linkError.message : String(linkError)}`);
            }
          }
          setStage('done');
          await appendSessionLog(`DONE ${finalPath}`);
          if (autoOpen) await openOutputLocation({ directory: outputDirectory, filePath: finalPath });
          return;
        } catch (caught) {
          if (controller.signal.aborted) return;
          lastError = caught;
          void appendSessionLog(caught instanceof Error ? caught.message : String(caught), 'error');
          const next = cookieConfigs[index + 1];
          if (next) {
            setStatusText(`public access failed · trying cookies from ${next.label}`);
            continue;
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
            setActionMessage('Finish the official browser sign-in, then press Enter here.');
            setStage('login');
            return;
          }
        } catch (loginError) {
          const reason = loginError instanceof Error ? loginError.message : String(loginError);
          void appendSessionLog(`LOGIN HANDOFF FAILED ${reason}`, 'error');
          setActionMessage(reason);
        }
      }
      setError(caught instanceof Error ? caught.message : String(caught));
      setStage('error');
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  const verifySocialLogin = () => {
    if (!loginHandoff) return;
    setActionMessage(`verifying ${loginHandoff.label} session and retrying the same URL...`);
    void startDownload(url, {
      cookieConfigsOverride: [loginHandoff.cookieConfig],
      allowLoginRecovery: false,
      pendingHandoff: loginHandoff,
    });
  };

  const openSocialLogin = async ({ nextBrowser = false } = {}) => {
    try {
      const alternatives = loginHandoff?.alternatives || [];
      const currentIndex = alternatives.indexOf(loginHandoff?.browserSpec);
      const browserSpec = nextBrowser && alternatives.length > 1
        ? alternatives[(Math.max(0, currentIndex) + 1) % alternatives.length]
        : loginHandoff?.browserSpec;
      const handoff = await beginSocialLoginHandoff({ url, browserSpec });
      if (!handoff) return;
      setLoginHandoff(handoff);
      setActionMessage(nextBrowser
        ? `Switched to ${handoff.browserSpec}. Finish sign-in, then press Enter.`
        : 'Finish the official browser sign-in, then press Enter here.');
      setStage('login');
    } catch (caught) {
      setActionMessage(caught instanceof Error ? caught.message : String(caught));
      setStage('error');
    }
  };

  useEffect(() => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) return undefined;
    process.stdout.write('\u001b[?1000h\u001b[?1006h');
    return () => process.stdout.writable && process.stdout.write('\u001b[?1000l\u001b[?1006l');
  }, []);

  useEffect(() => {
    if (!initialUrl || submittedRef.current || !hasDependencies) return;
    submittedRef.current = true;
    void startDownload(initialUrl);
  }, [initialUrl, hasDependencies]);

  useInput((input, key) => {
    const decoded = decoderRef.current.feed(input);
    const lower = decoded.text.toLowerCase();
    const bounds = controlBounds({ layout: terminalSize });

    for (const event of decoded.events) {
      if (!event.pressed) continue;
      const button = event.button & 3;
      if (button === 2 && stage === 'home') pasteClipboard();
      if (button === 0 && stage === 'home') {
        if (inside(event, bounds.convert)) {
          setActiveControl('convert');
          void startDownload(url);
        } else if (inside(event, bounds.input)) setActiveControl('input');
      }
    }

    const directQuit = key.escape || (key.ctrl && lower === 'c')
      || (lower === 'q' && (stage !== 'home' || activeControl === 'convert' || !hasDependencies));
    if (directQuit) return quit();

    if (OVERLAYS.has(stage)) {
      if (lower === 'b' || key.backspace) setStage(returnStage);
      return;
    }

    if (key.ctrl && lower === 'h') return showOverlay('help');
    if (key.ctrl && lower === 'd') return showOverlay('diagnostics');
    if (!hasDependencies) return;
    if (key.ctrl && lower === 'v') return pasteClipboard();

    if (stage === 'login') {
      if (key.return) verifySocialLogin();
      else if (lower === 'b') void openSocialLogin({ nextBrowser: true });
      return;
    }

    const configurable = stage === 'home' || stage === 'error';
    if (configurable && key.ctrl && lower === 'm') return setMode((current) => cycle(MODES, current));
    if (configurable && key.ctrl && lower === 'a') {
      setAudioFormat((current) => cycle(AUDIO_FORMATS, current));
      setMode('audio');
      return;
    }
    if (configurable && key.ctrl && lower === 't') {
      setVideoFormat((current) => cycle(VIDEO_FORMATS, current));
      setMode('video');
      return;
    }
    if (configurable && key.ctrl && lower === 's') return setSubtitles((current) => !current);
    if (configurable && key.ctrl && lower === 'n') return setWriteThumbnail((current) => !current);
    if (configurable && key.ctrl && lower === 'g') {
      setPlatformHint((current) => cycle(SOCIAL_PLATFORM_KEYS, current));
      setActionMessage('social-platform selection changed');
      return;
    }
    if (configurable && key.ctrl && lower === 'f') {
      setImageFormat((current) => cycle(IMAGE_FORMATS, current));
      setMode('image');
      setActionMessage('image format changed');
      return;
    }
    if (configurable && key.ctrl && lower === 'q') {
      setResolution((current) => cycle(VIDEO_QUALITIES, current));
      return;
    }
    if (configurable && key.ctrl && lower === 'b') return setCookieSource((current) => cycle(cookieOptions, current));
    if (configurable && key.ctrl && lower === 'p') return setPlaylist((current) => !current);
    if (configurable && key.ctrl && lower === 'o') return setAutoOpen((current) => !current);

    if (stage === 'done') {
      if (lower === 'o') void openFolder();
      else if (lower === 'f') void openFile();
      else if (lower === 'c') copyPath();
      else if (lower === 'r') reset();
      else if (lower === 'h') showOverlay('help');
      else if (lower === 'd') showOverlay('diagnostics');
      return;
    }

    if (stage === 'error') {
      if (lower === 'r') void startDownload(url);
      else if (lower === 'l') void openSocialLogin();
      else if (lower === 'b' && loginHandoff) void openSocialLogin({ nextBrowser: true });
      else if (lower === 'e') {
        setStage('home');
        setActiveControl('input');
      } else if (lower === 'd') showOverlay('diagnostics');
      return;
    }

    if (stage !== 'home') return;
    if (key.tab) return setActiveControl((current) => current === 'input' ? 'convert' : 'input');
    if (key.return) return void startDownload(url);
    if (activeControl === 'convert' && decoded.text === ' ') return void startDownload(url);
    if (activeControl !== 'input') return;
    if (key.backspace || key.delete) {
      setUrl((current) => Array.from(current).slice(0, -1).join(''));
      return;
    }
    if (key.ctrl && lower === 'l') return setUrl('');
    if (decoded.text) setUrl((current) => applyText(current, decoded.text));
  });

  let content;
  if (stage === 'help') content = h(HelpScreen, { panelWidth, termux });
  else if (stage === 'diagnostics') content = h(DiagnosticsScreen, {
    dependencies,
    panelWidth,
    outputDirectory,
    cookieSource,
    platformHint,
    mode,
    audioFormat,
    videoFormat,
    resolution,
    subtitles,
  });
  else if (!hasDependencies) content = h(MissingDependencies, { dependencies, panelWidth });
  else if (stage === 'home') content = h(HomeScreen, {
    panelWidth,
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
    writeThumbnail,
    cookieSource,
    playlist,
    autoOpen,
    activeControl,
    stackedControls,
    showDetails,
    showShortcuts,
  });
  else if (stage === 'probing' || stage === 'downloading') content = h(WorkingScreen, {
    stage, media, progress, statusText, panelWidth,
  });
  else if (stage === 'done') content = h(DoneScreen, {
    media, panelWidth, outputDirectory, outputPath, actionMessage,
  });
  else if (stage === 'login' && loginHandoff) content = h(SocialLoginScreen, {
    handoff: loginHandoff, panelWidth, actionMessage,
  });
  else content = h(ErrorScreen, { error, media, panelWidth, cookieSource, actionMessage, url });

  return h(Box, {
    width: '100%',
    minHeight,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  }, h(Logo, {
    compact: compactLogo,
    tiny: tinyLogo,
    account: process.env.YTCONV_ACCOUNT_LABEL,
    showTagline,
  }), content);
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
  if (enabled && process.stdout.writable) process.stdout.write('\u001b[?1000l\u001b[?1006l\u001b[?1049l');
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
  console.clear();
  process.stdout.write('Preparing YTConv...\r');
  let dependencies = await inspectDependencies();

  if (dependencies.platform?.termux
    && (!dependencies.ytDlp.installed || !dependencies.ffmpeg.installed || !dependencies.galleryDl?.installed)) {
    console.clear();
    console.log('YTConv first-run setup for Termux');
    console.log('Installing Python, yt-dlp, gallery-dl, and FFmpeg. Please wait...\n');
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
