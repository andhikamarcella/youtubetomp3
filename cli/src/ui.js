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
  resolveCookieConfigs,
} from './cookies.js';
import { inspectDependencies, prepareTermuxDependencies } from './dependencies.js';
import { downloadMedia, inspectMedia } from './media-controller.js';
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
import { copyText, openOutputFile, openOutputLocation } from './system-actions.js';
import { createTerminalInputDecoder, readClipboardText } from './terminal-input.js';
import { CLI_VERSION } from './version.js';

figlet.parseFont('ANSI Shadow', ansiShadowFont);
figlet.parseFont('Small', smallFont);

const h = React.createElement;
const VIDEO_QUALITIES = ['best', '2160', '1440', '1080', '720', '480'];
const IMAGE_FORMATS = ['original', 'jpg', 'png', 'webp'];
const EXIT_COMMANDS = new Set(['q', 'quit', 'exit', ':q']);
const OVERLAYS = new Set(['help', 'diagnostics']);

const LOGO_WIDE = figlet.textSync('YTCONV', { font: 'ANSI Shadow' });
const LOGO_COMPACT = figlet.textSync('YTCONV', { font: 'Small', horizontalLayout: 'fitted' });

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

function Logo({ compact }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center' },
    h(Text, { bold: true }, compact ? LOGO_COMPACT : LOGO_WIDE),
    h(Text, null, 'paste a social link. convert. done.'),
    h(Text, { dimColor: true }, 'YouTube · Instagram · Facebook · TikTok · X · Pinterest · Reddit · + lainnya'),
  );
}

function HomeScreen(props) {
  const {
    panelWidth,
    url,
    inputError,
    actionMessage,
    platformHint,
    resolution,
    imageFormat,
    cookieSource,
    playlist,
    autoOpen,
    activeControl,
  } = props;
  const inputWidth = Math.max(24, panelWidth - 14);
  const buttonFocused = activeControl === 'convert';
  const platform = socialPlatformSummary({ selected: platformHint, url });

  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(Box, { width: panelWidth, paddingLeft: 1 }, h(Text, null, 'Paste link sosmed')),
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
        h(Text, { wrap: 'truncate-end' }, displayInput(url, inputWidth) || h(Text, { dimColor: true }, 'https://...')),
        activeControl === 'input' ? h(Text, { inverse: true }, ' ') : null,
      ),
      h(
        Box,
        {
          width: 12,
          marginLeft: 1,
          borderStyle: buttonFocused ? 'double' : 'round',
          justifyContent: 'center',
        },
        h(Text, { inverse: true, bold: true }, buttonFocused ? '» convert «' : ' convert '),
      ),
    ),
    inputError ? h(Text, { inverse: true, wrap: 'wrap' }, ` ${inputError} `) : null,
    actionMessage ? h(Text, { wrap: 'wrap' }, actionMessage) : null,
    h(
      Box,
      { marginTop: 1 },
      h(Text, { dimColor: true },
        `${platform}`
        + ` · cookies:${cookieSourceLabel(cookieSource)}`
        + ` · kualitas:${resolution}`
        + ` · gambar:${imageFormat.toUpperCase()}`
        + ` · playlist:${playlist ? 'on' : 'off'}`
        + ` · auto-open:${autoOpen ? 'on' : 'off'}`),
    ),
    h(Text, { dimColor: true }, 'Ctrl+G pilih sosmed: AUTO → YouTube → Instagram → Facebook → TikTok → X → lainnya'),
    h(Text, { dimColor: true }, 'Ctrl+F format gambar · Ctrl+Q kualitas · Ctrl+B cookies · Ctrl+P playlist'),
    h(Text, { dimColor: true }, 'Ctrl+O auto-open · Ctrl+H bantuan · Ctrl+D diagnostics · Esc/Ctrl+C keluar'),
  );
}

function MediaCard({ media, panelWidth }) {
  if (!media) return null;
  const details = [media.platform, media.uploader, durationText(media.duration), media.engine]
    .filter(Boolean).join(' · ');
  return h(
    Box,
    { width: panelWidth, borderStyle: 'round', paddingX: 1, flexDirection: 'column' },
    h(Text, { bold: true, wrap: 'truncate-end' }, media.title),
    h(Text, { dimColor: true, wrap: 'truncate-end' }, `${details}${media.itemCount > 1 ? ` · ${media.itemCount} item` : ''}`),
  );
}

function WorkingScreen({ stage, media, progress, statusText, panelWidth }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, panelWidth }),
    h(Box, { marginTop: 1, flexDirection: 'column', alignItems: 'center' },
      h(Text, { bold: true }, stage === 'probing' ? 'checking the social link...' : progressBar(progress.percent)),
      h(Text, { dimColor: true }, stage === 'probing'
        ? 'detecting platform and choosing the best engine'
        : [progress.percent || '0%', progress.speed, progress.eta ? `ETA ${progress.eta}` : ''].filter(Boolean).join(' · ')),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, statusText || 'please wait'),
    ),
    h(Text, { dimColor: true }, 'Esc/Ctrl+C membatalkan dan menutup'),
  );
}

