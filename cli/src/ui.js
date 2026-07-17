import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { input, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import figlet from 'figlet';
import ora from 'ora';
import { inspectDependencies } from './dependencies.js';
import { downloadMedia } from './downloader.js';

function center(text) {
  const width = Math.max(process.stdout.columns || 80, 40);
  return text
    .split('\n')
    .map((line) => {
      const visibleLength = line.replace(/\u001b\[[0-9;]*m/gu, '').length;
      const padding = Math.max(0, Math.floor((width - visibleLength) / 2));
      return `${' '.repeat(padding)}${line}`;
    })
    .join('\n');
}

function renderHeader() {
  console.clear();
  const logo = figlet.textSync('YTCONV', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
  });

  console.log(chalk.cyan(center(logo)));
  console.log(center(chalk.dim('paste. choose. download. done.')));
  console.log(center(chalk.dim('YouTube dan media lain yang didukung yt-dlp')));
  console.log('');
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function defaultDownloadDirectory() {
  return path.join(os.homedir(), 'Downloads');
}

function dependencyHelp(dependencies) {
  const missing = [];
  if (!dependencies.ytDlp.installed) missing.push('yt-dlp');
  if (!dependencies.ffmpeg.installed) missing.push('FFmpeg');

  if (missing.length === 0) return null;

  return [
    `Belum ditemukan: ${missing.join(' dan ')}.`,
    '',
    'Windows (PowerShell Administrator):',
    '  winget install yt-dlp.yt-dlp',
    '  winget install Gyan.FFmpeg',
    '',
    'Ubuntu/Debian:',
    '  sudo apt update && sudo apt install -y yt-dlp ffmpeg',
    '',
    'Setelah instalasi, tutup lalu buka kembali terminal.',
  ].join('\n');
}

async function collectOptions() {
  const url = await input({
    message: 'Paste link',
    validate: (value) => (isValidUrl(value.trim()) ? true : 'Masukkan link http/https yang valid.'),
    transformer: (value) => value.trim(),
  });

  const mode = await select({
    message: 'Mau disimpan sebagai apa?',
    choices: [
      { name: 'Audio', value: 'audio', description: 'MP3 atau M4A' },
      { name: 'Video MP4', value: 'video', description: 'Video dan audio digabung oleh FFmpeg' },
    ],
  });

  let audioFormat = 'mp3';
  let audioQuality = '0';
  let resolution = 'best';

  if (mode === 'audio') {
    audioFormat = await select({
      message: 'Format audio',
      choices: [
        { name: 'MP3', value: 'mp3' },
        { name: 'M4A', value: 'm4a' },
      ],
    });

    if (audioFormat === 'mp3') {
      audioQuality = await select({
        message: 'Kualitas MP3',
        choices: [
          { name: 'Terbaik (VBR)', value: '0' },
          { name: '320 kbps', value: '320K' },
          { name: '256 kbps', value: '256K' },
          { name: '192 kbps', value: '192K' },
        ],
      });
    }
  } else {
    resolution = await select({
      message: 'Resolusi maksimum',
      choices: [
        { name: 'Terbaik yang tersedia', value: 'best' },
        { name: '1080p', value: '1080' },
        { name: '720p', value: '720' },
        { name: '480p', value: '480' },
      ],
    });
  }

  const cookiesFromBrowser = await select({
    message: 'Gunakan cookies browser?',
    choices: [
      { name: 'Tidak', value: 'none' },
      { name: 'Chrome', value: 'chrome' },
      { name: 'Microsoft Edge', value: 'edge' },
      { name: 'Firefox', value: 'firefox' },
    ],
  });

  const outputDirectory = await input({
    message: 'Folder penyimpanan',
    default: defaultDownloadDirectory(),
    validate: (value) => (value.trim() ? true : 'Folder tidak boleh kosong.'),
  });

  return {
    url: url.trim(),
    mode,
    audioFormat,
    audioQuality,
    resolution,
    cookiesFromBrowser,
    outputDirectory: path.resolve(outputDirectory.trim()),
  };
}

function showDependencyStatus(dependencies) {
  const ytDlpText = dependencies.ytDlp.installed
    ? chalk.green(`✓ yt-dlp ${dependencies.ytDlp.version ?? ''}`)
    : chalk.red('✗ yt-dlp belum terpasang');
  const ffmpegText = dependencies.ffmpeg.installed
    ? chalk.green(`✓ FFmpeg ${dependencies.ffmpeg.version ?? ''}`)
    : chalk.red('✗ FFmpeg belum terpasang');

  console.log(center(`${ytDlpText}    ${ffmpegText}`));
  console.log('');
}

async function runOneDownload(dependencies) {
  const options = await collectOptions();
  await fs.mkdir(options.outputDirectory, { recursive: true });

  const spinner = ora({
    text: 'Menyiapkan unduhan...',
    spinner: 'dots',
  }).start();

  let lastLog = '';

  try {
    await downloadMedia({
      ytDlpPath: dependencies.ytDlp.path,
      options,
      onProgress: ({ percent, speed, eta }) => {
        const details = [percent || '0%', speed, eta ? `ETA ${eta}` : ''].filter(Boolean).join(' • ');
        spinner.text = `Mengunduh ${details}`;
      },
      onLog: (line, isError) => {
        lastLog = line;
        if (/\[Merger\]|\[ExtractAudio\]|\[Metadata\]|\[EmbedThumbnail\]/u.test(line)) {
          spinner.text = line.replace(/^\[[^\]]+\]\s*/u, 'Memproses: ');
        } else if (isError && /ERROR:/u.test(line)) {
          spinner.text = line;
        }
      },
    });

    spinner.succeed(`Selesai! File tersimpan di ${options.outputDirectory}`);
  } catch (error) {
    spinner.fail('Unduhan gagal.');
    if (lastLog) console.log(chalk.dim(lastLog));
    throw error;
  }
}

export async function runApp() {
  renderHeader();

  const checkSpinner = ora('Memeriksa yt-dlp dan FFmpeg...').start();
  const dependencies = await inspectDependencies();
  checkSpinner.stop();
  showDependencyStatus(dependencies);

  const help = dependencyHelp(dependencies);
  if (help) {
    console.log(chalk.yellow(help));
    process.exitCode = 1;
    return;
  }

  let continueRunning = true;
  while (continueRunning) {
    try {
      await runOneDownload(dependencies);
    } catch (error) {
      console.log(chalk.red(error instanceof Error ? error.message : String(error)));
    }

    console.log('');
    continueRunning = await confirm({
      message: 'Unduh link lain?',
      default: true,
    });

    if (continueRunning) {
      renderHeader();
      showDependencyStatus(dependencies);
    }
  }

  console.log(chalk.cyan('Terima kasih sudah memakai YTConv.'));
}
