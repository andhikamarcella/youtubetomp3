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
import { socialLoginHint } from './social-sessions.js';
import { copyText, openOutputFile, openOutputLocation } from './system-actions.js';
import { createTerminalInputDecoder, readClipboardText } from './terminal-input.js';
import { CLI_VERSION } from './version.js';

figlet.parseFont('ANSI Shadow', ansiShadowFont);
figlet.parseFont('Small', smallFont);

const h = React.createElement;
const MODES = ['auto', 'video', 'audio', 'image'];
const VIDEO_QUALITIES = ['best', '2160', '1440', '1080', '720', '480', '360'];
const VIDEO_FORMATS = ['auto', 'mp4', 'mkv', 'webm'];
const AUDIO_FORMATS = ['mp3', 'm4a', 'aac', 'opus', 'flac', 'wav'];
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

async function appendSessionLog(message, kind = 'info') {
  const target = process.env.YTCONV_LOG_FILE;
  if (!target) return;
  const line = `[${new Date().toISOString()}] [${kind}] ${String(message).replace(/[\r\n]+/gu, ' ')}\n`;
  await fs.mkdir(path.dirname(target), { recursive: true }).catch(() => {});
  await fs.appendFile(target, line, 'utf8').catch(() => {});
}

function Logo({ compact, account, authMode }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center' },
    h(Text, { bold: true, color: 'cyan' }, compact ? LOGO_COMPACT : LOGO_WIDE),
    h(Text, { bold: true }, 'paste a social link. convert. done.'),
    h(Text, { dimColor: true }, 'YouTube · Instagram · Facebook · TikTok · X · Pinterest · Reddit · + lainnya'),
    h(Box, { marginTop: 1 },
      h(Text, { color: 'green', bold: true }, `● ${account || 'local user'}`),
      h(Text, { dimColor: true }, ` · ${authMode === 'cloud' ? 'cloud' : 'local device'} · v${CLI_VERSION}`)),
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
  } = props;
  const inputWidth = Math.max(24, panelWidth - 14);
  const buttonFocused = activeControl === 'convert';
  const platform = socialPlatformSummary({ selected: platformHint, url });
  const mediaSetting = mode === 'audio'
    ? `audio:${audioFormat}/${audioQuality}`
    : mode === 'image'
      ? `gambar:${imageFormat.toUpperCase()}`
      : `video:${videoFormat}/${resolution}`;

  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(Box, { width: panelWidth, paddingLeft: 1 }, h(Text, { bold: true, color: 'cyan' }, 'Paste link sosmed')),
    h(
      Box,
      { width: panelWidth, flexDirection: 'row' },
      h(
        Box,
        {
          width: inputWidth,
          borderStyle: activeControl === 'input' ? 'double' : 'round',
          borderColor: activeControl === 'input' ? 'cyan' : 'gray',
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
          borderColor: buttonFocused ? 'green' : 'gray',
          justifyContent: 'center',
        },
        h(Text, { inverse: buttonFocused, color: 'green', bold: true }, buttonFocused ? '» convert «' : ' convert '),
      ),
    ),
    inputError ? h(Text, { color: 'red', bold: true, wrap: 'wrap' }, `! ${inputError}`) : null,
    actionMessage ? h(Text, { color: 'green', wrap: 'wrap' }, `✓ ${actionMessage}`) : null,
    h(
      Box,
      { marginTop: 1 },
      h(Text, { dimColor: true },
        `${platform} · mode:${mode} · ${mediaSetting}`
        + ` · subs:${subtitles ? 'on' : 'off'} · thumb:${writeThumbnail ? 'on' : 'auto'}`),
    ),
    h(Text, { dimColor: true },
      `akses:${cookieSourceLabel(cookieSource)} · playlist:${playlist ? 'on' : 'off'} · auto-open:${autoOpen ? 'on' : 'off'}`),
    h(Text, { dimColor: true }, 'Ctrl+M mode · Ctrl+A audio · Ctrl+T container · Ctrl+Q kualitas'),
    h(Text, { dimColor: true }, 'Ctrl+S subtitle · Ctrl+N thumbnail · Ctrl+F gambar · Ctrl+G sosmed'),
    h(Text, { dimColor: true }, 'Ctrl+B akses akun · Ctrl+P playlist · Ctrl+O auto-open · Ctrl+H bantuan'),
  );
}

