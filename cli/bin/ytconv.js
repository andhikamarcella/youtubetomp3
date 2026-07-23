#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  applyCliEnvironment,
  helpText,
  isDirectCommand,
  parseCliOptions,
} from '../src/cli-options.js';
import { inspectDependencies } from '../src/dependencies.js';
import { runDirectCommand } from '../src/direct.js';
import { explainError } from '../src/error-help.js';
import { collectUrls, runHeadlessDownloads } from '../src/headless.js';
import { desktopDownloadsDirectory, isTermux, termuxSharedDownloadsDirectory } from '../src/platform.js';
import { presetText } from '../src/presets.js';
import { socialPlatformLabel } from '../src/social-platforms.js';
import {
  clearCaches,
  examplesText,
  extractSystemOptions,
  printShellInfo,
  repairInstallation,
  selfTest,
  systemHelpText,
} from '../src/system-tools.js';
import { runApp } from '../src/ui.js';
import { checkForUpdate, runSelfUpdate, updateCommand } from '../src/update.js';
import { CLI_VERSION } from '../src/version.js';

function defaultOutputDirectory() {
  if (process.env.YTCONV_OUTPUT) return path.resolve(process.env.YTCONV_OUTPUT);
  if (isTermux()) {
    const androidDownloads = path.join(os.homedir(), 'storage', 'downloads');
    if (fs.existsSync(androidDownloads)) return path.join(androidDownloads, 'YTConv');
    return termuxSharedDownloadsDirectory();
  }
  return desktopDownloadsDirectory();
}

function updateStatusText(updateInfo) {
  if (updateInfo.available) return `tersedia ${updateInfo.latestVersion} (terpasang ${CLI_VERSION})`;
  if (updateInfo.checked) return `sudah terbaru (${CLI_VERSION})`;
  if (updateInfo.disabled) return 'pengecekan dimatikan';
  return `tidak dapat diperiksa${updateInfo.error ? `: ${updateInfo.error}` : ''}`;
}

async function printDiagnostics(platformHint = 'auto') {
  const [dependencies, updateInfo] = await Promise.all([
    inspectDependencies({ repair: false }),
    checkForUpdate({ currentVersion: CLI_VERSION, force: true }),
  ]);
  const outputDirectory = defaultOutputDirectory();
  const rows = [
    ['YTConv', CLI_VERSION],
    ['Update', updateStatusText(updateInfo)],
    ['Node.js', process.version],
    ['Device', dependencies.platform?.termux ? 'Android Termux' : `${process.platform} ${process.arch}`],
    ['TTY', `stdin=${Boolean(process.stdin.isTTY)} stdout=${Boolean(process.stdout.isTTY)}`],
    ['Preset', process.env.YTCONV_PRESET || 'balanced'],
    ['Sosmed', socialPlatformLabel(platformHint)],
    ['yt-dlp', dependencies.ytDlp.installed ? dependencies.ytDlp.version : 'tidak ditemukan'],
    ['yt-dlp runner', dependencies.ytDlp.displayPath || dependencies.ytDlp.path || '-'],
    ['gallery-dl', dependencies.galleryDl?.installed ? dependencies.galleryDl.version : 'tidak ditemukan'],
    ['gallery runner', dependencies.galleryDl?.displayPath || '-'],
    ['FFmpeg', dependencies.ffmpeg.installed ? dependencies.ffmpeg.version : 'tidak ditemukan'],
    ['FFmpeg path', dependencies.ffmpeg.path || '-'],
    ['Output', outputDirectory],
    ['Template', process.env.YTCONV_OUTPUT_TEMPLATE || 'default'],
    ['Audio', `${process.env.YTCONV_AUDIO_FORMAT || 'mp3'} / ${process.env.YTCONV_AUDIO_QUALITY || 'best'}`],
    ['Video', `${process.env.YTCONV_VIDEO_FORMAT || 'auto'} / ${process.env.YTCONV_RESOLUTION || 'best'}`],
    ['Subtitle', process.env.YTCONV_SUBTITLES === '1' ? process.env.YTCONV_SUBTITLE_LANGS : 'off'],
    ['SponsorBlock', process.env.YTCONV_SPONSORBLOCK_MODE || 'off'],
    ['Archive', process.env.YTCONV_ARCHIVE || 'off'],
    ['Cookies', process.env.YTCONV_COOKIES || 'AUTO: publik, file, lalu browser'],
  ];

  console.log('YTConv diagnostics\n');
  for (const [label, value] of rows) console.log(`${label.padEnd(16)} ${value}`);
  if (updateInfo.available) console.log(`\nUpdate tersedia: ${updateCommand()}`);

  if (!dependencies.ready) {
    console.log(`\nBelum siap: ${dependencies.missing.join(', ')}`);
    console.log('Perbaikan otomatis: ytconv --repair');
    return 1;
  }
  console.log('\nStatus: siap digunakan.');
  return 0;
}

async function printUpdateCheck() {
  console.log('Memeriksa update YTConv...');
  const updateInfo = await checkForUpdate({ currentVersion: CLI_VERSION, force: true });
  console.log(updateStatusText(updateInfo));
  if (updateInfo.available) console.log(`Update dengan: ${updateCommand()}`);
  return !updateInfo.checked && !updateInfo.disabled ? 1 : 0;
}

