import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, render, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import figlet from 'figlet';
import ansiShadowFont from 'figlet/importable-fonts/ANSI Shadow.js';
import smallFont from 'figlet/importable-fonts/Small.js';
import { inspectDependencies } from './dependencies.js';
import { downloadMedia, inspectMedia } from './downloader.js';

figlet.parseFont('ANSI Shadow', ansiShadowFont);
figlet.parseFont('Small', smallFont);

const h = React.createElement;
const THEMES = ['auto', 'dark', 'light'];
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

function paletteFor(theme) {
  if (theme === 'light') return { primary: 'blueBright', secondary: 'magentaBright', border: 'blue' };
  if (theme === 'dark') return { primary: 'cyanBright', secondary: 'whiteBright', border: 'gray' };
  return { primary: 'cyan', secondary: 'white', border: 'gray' };
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

  if (process.platform === 'win32') {
    command = 'explorer.exe';
    args = [directory];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [directory];
  } else {
    command = 'xdg-open';
    args = [directory];
  }

  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

function modeSummary({ mode, resolution, audioFormat, audioQuality }) {
  if (mode === 'video') {
    return resolution === 'best' ? 'video · best MP4' : `video · max ${resolution}p MP4`;
  }

  if (audioFormat === 'm4a') return 'audio · M4A';
  return audioQuality === '0' ? 'audio · MP3 best VBR' : `audio · MP3 ${audioQuality.replace('K', ' kbps')}`;
}

function dependencyHelp(dependencies) {
  const missing = [];
  if (!dependencies.ytDlp.installed) missing.push('yt-dlp');
  if (!dependencies.ffmpeg.installed) missing.push('FFmpeg');

  return {
    missing,
    commands: process.platform === 'win32'
      ? ['winget install yt-dlp.yt-dlp', 'winget install Gyan.FFmpeg']
      : ['sudo apt update', 'sudo apt install -y yt-dlp ffmpeg'],
  };
}

function Logo({ palette, compact }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center' },
    h(Text, { color: palette.primary, bold: true }, compact ? LOGO_COMPACT : LOGO_WIDE),
    h(Text, { color: palette.secondary }, 'paste a link. press enter. ytconv handles the rest.'),
    h(Text, { dimColor: true }, 'youtube · x · instagram · tiktok · facebook · reddit · twitch · + many more'),
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
    palette,
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
    theme,
  } = props;

  const inputWidth = Math.max(24, panelWidth - 13);

  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(Box, { width: panelWidth, paddingLeft: 1 }, h(Text, { color: palette.secondary }, 'Paste a link')),
    h(
      Box,
      { width: panelWidth, flexDirection: 'row' },
      h(
        Box,
        { width: inputWidth, borderStyle: 'round', borderColor: inputError ? 'red' : palette.border, paddingX: 1 },
        h(Text, { color: palette.primary }, '▣ '),
        h(TextInput, {
          value: url,
          onChange: setUrl,
          onSubmit: submit,
          placeholder: 'https://youtube.com/watch?v=...',
        }),
      ),
      h(
        Box,
        { width: 11, marginLeft: 1, borderStyle: 'round', borderColor: palette.primary, justifyContent: 'center' },
        h(Text, { color: palette.primary, bold: true }, 'ytconv'),
      ),
    ),
    inputError ? h(Text, { color: 'red' }, inputError) : null,
    h(Box, { marginTop: 1 }, h(SettingLine, { mode, resolution, audioFormat, audioQuality, cookiesFromBrowser, playlist })),
    h(Text, { dimColor: true }, `↵ start  ·  tab format  ·  ^q quality  ·  ^b cookies  ·  ^p playlist  ·  ^t theme:${theme}`),
    mode === 'audio'
      ? h(Text, { dimColor: true }, '^f audio format')
      : null,
  );
}

function MediaCard({ media, palette, panelWidth }) {
  if (!media) return null;
  const duration = formatDuration(media.duration);
  const details = [media.platform, media.uploader, duration].filter(Boolean).join('  ·  ');
  const playlistText = media.isPlaylist ? `  ·  ${media.itemCount} item` : '';

  return h(
    Box,
    { width: panelWidth, borderStyle: 'round', borderColor: palette.border, paddingX: 1, flexDirection: 'column' },
    h(Text, { color: palette.primary, bold: true, wrap: 'truncate-end' }, media.title),
    h(Text, { dimColor: true, wrap: 'truncate-end' }, `${details}${playlistText}`),
  );
}

function WorkingScreen({ stage, media, progress, statusText, palette, panelWidth }) {
  const probing = stage === 'probing';
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, palette, panelWidth }),
    h(Box, { marginTop: 1, flexDirection: 'column', alignItems: 'center' },
      h(Text, { color: palette.primary, bold: true }, probing ? 'checking the link...' : makeProgressBar(progress.percent)),
      h(Text, { dimColor: true }, probing
        ? 'detecting platform and media information'
        : [progress.percent || '0%', progress.speed, progress.eta ? `ETA ${progress.eta}` : ''].filter(Boolean).join('  ·  ')),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, statusText || (probing ? 'please wait' : 'downloading...')),
    ),
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, '^c cancel')),
  );
}