function MediaCard({ media, panelWidth }) {
  if (!media) return null;
  const details = [media.platform, media.uploader, durationText(media.duration), media.engine]
    .filter(Boolean).join(' · ');
  return h(
    Box,
    { width: panelWidth, borderStyle: 'round', borderColor: 'cyan', paddingX: 1, flexDirection: 'column' },
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
      h(Text, { bold: true, color: stage === 'probing' ? 'cyan' : 'green' },
        stage === 'probing' ? 'checking the social link...' : progressBar(progress.percent)),
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
    h(Box, { marginTop: 1, borderStyle: 'double', borderColor: 'green', width: panelWidth, paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true, color: 'green' }, '✓ conversion complete'),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, outputPath || outputDirectory),
    ),
    actionMessage ? h(Text, { wrap: 'wrap' }, actionMessage) : null,
    h(Text, { dimColor: true }, 'O buka folder · F buka file · C copy lokasi · R link lain'),
    h(Text, { dimColor: true }, 'H bantuan · D diagnostics · Q/Esc keluar'),
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
      h(Text, { color: 'red', wrap: 'wrap' }, error),
      h(Text, { dimColor: true }, `akses: ${cookieSourceLabel(cookieSource)}`),
    ),
    actionMessage ? h(Text, { wrap: 'wrap' }, actionMessage) : null,
    h(Text, { dimColor: true }, 'R coba lagi · E edit link · Ctrl+B cookies · D diagnostics · Q/Esc keluar'),
    loginHint ? h(Text, { color: 'yellow' }, loginHint) : null,
    h(Text, { dimColor: true }, 'Sesi akun tetap berada di browser dan dilindungi enkripsi browser/OS.'),
  );
}

function HelpScreen({ panelWidth, termux }) {
  const rows = [
    ['Ctrl+M', 'mode AUTO/VIDEO/AUDIO/IMAGE'],
    ['Ctrl+A / Ctrl+T', 'format audio / container video'],
    ['Ctrl+Q / Ctrl+F', 'resolusi video / format gambar'],
    ['Ctrl+S / Ctrl+N', 'subtitle / thumbnail terpisah'],
    ['Ctrl+G', 'pilih nama sosmed / AUTO semua sosmed'],
    ['Ctrl+B', 'akses AUTO / publik / file lama / browser'],
    ['Ctrl+P / Ctrl+O', 'playlist / buka hasil otomatis'],
    ['Enter/click', 'convert link'],
    ['O / F / C', 'buka folder / file / copy lokasi'],
  ];
  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', marginTop: 1 },
    h(Text, { bold: true, color: 'cyan' }, `YTConv ${CLI_VERSION} · keyboard help`),
    ...rows.map(([key, description]) => h(Box, { key, flexDirection: 'row' },
      h(Box, { width: 18 }, h(Text, { bold: true }, key)),
      h(Text, { dimColor: true }, description))),
    h(Text, { dimColor: true }, termux
      ? 'Termux tidak dapat membaca sesi privat browser Android. Link publik tetap dapat diunduh.'
      : 'AUTO mencoba akses publik lalu akun browser yang ditautkan lewat ytconv login PROVIDER.'),
    h(Text, null, 'B kembali · Q/Esc keluar'),
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
    ['Node.js', process.version],
    ['Device', dependencies.platform?.termux ? 'Android Termux' : `${process.platform} ${process.arch}`],
    ['Sosmed', socialPlatformLabel(platformHint)],
    ['Mode', mode],
    ['Audio', audioFormat],
    ['Video', `${videoFormat}/${resolution}`],
    ['Subtitle', subtitles ? 'on' : 'off'],
    ['yt-dlp', dependencies.ytDlp.version || 'not found'],
    ['gallery-dl', dependencies.galleryDl?.version || 'not found'],
    ['FFmpeg', dependencies.ffmpeg.version || 'not found'],
    ['Output', outputDirectory],
    ['Akses akun', cookieSourceLabel(cookieSource)],
  ];
  return h(
    Box,
    { width: panelWidth, flexDirection: 'column', marginTop: 1 },
    h(Text, { bold: true, color: 'cyan' }, 'YTConv diagnostics'),
    ...rows.map(([label, value]) => h(Box, { key: label, flexDirection: 'row' },
      h(Box, { width: 16 }, h(Text, { bold: true }, label)),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, String(value)))),
    h(Text, null, 'B kembali · Q/Esc keluar'),
  );
}

