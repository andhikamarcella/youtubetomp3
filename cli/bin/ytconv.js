#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { helpText, parseCliOptions } from '../src/cli-options.js';
import { inspectDependencies } from '../src/dependencies.js';
import { desktopDownloadsDirectory, isTermux, termuxSharedDownloadsDirectory } from '../src/platform.js';
import { runApp } from '../src/ui.js';
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

async function printDiagnostics() {
  const dependencies = await inspectDependencies();
  const outputDirectory = defaultOutputDirectory();
  const rows = [
    ['YTConv', CLI_VERSION],
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

  if (!dependencies.ytDlp.installed || !dependencies.ffmpeg.installed) {
    console.log('\nSetup yang disarankan:');
    console.log(dependencies.platform?.setupCommand || 'npm rebuild ytconv');
    process.exitCode = 1;
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

if (options.diagnose) {
  await printDiagnostics();
  process.exit(process.exitCode || 0);
}

try {
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