async function performUpdate() {
  const updateInfo = await checkForUpdate({ currentVersion: CLI_VERSION, force: true });
  if (updateInfo.checked && !updateInfo.available) {
    console.log(`YTConv ${CLI_VERSION} sudah versi terbaru.`);
    return 0;
  }

  console.log(updateInfo.available
    ? `Mengupdate YTConv ${CLI_VERSION} → ${updateInfo.latestVersion}...\n`
    : 'Registry tidak dapat diperiksa. Mencoba memasang ytconv@latest...\n');

  const result = runSelfUpdate();
  if (!result.ok) {
    console.error(`\nUpdate otomatis gagal (${result.strategy}): ${result.error.message}`);
    console.error(`Jalankan manual: ${result.command}`);
    console.error('YTConv tidak menghapus instalasi lama dan tidak merusak file hasil.');
    return 1;
  }

  console.log(`\nUpdate selesai melalui ${result.strategy}.`);
  console.log('Tutup terminal, buka kembali, lalu jalankan: ytconv --version');
  return 0;
}

function showUpdateNotice(updateInfo) {
  if (!updateInfo.available) return;
  console.log('\n┌────────────────────────────────────────────────────────────┐');
  console.log(`│ UPDATE YTConv TERSEDIA: ${CLI_VERSION} → ${updateInfo.latestVersion}`.padEnd(61, ' ') + '│');
  console.log('│ Aplikasi tetap dapat dipakai; update tidak lagi memblokir. │');
  console.log(`│ Jalankan: ${updateCommand()}`.padEnd(61, ' ') + '│');
  console.log('└────────────────────────────────────────────────────────────┘\n');
}

async function main() {
  const { system, cleanArgs } = extractSystemOptions(process.argv.slice(2));
  if (system.noColor) {
    process.env.NO_COLOR = '1';
    process.env.FORCE_COLOR = '0';
  }

  let options;
  try {
    options = parseCliOptions(cleanArgs);
  } catch (error) {
    console.error(`YTConv: ${explainError(error)}\n`);
    console.error(`${helpText()}\n${systemHelpText()}`);
    return 2;
  }

  applyCliEnvironment(options);
  if (options.noUpdateCheck) process.env.YTCONV_NO_UPDATE_CHECK = '1';
  if (options.forceGallery) process.env.YTCONV_FORCE_GALLERY = '1';
  else delete process.env.YTCONV_FORCE_GALLERY;
  if (options.forceVideo) process.env.YTCONV_FORCE_VIDEO = '1';
  else delete process.env.YTCONV_FORCE_VIDEO;
  if (options.galleryInclude) process.env.YTCONV_GALLERY_INCLUDE = options.galleryInclude;
  else delete process.env.YTCONV_GALLERY_INCLUDE;
  if (options.outputDirectory) process.env.YTCONV_OUTPUT = options.outputDirectory;
  if (options.cookiesPath) process.env.YTCONV_COOKIES = options.cookiesPath;

  const outputDirectory = defaultOutputDirectory();

  if (options.help) {
    console.log(`${helpText()}\n${systemHelpText()}`);
    return 0;
  }
  if (options.version) {
    console.log(CLI_VERSION);
    return 0;
  }
  if (system.examples) {
    console.log(examplesText());
    return 0;
  }
  if (system.shellInfo) return printShellInfo({ outputDirectory });
  if (system.clearCache) return clearCaches();
  if (system.repair) return repairInstallation();
  if (system.selfTest) return selfTest();
  if (options.listPresets) {
    console.log(`YTConv ${CLI_VERSION} presets\n\n${presetText()}`);
    return 0;
  }
  if (options.checkUpdate) return printUpdateCheck();
  if (options.update) return performUpdate();
  if (options.diagnose) return printDiagnostics(options.initialPlatform);

  if (isDirectCommand(options)) {
    try {
      return await runDirectCommand({ options, outputDirectory });
    } catch (error) {
      console.error(`YTConv:\n${explainError(error)}`);
      return 1;
    }
  }

  const headless = system.headless
    || system.stdin
    || Boolean(system.batchFile)
    || (!process.stdin.isTTY || !process.stdout.isTTY);

  if (headless) {
    try {
      const urls = await collectUrls({
        initialUrl: options.initialUrl,
        batchFile: system.batchFile,
        readStdin: system.stdin,
      });
      return await runHeadlessDownloads({
        options,
        outputDirectory,
        urls,
        continueOnError: system.continueOnError,
        openOutput: system.openOutput,
      });
    } catch (error) {
      console.error(`YTConv headless:\n${explainError(error)}`);
      return 1;
    }
  }

  try {
    const updateInfo = await checkForUpdate({ currentVersion: CLI_VERSION });
    showUpdateNotice(updateInfo);

    await runApp({
      initialUrl: options.initialUrl,
      initialMode: options.initialMode,
      initialPlatform: options.initialPlatform,
      initialPlaylist: options.initialPlaylist,
      initialImageFormat: options.initialImageFormat,
      initialAudioFormat: options.audioFormat,
      initialAudioQuality: options.audioQuality,
      initialVideoFormat: options.videoFormat,
      initialResolution: options.resolution,
      initialSubtitles: options.subtitles,
      initialWriteThumbnail: options.writeThumbnail,
    });
    return 0;
  } catch (error) {
    process.stdout.write('\n');
    console.error(`YTConv berhenti:\n${explainError(error)}`);
    return 1;
  }
}

process.exitCode = await main();