function DoneScreen({ media, palette, panelWidth, outputDirectory, outputPath }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, palette, panelWidth }),
    h(Box, { marginTop: 1, borderStyle: 'round', borderColor: 'green', width: panelWidth, paddingX: 1, flexDirection: 'column' },
      h(Text, { color: 'greenBright', bold: true }, 'done. your media is ready.'),
      h(Text, { dimColor: true, wrap: 'truncate-end' }, outputPath || outputDirectory),
    ),
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, 'o open folder  ·  r another link  ·  ^c quit')),
  );
}

function ErrorScreen({ error, media, palette, panelWidth, cookiesFromBrowser }) {
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, palette, panelWidth }),
    h(Box, { marginTop: 1, borderStyle: 'round', borderColor: 'red', width: panelWidth, paddingX: 1, flexDirection: 'column' },
      h(Text, { color: 'redBright', bold: true }, 'ytconv could not download this link'),
      h(Text, { wrap: 'wrap' }, error),
      h(Text, { dimColor: true }, `cookies: ${cookiesFromBrowser === 'none' ? 'off' : cookiesFromBrowser}`),
    ),
    h(Box, { marginTop: 1, flexDirection: 'column', alignItems: 'center' },
      h(Text, { dimColor: true }, 'r retry  ·  e edit link  ·  ^b change cookies  ·  ^c quit'),
      h(Text, { dimColor: true }, 'Private, login-only, DRM, or unsupported posts may not be downloadable.'),
    ),
  );
}

function MissingDependencies({ dependencies, palette, panelWidth }) {
  const help = dependencyHelp(dependencies);
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(Box, { borderStyle: 'round', borderColor: 'yellow', width: panelWidth, paddingX: 1, flexDirection: 'column' },
      h(Text, { color: 'yellowBright', bold: true }, `Missing: ${help.missing.join(' and ')}`),
      h(Text, null, 'Install the required tools, then close and reopen the terminal:'),
      h(Box, { marginTop: 1, flexDirection: 'column' },
        ...help.commands.map((command) => h(Text, { key: command, color: palette.primary }, command)),
      ),
    ),
    h(Box, { marginTop: 1 }, h(Text, { dimColor: true }, '^c quit')),
  );
}

function App({ dependencies, initialUrl = '' }) {
  const { exit } = useApp();
  const [url, setUrl] = useState(initialUrl);
  const [stage, setStage] = useState('home');
  const [theme, setTheme] = useState('auto');
  const [mode, setMode] = useState('video');
  const [resolution, setResolution] = useState('best');
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [audioQuality, setAudioQuality] = useState('0');
  const [cookiesFromBrowser, setCookiesFromBrowser] = useState('none');
  const [playlist, setPlaylist] = useState(false);
  const [inputError, setInputError] = useState('');
  const [media, setMedia] = useState(null);
  const [progress, setProgress] = useState({ percent: '0%', speed: '', eta: '' });
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const controllerRef = useRef(null);
  const initialSubmittedRef = useRef(false);

  const palette = useMemo(() => paletteFor(theme), [theme]);
  const columns = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  const panelWidth = Math.max(34, Math.min(72, columns - 4));
  const compactLogo = columns < 78;
  const outputDirectory = process.env.YTCONV_OUTPUT
    ? path.resolve(process.env.YTCONV_OUTPUT)
    : path.join(os.homedir(), 'Downloads');
  const hasDependencies = dependencies.ytDlp.installed && dependencies.ffmpeg.installed;

  const reset = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setUrl('');
    setStage('home');
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
      setStatusText('starting download...');

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
    if (configurable && key.tab) {
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
    if (configurable && key.ctrl && input === 't') {
      setTheme((current) => cycle(THEMES, current));
      return;
    }

    if (stage === 'done') {
      if (input.toLowerCase() === 'o') openDirectory(outputDirectory);
      else if (input.toLowerCase() === 'r' || key.escape) reset();
      return;
    }

    if (stage === 'error') {
      if (input.toLowerCase() === 'r') void startDownload(url);
      else if (input.toLowerCase() === 'e' || key.escape) setStage('home');
    }
  });

  let content;
  if (!hasDependencies) {
    content = h(MissingDependencies, { dependencies, palette, panelWidth });
  } else if (stage === 'home') {
    content = h(HomeScreen, {
      palette,
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
      theme,
    });
  } else if (stage === 'probing' || stage === 'downloading') {
    content = h(WorkingScreen, { stage, media, progress, statusText, palette, panelWidth });
  } else if (stage === 'done') {
    content = h(DoneScreen, { media, palette, panelWidth, outputDirectory, outputPath });
  } else {
    content = h(ErrorScreen, { error, media, palette, panelWidth, cookiesFromBrowser });
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
    h(Logo, { palette, compact: compactLogo }),
    content,
  );
}

export async function runApp({ initialUrl = '' } = {}) {
  console.clear();
  const dependencies = await inspectDependencies();
  const instance = render(h(App, { dependencies, initialUrl }), { exitOnCtrlC: false });
  await instance.waitUntilExit();
}