function DoneScreen({ media, panelWidth, outputDirectory, outputPath, actionMessage }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, panelWidth }),
    h(Box, { marginTop: 1, borderStyle: 'double', width: panelWidth, paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true, inverse: true }, ' conversion complete '),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, outputPath || outputDirectory),
    ),
    actionMessage ? h(Text, { wrap: 'wrap' }, actionMessage) : null,
    h(Text, { dimColor: true }, 'O buka folder · F buka file · C copy lokasi · R link lain'),
    h(Text, { dimColor: true }, 'H bantuan · D diagnostics · Q/Esc keluar'),
  );
}

function ErrorScreen({ error, media, panelWidth, cookieSource, actionMessage }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, panelWidth }),
    h(Box, { marginTop: 1, borderStyle: 'double', width: panelWidth, paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true, inverse: true }, ' conversion failed '),
      h(Text, { wrap: 'wrap' }, error),
      h(Text, { dimColor: true }, `cookies: ${cookieSourceLabel(cookieSource)}`),
    ),
    actionMessage ? h(Text, { wrap: 'wrap' }, actionMessage) : null,
    h(Text, { dimColor: true }, 'R coba lagi · E edit link · Ctrl+B cookies · D diagnostics · Q/Esc keluar'),
    h(Text, { dimColor: true }, 'Konten publik dicoba tanpa cookies. Konten login-only membutuhkan akses akun yang sah.'),
  );
}

function HelpScreen({ panelWidth, termux }) {
  const rows = [
    ['Ctrl+G', 'pilih nama sosmed / AUTO semua sosmed'],
    ['Ctrl+F', 'format gambar ORIGINAL/JPG/PNG/WEBP'],
    ['Ctrl+Q', 'kualitas hasil video'],
    ['Ctrl+B', 'AUTO cookies / off / cookies.txt / browser'],
    ['Ctrl+P', 'playlist atau kumpulan post'],
    ['Ctrl+O', 'buka hasil otomatis'],
    ['Enter/click', 'convert link'],
    ['O / F / C', 'buka folder / file / copy lokasi'],
  ];
  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', marginTop: 1 },
    h(Text, { bold: true, inverse: true }, ` YTConv ${CLI_VERSION} help `),
    ...rows.map(([key, description]) => h(Box, { key, flexDirection: 'row' },
      h(Box, { width: 18 }, h(Text, { bold: true }, key)),
      h(Text, { dimColor: true }, description))),
    h(Text, { dimColor: true }, termux
      ? 'Termux otomatis mencari cookies.txt di Download dan Download/YTConv. Database privat browser Android tidak dapat dibaca langsung.'
      : 'AUTO mencoba tanpa cookies dulu, lalu cookies.txt atau browser yang terdeteksi bila situs meminta login.'),
    h(Text, null, 'B kembali · Q/Esc keluar'),
  );
}

function DiagnosticsScreen({ dependencies, panelWidth, outputDirectory, cookieSource, platformHint }) {
  const rows = [
    ['YTConv', CLI_VERSION],
    ['Node.js', process.version],
    ['Device', dependencies.platform?.termux ? 'Android Termux' : `${process.platform} ${process.arch}`],
    ['Sosmed', socialPlatformLabel(platformHint)],
    ['yt-dlp', dependencies.ytDlp.version || 'not found'],
    ['gallery-dl', dependencies.galleryDl?.version || 'not found'],
    ['FFmpeg', dependencies.ffmpeg.version || 'not found'],
    ['Output', outputDirectory],
    ['Cookies', cookieSourceLabel(cookieSource)],
  ];
  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', marginTop: 1 },
    h(Text, { bold: true, inverse: true }, ' diagnostics '),
    ...rows.map(([label, value]) => h(Box, { key: label, flexDirection: 'row' },
      h(Box, { width: 16 }, h(Text, { bold: true }, label)),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, String(value)))),
    h(Text, null, 'B kembali · Q/Esc keluar'),
  );
}

function MissingDependencies({ dependencies, panelWidth }) {
  return h(
    Box,
    { width: panelWidth, borderStyle: 'double', paddingX: 1, flexDirection: 'column' },
    h(Text, { bold: true, inverse: true }, ' setup incomplete '),
    h(Text, null, dependencies.ytDlp.error || 'yt-dlp, gallery-dl, atau FFmpeg belum siap.'),
    h(Text, { dimColor: true }, dependencies.platform?.setupCommand || 'Jalankan npm rebuild ytconv.'),
    h(Text, { dimColor: true }, 'Q/Esc/Ctrl+C keluar'),
  );
}

function logoLines(compact) {
  return (compact ? LOGO_COMPACT : LOGO_WIDE).split('\n').filter(Boolean).length;
}