function MissingDependencies({ dependencies, panelWidth }) {
  const missing = dependencies.missing?.length ? dependencies.missing.join(', ') : 'engine media';
  const errors = (dependencies.errors || []).slice(0, 2);
  return h(
    Box,
    { width: panelWidth, borderStyle: 'double', borderColor: 'yellow', paddingX: 1, flexDirection: 'column' },
    h(Text, { bold: true, color: 'yellow' }, '! Persiapan otomatis belum selesai'),
    h(Text, { color: 'yellow' }, `Belum siap: ${missing}`),
    ...errors.map((item) => h(Text, { key: item, dimColor: true, wrap: 'wrap' }, `• ${item}`)),
    h(Text, { color: 'cyan' }, 'Jalankan: ytconv repair'),
    h(Text, { dimColor: true, wrap: 'wrap' }, dependencies.platform?.setupCommand || 'Jika masih gagal, jalankan ytconv doctor lalu ikuti solusi yang ditampilkan.'),
    h(Text, { dimColor: true }, 'Q/Esc/Ctrl+C keluar'),
  );
}

function logoLines(compact) {
  return (compact ? LOGO_COMPACT : LOGO_WIDE).split('\n').filter(Boolean).length;
}

function controlBounds({ columns, rows, panelWidth, compactLogo }) {
  const rootHeight = Math.max(20, rows - 1);
  const logoHeight = logoLines(compactLogo) + 2;
  const homeHeight = 14;
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
    await appendSessionLog(`START ${value} mode=${mode} audio=${audioFormat}/${audioQuality} video=${videoFormat}/${resolution}`);

    let cookieConfigs;
    try {
      await fs.mkdir(outputDirectory, { recursive: true });
      cookieConfigs = await resolveCookieConfigs({ source: cookieSource, outputDirectory, url: value });
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
              if (/Tersimpan:/u.test(line)) setStatusText(line);
              else if (/gallery|gambar|image|carousel|Merger|ExtractAudio|VideoRemuxer|SponsorBlock/iu.test(line)) setStatusText(line);
            },
          });

          const finalPath = result.outputPath || outputDirectory;
          setOutputPath(finalPath);
          setProgress((current) => ({ ...current, percent: '100%' }));
          setStatusText(`${result.fileCount || 1} file · ${result.engine || 'done'}`);
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
      setActionMessage('pilihan sosmed diubah');
      return;
    }
    if (configurable && key.ctrl && lower === 'f') {
      setImageFormat((current) => cycle(IMAGE_FORMATS, current));
      setMode('image');
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
  });
  else if (stage === 'probing' || stage === 'downloading') content = h(WorkingScreen, {
    stage, media, progress, statusText, panelWidth,
  });
  else if (stage === 'done') content = h(DoneScreen, {
    media, panelWidth, outputDirectory, outputPath, actionMessage,
  });
  else content = h(ErrorScreen, { error, media, panelWidth, cookieSource, actionMessage, url });

  return h(Box, {
    width: '100%',
    minHeight: Math.max(20, rows - 1),
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  }, h(Logo, {
    compact: compactLogo,
    account: process.env.YTCONV_ACCOUNT_LABEL,
    authMode: process.env.YTCONV_AUTH_MODE,
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
