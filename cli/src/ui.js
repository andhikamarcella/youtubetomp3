import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, render, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import figlet from 'figlet';
import ansiShadowFont from 'figlet/importable-fonts/ANSI Shadow.js';
import smallFont from 'figlet/importable-fonts/Small.js';
import { inspectDependencies, prepareTermuxDependencies } from './dependencies.js';
import { downloadMedia, inspectMedia } from './downloader.js';
import {
  desktopDownloadsDirectory,
  isTermux,
  termuxSharedDownloadsDirectory,
} from './platform.js';

figlet.parseFont('ANSI Shadow', ansiShadowFont);
figlet.parseFont('Small', smallFont);

const h = React.createElement;
const COOKIE_BROWSERS = ['none', 'chrome', 'edge', 'firefox', 'brave', 'chromium', 'opera', 'vivaldi'];
const VIDEO_QUALITIES = ['best', '2160', '1440', '1080', '720', '480'];
const AUDIO_QUALITIES = ['0', '320K', '256K', '192K', '128K'];
const AUDIO_FORMATS = ['mp3', 'm4a'];

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

function openDirectory(directory) {
  let command;
  let args;

  if (isTermux()) {
    command = 'termux-open';
    args = [directory];
  } else if (process.platform === 'win32') {
    command = 'explorer.exe';
    args = [directory];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [directory];
  } else {
    command = 'xdg-open';
    args = [directory];
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.on('error', () => {});
  child.unref();
}

function modeSummary({ mode, resolution, audioFormat, audioQuality }) {
  if (mode === 'video') {
    return resolution === 'best' ? 'video · best MP4' : `video · max ${resolution}p MP4`;
  }

  if (audioFormat === 'm4a') return 'audio · M4A';
  return audioQuality === '0'
    ? 'audio · MP3 best VBR'
    : `audio · MP3 ${audioQuality.replace('K', ' kbps')}`;
}

function Logo({ compact }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center' },
    h(Text, { bold: true }, compact ? LOGO_COMPACT : LOGO_WIDE),
    h(Text, null, 'paste any video. convert. done.'),
    h(Text, { dimColor: true }, 'youtube · x · instagram · tiktok · facebook · reddit · twitch · +1800 more'),
  );
}

function SettingLine({ mode, resolution, audioFormat, audioQuality, cookiesFromBrowser, playlist }) {
  const cookieLabel = cookiesFromBrowser === 'none' ? 'cookies:off' : `cookies:${cookiesFromBrowser}`;
  return h(
    Text,
    { dimColor: true },
    `${modeSummary({ mode, resolution, audioFormat, audioQuality })}  ·  ${cookieLabel}  ·  playlist:${playlist ? 'on' : 'off'}`,
  );
}

function HomeScreen(props) {
  const {
    panelWidth,
    url,
    setUrl,
    submit,
    inputError,
    mode,
    resolution,
    audioFormat,
    audioQuality,
    cookiesFromBrowser,
    playlist,
    activeControl,
  } = props;

  const inputWidth = Math.max(24, panelWidth - 14);
  const buttonFocused = activeControl === 'convert';

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
        h(TextInput, {
          value: url,
          onChange: setUrl,
          onSubmit: submit,
          placeholder: 'https://youtube.com/watch?v=...',
          focus: activeControl === 'input',
          showCursor: activeControl === 'input',
        }),
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
    inputError ? h(Text, { inverse: true }, ` ${inputError} `) : null,
    h(
      Box,
      { marginTop: 1 },
      h(SettingLine, { mode, resolution, audioFormat, audioQuality, cookiesFromBrowser, playlist }),
    ),
    h(Text, { dimColor: true }, 'tap/click convert  ·  tab select  ·  enter run  ·  ^g format'),
    h(Text, { dimColor: true }, '^q quality  ·  ^b cookies  ·  ^p playlist'),
    mode === 'audio' ? h(Text, { dimColor: true }, '^f audio format') : null,
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
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, '^c cancel')),
  );
}

function DoneScreen({ media, panelWidth, outputDirectory, outputPath }) {
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
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, 'o open folder  ·  r another link  ·  ^c quit')),
  );
}

function ErrorScreen({ error, media, panelWidth, cookiesFromBrowser }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, panelWidth }),
    h(
      Box,
      { marginTop: 1, borderStyle: 'double', width: panelWidth, paddingX: 1, flexDirection: 'column' },
      h(Text, { bold: true, inverse: true }, ' conversion failed '),
      h(Text, { wrap: 'wrap' }, error),
      h(Text, { dimColor: true }, `cookies: ${cookiesFromBrowser === 'none' ? 'off' : cookiesFromBrowser}`),
    ),
    h(
      Box,
      { marginTop: 1, flexDirection: 'column', alignItems: 'center' },
      h(Text, { dimColor: true }, 'r retry  ·  e edit link  ·  ^b change cookies  ·  ^c quit'),
      h(Text, { dimColor: true }, 'Private, login-only, paid, DRM, or unsupported posts may fail.'),
    ),
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
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, '^c quit')),
  );
}

