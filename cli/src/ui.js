import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, render, useApp, useInput } from 'ink';
import figlet from 'figlet';
import ansiShadowFont from 'figlet/importable-fonts/ANSI Shadow.js';
import smallFont from 'figlet/importable-fonts/Small.js';
import {
  cookieSourceLabel,
  cookieSourcesForPlatform,
  resolveCookieConfig,
} from './cookies.js';
import { inspectDependencies, prepareTermuxDependencies } from './dependencies.js';
import { downloadMedia, inspectMedia } from './downloader.js';
import {
  desktopDownloadsDirectory,
  isTermux,
  termuxSharedDownloadsDirectory,
} from './platform.js';
import {
  copyText,
  openOutputFile,
  openOutputLocation,
} from './system-actions.js';
import {
  createTerminalInputDecoder,
  readClipboardText,
} from './terminal-input.js';
import { CLI_VERSION } from './version.js';

figlet.parseFont('ANSI Shadow', ansiShadowFont);
figlet.parseFont('Small', smallFont);

const h = React.createElement;
const VIDEO_QUALITIES = ['best', '2160', '1440', '1080', '720', '480'];
const AUDIO_QUALITIES = ['0', '320K', '256K', '192K', '128K'];
const AUDIO_FORMATS = ['mp3', 'm4a'];
const EXIT_COMMANDS = new Set(['q', 'quit', 'exit', ':q']);
const OVERLAY_STAGES = new Set(['help', 'diagnostics']);