function controlBounds({ columns, rows, panelWidth, compactLogo }) {
  const rootHeight = Math.max(20, rows - 1);
  const logoHeight = logoLines(compactLogo) + 2;
  const homeHeight = 11;
  const rootTop = Math.max(1, Math.floor((rootHeight - logoHeight - homeHeight) / 2) + 1);
  const panelLeft = Math.max(1, Math.floor((columns - panelWidth) / 2) + 1);
  const inputWidth = Math.max(24, panelWidth - 14);
  const inputTop = rootTop + logoHeight + 2;
  return {
    input: { left: panelLeft - 1, right: panelLeft + inputWidth, top: inputTop - 1, bottom: inputTop + 3 },
    convert: { left: panelLeft + inputWidth, right: panelLeft + inputWidth + 13, top: inputTop - 1, bottom: inputTop + 3 },
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
  const [mode] = useState(['auto', 'video', 'audio', 'image'].includes(initialMode) ? initialMode : 'auto');
  const [resolution, setResolution] = useState('best');
  const [audioFormat] = useState('mp3');
  const [audioQuality] = useState('0');
  const [imageFormat, setImageFormat] = useState(
    IMAGE_FORMATS.includes(initialImageFormat) ? initialImageFormat : 'original',
  );
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

  const columns = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  const panelWidth = Math.max(34, Math.min(82, columns - 4));
  const compactLogo = columns < 78;
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

  const showOverlay = (next) => {
    if (!OVERLAYS.has(stage)) setReturnStage(stage);
    setStage(next);
  };

  const pasteClipboard = () => {
    const value = readClipboardText({ termux });
    if (!value) {
      setInputError(termux ? 'Tekan lama Termux lalu pilih Paste.' : 'Clipboard tidak dapat dibaca.');
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

  const startDownload = async (candidate = url) => {
    const value = candidate.trim();
    if (EXIT_COMMANDS.has(value.toLowerCase())) return quit();
    if (!isValidUrl(value)) {
      setInputError('Paste link http/https yang valid.');
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

    let cookieConfigs;
    try {
      await fs.mkdir(outputDirectory, { recursive: true });
      cookieConfigs = await resolveCookieConfigs({ source: cookieSource, outputDirectory });
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
        const cookieConfig = cookieConfigs[index];
        const platformKey = platformHint === 'auto' ? detectSocialPlatform(value) : platformHint;
        setStage('probing');
        setStatusText(`${socialPlatformLabel(platformKey)} · mencoba ${cookieConfig.label}`);

        try {
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
              audioFormat,
              audioQuality,
              imageFormat,
              cookieConfig,
              playlist,
              outputDirectory,
              ffmpegPath: dependencies.ffmpeg.path,
            },
            onProgress: setProgress,
            onLog: (line) => {
              if (/Tersimpan:/u.test(line)) setStatusText(line);
              else if (/gallery|gambar|image|carousel|Merger|ExtractAudio|VideoRemuxer/iu.test(line)) setStatusText(line);
            },
          });

          const finalPath = result.outputPath || outputDirectory;
          setOutputPath(finalPath);
          setProgress((current) => ({ ...current, percent: '100%' }));
          setStatusText(`${result.fileCount || 1} file · ${result.engine || 'done'}`);
          setStage('done');
          if (autoOpen) await openOutputLocation({ directory: outputDirectory, filePath: finalPath });
          return;
        } catch (caught) {
          if (controller.signal.aborted) return;
          lastError = caught;
          const next = cookieConfigs[index + 1];
          if (next) {
            setStatusText(`akses publik gagal · mencoba cookies ${next.label}`);
            continue;
          }
        }
      }

      throw lastError || new Error('Tidak ada engine yang berhasil memproses link tersebut.');
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
    const bounds = controlBounds({ columns, rows, panelWidth, compactLogo });

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

    const configurable = stage === 'home' || stage === 'error';
    if (configurable && key.ctrl && lower === 'g') {
      setPlatformHint((current) => cycle(SOCIAL_PLATFORM_KEYS, current));
      setActionMessage('pilihan sosmed diubah');
      return;
    }
    if (configurable && key.ctrl && lower === 'f') {
      setImageFormat((current) => cycle(IMAGE_FORMATS, current));
      setActionMessage('format gambar diubah');
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
    dependencies, panelWidth, outputDirectory, cookieSource, platformHint,
  });
  else if (!hasDependencies) content = h(MissingDependencies, { dependencies, panelWidth });
  else if (stage === 'home') content = h(HomeScreen, {
    panelWidth,
    url,
    inputError,
    actionMessage,
    platformHint,
    resolution,
    imageFormat,
    cookieSource,
    playlist,
    autoOpen,
    activeControl,
  });
  else if (stage === 'probing' || stage === 'downloading') content = h(WorkingScreen, {
    stage, media, progress, statusText, panelWidth,
  });
  else if (stage === 'done') content = h(DoneScreen, {
    media, panelWidth, outputDirectory, outputPath, actionMessage,
  });
  else content = h(ErrorScreen, { error, media, panelWidth, cookieSource, actionMessage });

  return h(Box, {
    width: '100%',
    minHeight: Math.max(20, rows - 1),
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  }, h(Logo, { compact: compactLogo }), content);
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
      console.error(`Setup gagal: ${error instanceof Error ? error.message : String(error)}`);
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
    }), { exitOnCtrlC: false });
    await instance.waitUntilExit();
  } finally {
    instance?.unmount();
    leaveAlternateScreen(alternate);
  }
}
