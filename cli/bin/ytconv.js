#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline/promises';
import { helpText, parseCliOptions } from '../src/cli-options.js';
import { inspectDependencies } from '../src/dependencies.js';
import { desktopDownloadsDirectory, isTermux, termuxSharedDownloadsDirectory } from '../src/platform.js';
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
  if (updateInfo.available) {
    return `tersedia ${updateInfo.latestVersion} (terpasang ${CLI_VERSION})`;
  }
  if (updateInfo.checked) return `sudah terbaru (${CLI_VERSION})`;
  if (updateInfo.disabled) return 'pengecekan dimatikan';
  return `tidak dapat diperiksa${updateInfo.error ? `: ${updateInfo.error}` : ''}`;
}

async function printDiagnostics() {
  const [dependencies, updateInfo] = await Promise.all([
    inspectDependencies(),
    checkForUpdate({ currentVersion: CLI_VERSION, force: true }),
  ]);
  const outputDirectory = defaultOutputDirectory();
  const rows = [
    ['YTConv', CLI_VERSION],
    ['Update', updateStatusText(updateInfo)],
    ['Node.js', process.version],
    ['Platform', dependencies.platform?.termux ? 'Android Termux' : `${process.platform} ${process.arch}`],
    ['yt-dlp', dependencies.ytDlp.installed ? dependencies.ytDlp.version : 'tidak ditemukan'],
    ['yt-dlp runner', dependencies.ytDlp.displayPath || dependencies.ytDlp.path || '-'],
    ['FFmpeg', dependencies.ffmpeg.installed ? dependencies.ffmpeg.version : 'tidak ditemukan'],
    ['FFmpeg path', dependencies.ffmpeg.path || '-'],
    ['Output', outputDirectory],
    ['Cookies file', process.env.YTCONV_COOKIES || 'tidak dipilih'],
  ];

  console.log('YTConv diagnostics\n');
  for (const [label, value] of rows) console.log(`${label.padEnd(14)} ${value}`);

  if (updateInfo.available) {
    console.log(`\nUpdate dengan: ${updateCommand()}`);
  }

  if (!dependencies.ytDlp.installed || !dependencies.ffmpeg.installed) {
    console.log('\nSetup yang disarankan:');
    console.log(dependencies.platform?.setupCommand || 'npm rebuild ytconv');
    process.exitCode = 1;
  }
}

async function printUpdateCheck() {
  console.log('Memeriksa update YTConv...');
  const updateInfo = await checkForUpdate({ currentVersion: CLI_VERSION, force: true });
  console.log(updateStatusText(updateInfo));
  if (updateInfo.available) console.log(`Update dengan: ${updateCommand()}`);
  if (!updateInfo.checked && !updateInfo.disabled) process.exitCode = 1;
  return updateInfo;
}

async function performUpdate() {
  const updateInfo = await checkForUpdate({ currentVersion: CLI_VERSION, force: true });
  if (updateInfo.checked && !updateInfo.available) {
    console.log(`YTConv ${CLI_VERSION} sudah versi terbaru.`);
    return;
  }

  console.log(updateInfo.available
    ? `Mengupdate YTConv ${CLI_VERSION} → ${updateInfo.latestVersion}...\n`
    : 'Versi terbaru tidak dapat diperiksa, mencoba memasang ytconv@latest...\n');

  const result = runSelfUpdate();
  if (!result.ok) {
    console.error(`\nUpdate gagal: ${result.error.message}`);
    console.error(`Jalankan manual: ${result.command}`);
    process.exitCode = 1;
    return;
  }

  console.log('\nUpdate selesai. Tutup terminal ini, buka terminal baru, lalu jalankan:');
  console.log('ytconv --version');
  console.log('ytconv');
}

async function showStartupUpdateNotice(updateInfo) {
  if (!updateInfo.available) return false;

  console.log('\n┌────────────────────────────────────────────────────────────┐');
  console.log(`│ Update YTConv tersedia: ${CLI_VERSION} → ${updateInfo.latestVersion}`.padEnd(61, ' ') + '│');
  console.log('│ Ketik U lalu Enter untuk update sekarang.                  │');
  console.log(`│ Nanti juga bisa: ${updateCommand()}`.padEnd(61, ' ') + '│');
  console.log('└────────────────────────────────────────────────────────────┘');

  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;

  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question('U = update sekarang · Enter = lanjut memakai versi lama: ');
    return answer.trim().toLowerCase() === 'u';
  } finally {
    prompt.close();
  }
}

let options;
try {
  options = parseCliOptions(process.argv.slice(2));
} catch (error) {
  console.error(`YTConv: ${error instanceof Error ? error.message : String(error)}\n`);
  console.error(helpText());
  process.exit(1);
}

if (options.noUpdateCheck) process.env.YTCONV_NO_UPDATE_CHECK = '1';

if (options.help) {
  console.log(helpText());
  process.exit(0);
}

if (options.version) {
  console.log(CLI_VERSION);
  process.exit(0);
}

if (options.outputDirectory) process.env.YTCONV_OUTPUT = options.outputDirectory;
if (options.cookiesPath) process.env.YTCONV_COOKIES = options.cookiesPath;

if (options.checkUpdate) {
  await printUpdateCheck();
  process.exit(process.exitCode || 0);
}

if (options.update) {
  await performUpdate();
  process.exit(process.exitCode || 0);
}

if (options.diagnose) {
  await printDiagnostics();
  process.exit(process.exitCode || 0);
}

try {
  const updateInfo = await checkForUpdate({ currentVersion: CLI_VERSION });
  if (await showStartupUpdateNotice(updateInfo)) {
    await performUpdate();
    process.exit(process.exitCode || 0);
  }

  await runApp({
    initialUrl: options.initialUrl,
    initialMode: options.initialMode,
    initialPlaylist: options.initialPlaylist,
  });
} catch (error) {
  process.stdout.write('\n');
  console.error(`YTConv berhenti: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