function logoLineCount(compact) {
  return (compact ? LOGO_COMPACT : LOGO_WIDE)
    .split('\n')
    .filter((line) => line.length > 0)
    .length;
}

function convertButtonBounds({ columns, rows, panelWidth, compactLogo, mode }) {
  const rootHeight = Math.max(20, rows - 1);
  const logoHeight = logoLineCount(compactLogo) + 2;
  const homeHeight = 1 + 1 + 3 + 1 + 1 + 2 + (mode === 'audio' ? 1 : 0);
  const totalHeight = logoHeight + homeHeight;
  const rootTop = Math.max(1, Math.floor((rootHeight - totalHeight) / 2) + 1);
  const panelLeft = Math.max(1, Math.floor((columns - panelWidth) / 2) + 1);
  const inputWidth = Math.max(24, panelWidth - 14);
  const buttonLeft = panelLeft + inputWidth + 1;
  const inputTop = rootTop + logoHeight + 2;

  return {
    left: buttonLeft - 1,
    right: buttonLeft + 12,
    top: inputTop - 1,
    bottom: inputTop + 3,
  };
}

function parseMouseEvents(chunk) {
  const events = [];
  const text = chunk.toString();
  const expression = /\u001b\[<(\d+);(\d+);(\d+)([Mm])/gu;
  let match;
  while ((match = expression.exec(text)) !== null) {
    events.push({
      button: Number.parseInt(match[1], 10),
      x: Number.parseInt(match[2], 10),
      y: Number.parseInt(match[3], 10),
      pressed: match[4] === 'M',
    });
  }
  return events;
}

function App({ dependencies, initialUrl = '' }) {
  const { exit } = useApp();
  const [url, setUrl] = useState(initialUrl);
  const [stage, setStage] = useState('home');
  const [mode, setMode] = useState('video');
  const [resolution, setResolution] = useState('best');
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [audioQuality, setAudioQuality] = useState('0');
  const [cookiesFromBrowser, setCookiesFromBrowser] = useState('none');
  const [playlist, setPlaylist] = useState(false);
  const [activeControl, setActiveControl] = useState('input');
  const [inputError, setInputError] = useState('');
  const [media, setMedia] = useState(null);
  const [progress, setProgress] = useState({ percent: '0%', speed: '', eta: '' });
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const controllerRef = useRef(null);
  const initialSubmittedRef = useRef(false);
  const startDownloadRef = useRef(null);

  const columns = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  const panelWidth = Math.max(34, Math.min(72, columns - 4));
  const compactLogo = columns < 78;
  const outputDirectory = process.env.YTCONV_OUTPUT
    ? path.resolve(process.env.YTCONV_OUTPUT)
    : (isTermux() ? termuxSharedDownloadsDirectory() : desktopDownloadsDirectory());
  const hasDependencies = dependencies.ytDlp.installed && dependencies.ffmpeg.installed;

  const reset = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setUrl('');
    setStage('home');
    setActiveControl('input');
    setInputError('');
    setMedia(null);
    setProgress({ percent: '0%', speed: '', eta: '' });
    setStatusText('');
    setError('');
    setOutputPath('');
  };

  const startDownload = async (candidate = url) => {
    const normalizedUrl = candidate.trim();
    if (!isValidUrl(normalizedUrl)) {
      setInputError('Paste a valid http/https link.');
      setActiveControl('input');
      return;
    }
    if (!hasDependencies || ['probing', 'downloading'].includes(stage)) return;

    setUrl(normalizedUrl);
    setInputError('');
    setError('');
    setMedia(null);
    setOutputPath('');
    setProgress({ percent: '0%', speed: '', eta: '' });
    setStatusText('reading metadata...');
    setStage('probing');

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const inspected = await inspectMedia({
        ytDlpPath: dependencies.ytDlp.path,
        url: normalizedUrl,
        cookiesFromBrowser,
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
          cookiesFromBrowser,
          playlist,
          outputDirectory,
          ffmpegPath: dependencies.ffmpeg.path,
        },
        onProgress: (nextProgress) => setProgress(nextProgress),
        onLog: (line) => {
          if (/\[Merger\]/u.test(line)) setStatusText('merging video and audio...');
          else if (/\[ExtractAudio\]/u.test(line)) setStatusText('converting audio...');
          else if (/\[EmbedThumbnail\]/u.test(line)) setStatusText('embedding thumbnail...');
          else if (/\[Metadata\]/u.test(line)) setStatusText('writing metadata...');
          else if (/Tersimpan:/u.test(line)) setStatusText(line);
        },
      });

      setOutputPath(result.outputPath || outputDirectory);
      setProgress((current) => ({ ...current, percent: '100%' }));
      setStatusText('complete');
      setStage('done');
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof Error ? caught.message : String(caught));
      setStage('error');
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  };

  startDownloadRef.current = startDownload;

  useEffect(() => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) return undefined;

    const enableMouse = '\u001b[?1000h\u001b[?1006h';
    const disableMouse = '\u001b[?1000l\u001b[?1006l';
    process.stdout.write(enableMouse);

    const handleMouseData = (chunk) => {
      if (stage !== 'home') return;
      const bounds = convertButtonBounds({ columns, rows, panelWidth, compactLogo, mode });
      for (const event of parseMouseEvents(chunk)) {
        const primaryPress = event.pressed && (event.button & 3) === 0;
        const inside = event.x >= bounds.left
          && event.x <= bounds.right
          && event.y >= bounds.top
          && event.y <= bounds.bottom;
        if (primaryPress && inside) {
          setActiveControl('convert');
          void startDownloadRef.current?.(url);
        }
      }
    };

    process.stdin.prependListener('data', handleMouseData);
    return () => {
      process.stdin.removeListener('data', handleMouseData);
      if (process.stdout.writable) process.stdout.write(disableMouse);
    };
  }, [stage, url, columns, rows, panelWidth, compactLogo, mode]);

  useEffect(() => {
    if (!initialUrl || initialSubmittedRef.current || !hasDependencies) return;
    initialSubmittedRef.current = true;
    void startDownload(initialUrl);
  }, [initialUrl, hasDependencies]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      controllerRef.current?.abort();
      exit();
      return;
    }

    if (!hasDependencies) return;

    const configurable = stage === 'home' || stage === 'error';
    if (stage === 'home' && key.tab) {
      setActiveControl((current) => (current === 'input' ? 'convert' : 'input'));
      return;
    }
    if (stage === 'home' && activeControl === 'convert' && (key.return || input === ' ')) {
      void startDownload(url);
      return;
    }
    if (configurable && key.ctrl && input === 'g') {
      setMode((current) => (current === 'video' ? 'audio' : 'video'));
      return;
    }
    if (configurable && key.ctrl && input === 'q') {
      if (mode === 'video') setResolution((current) => cycle(VIDEO_QUALITIES, current));
      else setAudioQuality((current) => cycle(AUDIO_QUALITIES, current));
      return;
    }
    if (configurable && key.ctrl && input === 'f' && mode === 'audio') {
      setAudioFormat((current) => cycle(AUDIO_FORMATS, current));
      return;
    }
    if (configurable && key.ctrl && input === 'b') {
      setCookiesFromBrowser((current) => cycle(COOKIE_BROWSERS, current));
      return;
    }
    if (configurable && key.ctrl && input === 'p') {
      setPlaylist((current) => !current);
      return;
    }

    if (stage === 'done') {
      if (input.toLowerCase() === 'o') openDirectory(outputDirectory);
      else if (input.toLowerCase() === 'r' || key.escape) reset();
      return;
    }

    if (stage === 'error') {
      if (input.toLowerCase() === 'r') void startDownload(url);
      else if (input.toLowerCase() === 'e' || key.escape) {
        setStage('home');
        setActiveControl('input');
      }
    }
  });

  let content;
  if (!hasDependencies) {
    content = h(MissingDependencies, { dependencies, panelWidth });
  } else if (stage === 'home') {
    content = h(HomeScreen, {
      panelWidth,
      url,
      setUrl,
      submit: startDownload,
      inputError,
      mode,
      resolution,
      audioFormat,
      audioQuality,
      cookiesFromBrowser,
      playlist,
      activeControl,
    });
  } else if (stage === 'probing' || stage === 'downloading') {
    content = h(WorkingScreen, { stage, media, progress, statusText, panelWidth });
  } else if (stage === 'done') {
    content = h(DoneScreen, { media, panelWidth, outputDirectory, outputPath });
  } else {
    content = h(ErrorScreen, { error, media, panelWidth, cookiesFromBrowser });
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

export async function runApp({ initialUrl = '' } = {}) {
  console.clear();
  process.stdout.write('Preparing YTConv...\r');
  let dependencies = await inspectDependencies();

  if (
    dependencies.platform?.termux
    && (!dependencies.ytDlp.installed || !dependencies.ffmpeg.installed)
  ) {
    console.clear();
    console.log('YTConv first-run setup for Termux');
    console.log('Installing Android-compatible yt-dlp and FFmpeg. Please wait...\n');
    await prepareTermuxDependencies();
    dependencies = await inspectDependencies();
    console.log('\nYTConv setup finished.');
    await sleep(700);
  }

  console.clear();
  const instance = render(h(App, { dependencies, initialUrl }), { exitOnCtrlC: false });
  await instance.waitUntilExit();
}