const LOGO_WIDE = figlet.textSync('YTCONV', {
  font: 'ANSI Shadow',
  horizontalLayout: 'default',
});
const LOGO_COMPACT = figlet.textSync('YTCONV', {
  font: 'Small',
  horizontalLayout: 'fitted',
});

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function cycle(values, current) {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length];
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${minutes}:${String(secs).padStart(2, '0')}`;
}

function parsePercent(value) {
  const number = Number.parseFloat(String(value).replace('%', '').trim());
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

function makeProgressBar(percent, width = 34) {
  const completed = Math.round((parsePercent(percent) / 100) * width);
  return `${'█'.repeat(completed)}${'░'.repeat(Math.max(0, width - completed))}`;
}

function modeSummary({ mode, resolution, audioFormat, audioQuality }) {
  if (mode === 'video') {
    return resolution === 'best'
      ? 'video · best MP4/MKV'
      : `video · max ${resolution}p MP4/MKV`;
  }

  if (audioFormat === 'm4a') return 'audio · M4A';
  return audioQuality === '0'
    ? 'audio · MP3 best VBR'
    : `audio · MP3 ${audioQuality.replace('K', ' kbps')}`;
}

function cleanInputText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '')
    .replace(/[\r\n\t]/gu, '')
    .trimStart();
}

function firstUrl(value) {
  return cleanInputText(value).match(/https?:\/\/[^\s]+/iu)?.[0] ?? '';
}

function applyIncomingText(current, incoming) {
  const cleaned = cleanInputText(incoming);
  if (!cleaned) return current;

  const pastedUrl = firstUrl(cleaned);
  if (pastedUrl) return pastedUrl;

  return `${current}${cleaned}`.slice(0, 4096);
}

function displayInput(value, width) {
  const characters = Array.from(value);
  const available = Math.max(8, width - 5);
  if (characters.length <= available) return value;
  return `…${characters.slice(-(available - 1)).join('')}`;
}

function runnerLabel(dependencies) {
  const runner = dependencies.ytDlp;
  if (runner.displayPath) return runner.displayPath;
  if (typeof runner.path === 'string') return runner.path;
  if (runner.path?.path) return runner.path.path;
  return '-';
}

function Logo({ compact }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center' },
    h(Text, { bold: true }, compact ? LOGO_COMPACT : LOGO_WIDE),
    h(Text, null, 'paste a media link. convert. done.'),
    h(Text, { dimColor: true }, 'youtube · instagram · tiktok · x · facebook · pinterest · + supported sites'),
  );
}

function SettingLine({
  mode,
  resolution,
  audioFormat,
  audioQuality,
  cookieSource,
  playlist,
  autoOpen,
}) {
  return h(
    Text,
    { dimColor: true },
    `${modeSummary({ mode, resolution, audioFormat, audioQuality })}`
      + `  ·  cookies:${cookieSourceLabel(cookieSource)}`
      + `  ·  playlist:${playlist ? 'on' : 'off'}`
      + `  ·  auto-open:${autoOpen ? 'on' : 'off'}`,
  );
}

function HomeScreen(props) {
  const {
    panelWidth,
    url,
    inputError,
    actionMessage,
    mode,
    resolution,
    audioFormat,
    audioQuality,
    cookieSource,
    playlist,
    autoOpen,
    activeControl,
  } = props;

  const inputWidth = Math.max(24, panelWidth - 14);
  const buttonFocused = activeControl === 'convert';
  const shownValue = displayInput(url, inputWidth);

  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(Box, { width: panelWidth, paddingLeft: 1 }, h(Text, null, 'Paste a link')),
    h(
      Box,
      { width: panelWidth, flexDirection: 'row' },
      h(
        Box,
        {
          width: inputWidth,
          borderStyle: activeControl === 'input' ? 'double' : 'round',
          paddingX: 1,
        },
        h(Text, null, '▣ '),
        h(
          Text,
          { wrap: 'truncate-end' },
          shownValue || h(Text, { dimColor: true }, 'https://...'),
        ),
        activeControl === 'input' ? h(Text, { inverse: true }, ' ') : null,
      ),
      h(
        Box,
        {
          width: 12,
          marginLeft: 1,
          borderStyle: buttonFocused ? 'double' : 'round',
          justifyContent: 'center',
          alignItems: 'center',
        },
        h(Text, { inverse: true, bold: true }, buttonFocused ? '» convert «' : ' convert '),
      ),
    ),
    inputError ? h(Text, { inverse: true, wrap: 'wrap' }, ` ${inputError} `) : null,
    actionMessage ? h(Text, { wrap: 'wrap' }, actionMessage) : null,
    h(
      Box,
      { marginTop: 1 },
      h(SettingLine, {
        mode,
        resolution,
        audioFormat,
        audioQuality,
        cookieSource,
        playlist,
        autoOpen,
      }),
    ),
    h(Text, { dimColor: true }, 'Ctrl+V/right-click paste · click convert · Tab+Enter fallback'),
    h(Text, { dimColor: true }, '^g video/audio · ^q quality · ^b cookies · ^p playlist · ^o auto-open'),
    h(Text, { dimColor: true }, '^h help · ^d diagnostics · esc/^c quit'),
    mode === 'audio' ? h(Text, { dimColor: true }, '^f MP3/M4A · type exit then Enter to close') : null,
  );
}

function MediaCard({ media, panelWidth }) {
  if (!media) return null;
  const duration = formatDuration(media.duration);
  const details = [media.platform, media.uploader, duration].filter(Boolean).join('  ·  ');
  const playlistText = media.isPlaylist ? `  ·  ${media.itemCount} item` : '';

  return h(
    Box,
    { width: panelWidth, borderStyle: 'round', paddingX: 1, flexDirection: 'column' },
    h(Text, { bold: true, wrap: 'truncate-end' }, media.title),
    h(Text, { dimColor: true, wrap: 'truncate-end' }, `${details}${playlistText}`),
  );
}

function WorkingScreen({ stage, media, progress, statusText, panelWidth }) {
  const probing = stage === 'probing';
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, panelWidth }),
    h(
      Box,
      { marginTop: 1, flexDirection: 'column', alignItems: 'center' },
      h(Text, { bold: true }, probing ? 'checking the link...' : makeProgressBar(progress.percent)),
      h(
        Text,
        { dimColor: true },
        probing
          ? 'detecting platform and media information'
          : [progress.percent || '0%', progress.speed, progress.eta ? `ETA ${progress.eta}` : '']
            .filter(Boolean)
            .join('  ·  '),
      ),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, statusText || (probing ? 'please wait' : 'converting...')),
    ),
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, 'esc/^c/q cancel and close')),
  );
}

function DoneScreen({ media, panelWidth, outputDirectory, outputPath, actionMessage }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, panelWidth }),
    h(
      Box,
      { marginTop: 1, borderStyle: 'double', width: panelWidth, paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true, inverse: true }, ' conversion complete '),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, outputPath || outputDirectory),
    ),
    actionMessage ? h(Text, { wrap: 'wrap' }, actionMessage) : null,
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, 'o open folder · f open file · c copy path · r another link')),
    h(Text, { dimColor: true }, 'h help · d diagnostics · q/esc quit'),
  );
}

function ErrorScreen({ error, media, panelWidth, cookieSource, actionMessage }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, panelWidth }),
    h(
      Box,
      { marginTop: 1, borderStyle: 'double', width: panelWidth, paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true, inverse: true }, ' conversion failed '),
      h(Text, { wrap: 'wrap' }, error),
      h(Text, { dimColor: true }, `cookies: ${cookieSourceLabel(cookieSource)}`),
    ),
    actionMessage ? h(Text, { wrap: 'wrap' }, actionMessage) : null,
    h(
      Box,
      { marginTop: 1, flexDirection: 'column', alignItems: 'center' },
      h(Text, { dimColor: true }, 'r retry · e edit link · ^b change cookies · d diagnostics · q/esc quit'),
      h(Text, { dimColor: true }, 'DRM, paid media, deleted posts, or inaccessible private posts cannot be bypassed.'),
    ),
  );
}

function HelpScreen({ panelWidth, termux }) {
  const rows = [
    ['Enter / click', 'start conversion'],
    ['Tab', 'move between input and convert'],
    ['Ctrl+V / right-click', 'paste link'],
    ['Ctrl+G', 'video or audio'],
    ['Ctrl+Q', 'resolution or audio quality'],
    ['Ctrl+F', 'MP3 or M4A in audio mode'],
    ['Ctrl+B', 'cookies source'],
    ['Ctrl+P', 'playlist on or off'],
    ['Ctrl+O', 'auto-open result on or off'],
    ['O / F / C', 'open folder / open file / copy path after conversion'],
    ['Esc / Ctrl+C / Q', 'close or cancel'],
  ];

  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', marginTop: 1 },
    h(Text, { bold: true, inverse: true }, ` YTConv ${CLI_VERSION} help `),
    ...rows.map(([key, description]) => h(
      Box,
      { key, flexDirection: 'row' },
      h(Box, { width: 24 }, h(Text, { bold: true }, key)),
      h(Text, { dimColor: true }, description),
    )),
    h(Text, { dimColor: true }, termux
      ? 'Termux saves files to Download/YTConv. Folder opening depends on the installed Android file manager.'
      : 'Use ytconv --help or ytconv --diagnose outside the TUI for command-line help.'),
    h(Box, { marginTop: 1 }, h(Text, null, 'b back · q/esc quit')),
  );
}

function DiagnosticsScreen({ dependencies, panelWidth, outputDirectory, cookieSource }) {
  const rows = [
    ['YTConv', CLI_VERSION],
    ['Node.js', process.version],
    ['Platform', dependencies.platform?.termux ? 'Android Termux' : `${process.platform} ${process.arch}`],
    ['yt-dlp', dependencies.ytDlp.version || 'not found'],
    ['Runner', runnerLabel(dependencies)],
    ['FFmpeg', dependencies.ffmpeg.version || 'not found'],
    ['FFmpeg path', dependencies.ffmpeg.path || '-'],
    ['Output', outputDirectory],
    ['Cookies', cookieSourceLabel(cookieSource)],
  ];

  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', marginTop: 1 },
    h(Text, { bold: true, inverse: true }, ' diagnostics '),
    ...rows.map(([label, value]) => h(
      Box,
      { key: label, flexDirection: 'row' },
      h(Box, { width: 16 }, h(Text, { bold: true }, label)),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, String(value)),
    )),
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, 'Outside the app: ytconv --diagnose')),
    h(Text, null, 'b back · q/esc quit'),
  );
}

function MissingDependencies({ dependencies, panelWidth }) {
  const termuxCommand = dependencies.platform?.setupCommand;
  const details = [
    dependencies.ytDlp.error,
    !dependencies.ytDlp.installed ? 'yt-dlp was not found.' : '',
    !dependencies.ffmpeg.installed ? 'FFmpeg was not found.' : '',
  ].filter(Boolean).join(' ');

  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(
      Box,
      { borderStyle: 'double', width: panelWidth, paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true, inverse: true }, ' setup incomplete '),
      h(Text, null, details || 'YTConv could not prepare its converter tools.'),
      h(Text, { dimColor: true }, termuxCommand || 'Connect to the internet, then reinstall or run npm rebuild ytconv.'),
    ),
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, '^d diagnostics · q/esc/^c quit')),
  );
}

function logoLineCount(compact) {
  return (compact ? LOGO_COMPACT : LOGO_WIDE)
    .split('\n')
    .filter((line) => line.length > 0)
    .length;
}

function controlBounds({ columns, rows, panelWidth, compactLogo, mode }) {
  const rootHeight = Math.max(20, rows - 1);
  const logoHeight = logoLineCount(compactLogo) + 2;
  const homeHeight = 1 + 1 + 3 + 1 + 1 + 3 + (mode === 'audio' ? 1 : 0);
  const totalHeight = logoHeight + homeHeight;
  const rootTop = Math.max(1, Math.floor((rootHeight - totalHeight) / 2) + 1);
  const panelLeft = Math.max(1, Math.floor((columns - panelWidth) / 2) + 1);
  const inputWidth = Math.max(24, panelWidth - 14);
  const inputTop = rootTop + logoHeight + 2;
  const buttonLeft = panelLeft + inputWidth + 1;

  return {
    input: {
      left: panelLeft - 1,
      right: panelLeft + inputWidth,
      top: inputTop - 1,
      bottom: inputTop + 3,
    },
    convert: {
      left: buttonLeft - 1,
      right: buttonLeft + 12,
      top: inputTop - 1,
      bottom: inputTop + 3,
    },
  };
}

function inside(event, bounds) {
  return event.x >= bounds.left
    && event.x <= bounds.right
    && event.y >= bounds.top
    && event.y <= bounds.bottom;
}

function App({
  dependencies,
  initialUrl = '',
  initialMode = 'video',
  initialPlaylist = false,
}) {
  const { exit } = useApp();
  const termux = dependencies.platform?.termux ?? isTermux();
  const cookieOptions = cookieSourcesForPlatform(termux);
  const decoderRef = useRef(createTerminalInputDecoder());
  const [url, setUrl] = useState(initialUrl);
  const [stage, setStage] = useState('home');
  const [overlayReturnStage, setOverlayReturnStage] = useState('home');
  const [mode, setMode] = useState(initialMode === 'audio' ? 'audio' : 'video');
  const [resolution, setResolution] = useState('best');
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [audioQuality, setAudioQuality] = useState('0');
  const [cookieSource, setCookieSource] = useState(process.env.YTCONV_COOKIES ? 'file' : 'none');
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
  const controllerRef = useRef(null);
  const initialSubmittedRef = useRef(false);

  const columns = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  const panelWidth = Math.max(34, Math.min(76, columns - 4));
  const compactLogo = columns < 78;
  const outputDirectory = process.env.YTCONV_OUTPUT
    ? path.resolve(process.env.YTCONV_OUTPUT)
    : (termux ? termuxSharedDownloadsDirectory() : desktopDownloadsDirectory());
  const hasDependencies = dependencies.ytDlp.installed && dependencies.ffmpeg.installed;

  const quit = () => {
    controllerRef.current?.abort();
    exit();
  };

  const showOverlay = (nextStage) => {
    if (!OVERLAY_STAGES.has(stage)) setOverlayReturnStage(stage);
    setStage(nextStage);
  };

  const closeOverlay = () => setStage(overlayReturnStage);

  const pasteClipboard = () => {
    const clipboard = readClipboardText({ termux });
    if (!clipboard) {
      setInputError(termux
        ? 'Clipboard API unavailable. Long-press Termux and choose Paste.'
        : 'Clipboard could not be read. Try Ctrl+V again or use Shift+Insert.');
      return;
    }

    setUrl((current) => applyIncomingText(current, clipboard));
    setInputError('');
    setActionMessage('link pasted from clipboard');
    setActiveControl('input');
  };

  const handleOpenFolder = async (filePath = outputPath) => {
    setActionMessage('opening output location...');
    const copied = copyText(outputDirectory, { termux });
    const result = await openOutputLocation({ directory: outputDirectory, filePath });
    if (result.ok) {
      setActionMessage(`opened with ${result.label}${copied ? ' · folder path copied' : ''}`);
    } else {
      setActionMessage(`could not open folder${copied ? ' · path copied' : ''}: ${outputDirectory}`);
    }
    return result;
  };

  const handleOpenFile = async () => {
    setActionMessage('opening downloaded file...');
    const result = await openOutputFile(outputPath);
    setActionMessage(result.ok
      ? `opened with ${result.label}`
      : `could not open file: ${result.error?.message || outputPath}`);
  };

  const handleCopyPath = () => {
    const target = outputPath || outputDirectory;
    const copied = copyText(target, { termux });
    setActionMessage(copied ? 'output path copied to clipboard' : `copy failed · path: ${target}`);
  };

  const reset = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    decoderRef.current.reset();
    setUrl('');
    setStage('home');
    setOverlayReturnStage('home');
    setActiveControl('input');
    setInputError('');
    setActionMessage('');
    setMedia(null);
    setProgress({ percent: '0%', speed: '', eta: '' });
    setStatusText('');
    setError('');
    setOutputPath('');
  };

  const startDownload = async (candidate = url) => {
    const normalizedUrl = candidate.trim();

    if (EXIT_COMMANDS.has(normalizedUrl.toLowerCase())) {
      quit();
      return;
    }

    if (!isValidUrl(normalizedUrl)) {
      setInputError('Paste a valid http/https link, or type exit then press Enter.');
      setActiveControl('input');
      return;
    }
    if (!hasDependencies || ['probing', 'downloading'].includes(stage)) return;

    setUrl(normalizedUrl);
    setInputError('');
    setActionMessage('');
    setError('');
    setMedia(null);
    setOutputPath('');
    setProgress({ percent: '0%', speed: '', eta: '' });

    let cookieConfig;
    try {
      await fs.mkdir(outputDirectory, { recursive: true });
      cookieConfig = await resolveCookieConfig({ source: cookieSource, outputDirectory });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStage('error');
      return;
    }

    setStatusText(`reading metadata · cookies:${cookieConfig.label}`);
    setStage('probing');

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const inspected = await inspectMedia({
        ytDlpPath: dependencies.ytDlp.path,
        url: normalizedUrl,
        cookieConfig,
        playlist,
        signal: controller.signal,
      });
      setMedia(inspected);
      setStage('downloading');
      setStatusText('starting conversion...');

      const result = await downloadMedia({
        ytDlpPath: dependencies.ytDlp.path,
        signal: controller.signal,
        options: {
          url: normalizedUrl,
          mode,
          resolution,
          audioFormat,
          audioQuality,
          cookieConfig,
          playlist,
          outputDirectory,
          ffmpegPath: dependencies.ffmpeg.path,
        },
        onProgress: (nextProgress) => setProgress(nextProgress),
        onLog: (line) => {
          if (/\[Merger\]/u.test(line)) setStatusText('merging video and audio...');
          else if (/\[VideoRemuxer\]/u.test(line)) setStatusText('making a compatible video file...');
          else if (/\[ExtractAudio\]/u.test(line)) setStatusText('converting audio...');
          else if (/\[Metadata\]/u.test(line)) setStatusText('writing metadata...');
          else if (/Tersimpan:/u.test(line)) setStatusText(line);
        },
      });

      const finalPath = result.outputPath || outputDirectory;
      setOutputPath(finalPath);
      setProgress((current) => ({ ...current, percent: '100%' }));
      setStatusText('complete');
      setStage('done');

      if (autoOpen) await handleOpenFolder(finalPath);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : String(caught));
      setStage('error');
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  useEffect(() => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) return undefined;
    process.stdout.write('\u001b[?1000h\u001b[?1006h');
    return () => {
      if (process.stdout.writable) process.stdout.write('\u001b[?1000l\u001b[?1006l');
    };
  }, []);

  useEffect(() => {
    if (!initialUrl || initialSubmittedRef.current || !hasDependencies) return;
    initialSubmittedRef.current = true;
    void startDownload(initialUrl);
  }, [initialUrl, hasDependencies]);

  useInput((input, key) => {
    const decoded = decoderRef.current.feed(input);
    const lower = decoded.text.toLowerCase();
    const bounds = controlBounds({ columns, rows, panelWidth, compactLogo, mode });

    for (const event of decoded.events) {
      if (!event.pressed) continue;
      const button = event.button & 3;

      if (button === 2 && stage === 'home') {
        pasteClipboard();
        continue;
      }

      if (button !== 0 || stage !== 'home') continue;

      if (inside(event, bounds.convert)) {
        setActiveControl('convert');
        void startDownload(url);
      } else if (inside(event, bounds.input)) {
        setActiveControl('input');
      }
    }

    const directQuit = key.escape
      || (key.ctrl && lower === 'c')
      || (lower === 'q' && (stage !== 'home' || activeControl === 'convert' || !hasDependencies));

    if (directQuit) {
      quit();
      return;
    }

    if (OVERLAY_STAGES.has(stage)) {
      if (lower === 'b' || key.backspace) closeOverlay();
      return;
    }

    if (key.ctrl && lower === 'd') {
      showOverlay('diagnostics');
      return;
    }

    if (key.ctrl && lower === 'h') {
      showOverlay('help');
      return;
    }

    if (!hasDependencies) return;

    if (key.ctrl && lower === 'v') {
      pasteClipboard();
      return;
    }

    const configurable = stage === 'home' || stage === 'error';

    if (configurable && key.ctrl && lower === 'o') {
      setAutoOpen((current) => !current);
      setActionMessage(`auto-open ${autoOpen ? 'disabled' : 'enabled'}`);
      return;
    }

    if (stage === 'home' && key.tab) {
      setActiveControl((current) => (current === 'input' ? 'convert' : 'input'));
      return;
    }

    if (stage === 'home' && key.return) {
      void startDownload(url);
      return;
    }

    if (stage === 'home' && activeControl === 'convert' && decoded.text === ' ') {
      void startDownload(url);
      return;
    }

    if (configurable && key.ctrl && lower === 'g') {
      setMode((current) => (current === 'video' ? 'audio' : 'video'));
      return;
    }

    if (configurable && key.ctrl && lower === 'q') {
      if (mode === 'video') setResolution((current) => cycle(VIDEO_QUALITIES, current));
      else setAudioQuality((current) => cycle(AUDIO_QUALITIES, current));
      return;
    }

    if (configurable && key.ctrl && lower === 'f' && mode === 'audio') {
      setAudioFormat((current) => cycle(AUDIO_FORMATS, current));
      return;
    }

    if (configurable && key.ctrl && lower === 'b') {
      setCookieSource((current) => cycle(cookieOptions, current));
      return;
    }

    if (configurable && key.ctrl && lower === 'p') {
      setPlaylist((current) => !current);
      return;
    }

    if (stage === 'done') {
      if (lower === 'o') void handleOpenFolder();
      else if (lower === 'f') void handleOpenFile();
      else if (lower === 'c') handleCopyPath();
      else if (lower === 'r') reset();
      else if (lower === 'h') showOverlay('help');
      else if (lower === 'd') showOverlay('diagnostics');
      return;
    }

    if (stage === 'error') {
      if (lower === 'r') void startDownload(url);
      else if (lower === 'e') {
        setStage('home');
        setActiveControl('input');
      } else if (lower === 'h') showOverlay('help');
      else if (lower === 'd') showOverlay('diagnostics');
      return;
    }

    if (stage !== 'home' || activeControl !== 'input') return;

    if (key.backspace || key.delete) {
      setUrl((current) => Array.from(current).slice(0, -1).join(''));
      setInputError('');
      setActionMessage('');
      return;
    }

    if (key.ctrl && lower === 'l') {
      setUrl('');
      setInputError('');
      setActionMessage('');
      return;
    }

    if (decoded.text) {
      setUrl((current) => applyIncomingText(current, decoded.text));
      setInputError('');
      setActionMessage('');
    }
  });

  let content;
  if (stage === 'help') {
    content = h(HelpScreen, { panelWidth, termux });
  } else if (stage === 'diagnostics') {
    content = h(DiagnosticsScreen, {
      dependencies,
      panelWidth,
      outputDirectory,
      cookieSource,
    });
  } else if (!hasDependencies) {
    content = h(MissingDependencies, { dependencies, panelWidth });
  } else if (stage === 'home') {
    content = h(HomeScreen, {
      panelWidth,
      url,
      inputError,
      actionMessage,
      mode,
      resolution,
      audioFormat,
      audioQuality,
      cookieSource,
      playlist,
      autoOpen,
      activeControl,
    });
  } else if (stage === 'probing' || stage === 'downloading') {
    content = h(WorkingScreen, { stage, media, progress, statusText, panelWidth });
  } else if (stage === 'done') {
    content = h(DoneScreen, {
      media,
      panelWidth,
      outputDirectory,
      outputPath,
      actionMessage,
    });
  } else {
    content = h(ErrorScreen, {
      error,
      media,
      panelWidth,
      cookieSource,
      actionMessage,
    });
  }

  return h(
    Box,
    {
      width: '100%',
      minHeight: Math.max(20, rows - 1),
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    h(Logo, { compact: compactLogo }),
    content,
  );
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function enterAlternateScreen() {
  if (!process.stdout.isTTY) return false;
  process.stdout.write('\u001b[?1049h\u001b[2J\u001b[H');
  return true;
}

function leaveAlternateScreen(enabled) {
  if (!enabled || !process.stdout.writable) return;
  process.stdout.write('\u001b[?1000l\u001b[?1006l\u001b[?1049l');
}

export async function runApp({
  initialUrl = '',
  initialMode = 'video',
  initialPlaylist = false,
} = {}) {
  process.title = `YTConv ${CLI_VERSION}`;
  console.clear();
  process.stdout.write('Preparing YTConv...\r');
  let dependencies = await inspectDependencies();

  if (
    dependencies.platform?.termux
    && (!dependencies.ytDlp.installed || !dependencies.ffmpeg.installed)
  ) {
    console.clear();
    console.log('YTConv first-run setup for Termux');
    console.log('Installing Python yt-dlp and FFmpeg. Please wait...\n');
    try {
      await prepareTermuxDependencies();
    } catch (error) {
      console.error(`\nSetup gagal: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Coba: pkg update && pkg install -y python ffmpeg && python -m pip install -U yt-dlp');
      await sleep(1500);
    }
    dependencies = await inspectDependencies();
  }

  const alternateScreen = enterAlternateScreen();
  let instance;
  try {
    console.clear();
    instance = render(h(App, {
      dependencies,
      initialUrl,
      initialMode,
      initialPlaylist,
    }), { exitOnCtrlC: false });
    await instance.waitUntilExit();
  } finally {
    instance?.unmount();
    leaveAlternateScreen(alternateScreen);
  }
}
