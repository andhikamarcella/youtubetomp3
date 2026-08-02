#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { applyExplicitPrecedence } from '../src/argument-precedence.js';
import { applyBetaDefaults, betaDefaultsHelpText, extractBetaToggles } from '../src/beta-defaults.js';
import { applyCliEnvironment, helpText, isDirectCommand, parseCliOptions } from '../src/cli-options.js';
import { commandSummaryText, normalizeCommandArgs } from '../src/commands.js';
import { inspectDependencies } from '../src/dependencies.js';
import { runDirectCommand } from '../src/direct.js';
import { explainError } from '../src/error-help.js';
import { EXIT_CODES, exitCodeForError } from '../src/exit-codes.js';
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
import {
  appendHistory,
  handleUserDataCommand,
  resolveUserArguments,
  userDataHelpText,
} from '../src/user-data.js';
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
  if (updateInfo.available) return `${updateInfo.latestVersion} available (installed ${CLI_VERSION})`;
  if (updateInfo.checked) return `up to date (${CLI_VERSION})`;
  if (updateInfo.disabled) return 'update check disabled';
  return `unable to check${updateInfo.error ? `: ${updateInfo.error}` : ''}`;
}

async function printDiagnostics(platformHint = 'auto', profile = '') {
  const [dependencies, updateInfo] = await Promise.all([
    inspectDependencies({ repair: false }),
    checkForUpdate({ currentVersion: CLI_VERSION, force: true }),
  ]);
  const outputDirectory = defaultOutputDirectory();
  const distro = dependencies.platform?.distro;
  const rows = [
    ['YTConv', CLI_VERSION],
    ['Update', updateStatusText(updateInfo)],
    ['Node.js', process.version],
    ['Device', dependencies.platform?.termux ? 'Android Termux' : `${process.platform} ${process.arch}`],
    ['Distribution', distro?.name || '-'],
    ['Package manager', distro?.manager || '-'],
    ['TTY', `stdin=${Boolean(process.stdin.isTTY)} stdout=${Boolean(process.stdout.isTTY)}`],
    ['Saved profile', profile || 'none'],
    ['Preset', process.env.YTCONV_PRESET || 'balanced'],
    ['Platform', socialPlatformLabel(platformHint)],
    ['yt-dlp', dependencies.ytDlp.installed ? dependencies.ytDlp.version : 'not found'],
    ['yt-dlp runner', dependencies.ytDlp.displayPath || dependencies.ytDlp.path || '-'],
    ['gallery-dl', dependencies.galleryDl?.installed ? dependencies.galleryDl.version : 'not found'],
    ['gallery runner', dependencies.galleryDl?.displayPath || '-'],
    ['FFmpeg', dependencies.ffmpeg.installed ? dependencies.ffmpeg.version : 'not found'],
    ['FFmpeg path', dependencies.ffmpeg.path || '-'],
    ['ffprobe', dependencies.ffprobe?.installed ? dependencies.ffprobe.version : 'optional/not found'],
    ['Output', outputDirectory],
    ['Template', process.env.YTCONV_OUTPUT_TEMPLATE || 'default'],
    ['Audio', `${process.env.YTCONV_AUDIO_FORMAT || 'mp3'} / ${process.env.YTCONV_AUDIO_QUALITY || 'best'}`],
    ['Video', `${process.env.YTCONV_VIDEO_FORMAT || 'auto'} / ${process.env.YTCONV_RESOLUTION || 'best'}`],
    ['Subtitles', process.env.YTCONV_SUBTITLES === '1' ? process.env.YTCONV_SUBTITLE_LANGS : 'off'],
    ['SponsorBlock', process.env.YTCONV_SPONSORBLOCK_MODE || 'off'],
    ['yt-dlp archive', process.env.YTCONV_ARCHIVE || 'off'],
    ['gallery archive', process.env.YTCONV_GALLERY_ARCHIVE || 'off'],
    ['Resume', process.env.YTCONV_RESUME === '0' ? 'off' : 'on'],
    ['Retries', process.env.YTCONV_RETRIES || '10'],
    ['Cookies', process.env.YTCONV_BROWSER_COOKIE_SPEC
      ? `browser:${process.env.YTCONV_BROWSER_COOKIE_SPEC}`
      : process.env.YTCONV_COOKIES || 'AUTO: public, file, then browser'],
  ];

  console.log('YTConv doctor\n');
  for (const [label, value] of rows) console.log(`${label.padEnd(18)} ${value}`);
  if (updateInfo.available) console.log(`\nUpdate available: ${updateCommand()}`);

  if (!dependencies.ready) {
    console.log(`\nMissing requirements: ${dependencies.missing.join(', ')}`);
    console.log('Automatic repair: ytconv repair');
    if (dependencies.platform?.setupCommand) console.log(`Distribution setup: ${dependencies.platform.setupCommand}`);
    return EXIT_CODES.DEPENDENCY_MISSING;
  }
  console.log('\nStatus: ready to use.');
  return EXIT_CODES.SUCCESS;
}

async function printUpdateCheck() {
  console.log('Checking for YTConv updates...');
  const updateInfo = await checkForUpdate({ currentVersion: CLI_VERSION, force: true });
  console.log(updateStatusText(updateInfo));
  if (updateInfo.available) console.log(`Update with: ${updateCommand()}`);
  return !updateInfo.checked && !updateInfo.disabled ? EXIT_CODES.TEMPORARY_FAILURE : EXIT_CODES.SUCCESS;
}

async function performUpdate() {
  const updateInfo = await checkForUpdate({ currentVersion: CLI_VERSION, force: true });
  if (updateInfo.checked && !updateInfo.available) {
    console.log(`YTConv ${CLI_VERSION} is already up to date.`);
    return EXIT_CODES.SUCCESS;
  }

  console.log(updateInfo.available
    ? `Updating YTConv ${CLI_VERSION} → ${updateInfo.latestVersion}...\n`
    : 'The registry could not be checked. Trying the active YTConv channel...\n');

  const result = runSelfUpdate({ currentVersion: CLI_VERSION });
  if (!result.ok) {
    console.error(`\nAutomatic update failed (${result.strategy}): ${result.error.message}`);
    console.error(`Run manually: ${result.command}`);
    console.error('The previous installation and downloaded files were not removed.');
    return exitCodeForError(result.error);
  }

  console.log(`\nUpdate completed using ${result.strategy}.`);
  console.log('Close the terminal, open it again, then run: ytconv --version');
  return EXIT_CODES.SUCCESS;
}

function showUpdateNotice(updateInfo) {
  if (!updateInfo.available) return;
  console.log('\n┌────────────────────────────────────────────────────────────┐');
  console.log(`│ YTConv UPDATE AVAILABLE: ${CLI_VERSION} → ${updateInfo.latestVersion}`.padEnd(61, ' ') + '│');
  console.log('│ YTConv remains usable; updates never block normal use.     │');
  console.log(`│ Run: ${updateCommand(CLI_VERSION)}`.padEnd(61, ' ') + '│');
  console.log('└────────────────────────────────────────────────────────────┘\n');
}

function fullHelpText() {
  return `${commandSummaryText()}${betaDefaultsHelpText()}${userDataHelpText()}${helpText()}\n${systemHelpText()}`;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  try {
    const admin = await handleUserDataCommand(rawArgs);
    if (admin.handled) return admin.exitCode;
  } catch (error) {
    console.error(`YTConv: ${explainError(error)}`);
    return exitCodeForError(error);
  }

  let system;
  let cleanArgs;
  let options;
  let selectedProfile = '';
  try {
    const explicitArgs = normalizeCommandArgs(rawArgs);
    const resolved = await resolveUserArguments(explicitArgs);
    selectedProfile = resolved.profile;
    const effectiveArgs = applyExplicitPrecedence(resolved.args, explicitArgs);
    const toggles = extractBetaToggles(effectiveArgs);
    ({ system, cleanArgs } = extractSystemOptions(toggles.cleanArgs));
    options = parseCliOptions(cleanArgs);
    const informationalOnly = options.help || options.version || system.examples || system.shellInfo
      || system.clearCache || system.repair || options.listPresets || options.checkUpdate
      || options.update || options.diagnose;
    if (!informationalOnly || system.selfTest) applyBetaDefaults(options, toggles);
  } catch (error) {
    console.error(`YTConv: ${explainError(error)}\n`);
    console.error(fullHelpText());
    return exitCodeForError(error);
  }

  if (system.noColor) {
    process.env.NO_COLOR = '1';
    process.env.FORCE_COLOR = '0';
  }
  applyCliEnvironment(options);
  if (options.galleryArchivePath) process.env.YTCONV_GALLERY_ARCHIVE = options.galleryArchivePath;
  else delete process.env.YTCONV_GALLERY_ARCHIVE;
  if (options.noUpdateCheck) process.env.YTCONV_NO_UPDATE_CHECK = '1';
  if (options.forceGallery) process.env.YTCONV_FORCE_GALLERY = '1'; else delete process.env.YTCONV_FORCE_GALLERY;
  if (options.forceVideo) process.env.YTCONV_FORCE_VIDEO = '1'; else delete process.env.YTCONV_FORCE_VIDEO;
  if (options.galleryInclude) process.env.YTCONV_GALLERY_INCLUDE = options.galleryInclude; else delete process.env.YTCONV_GALLERY_INCLUDE;
  if (options.outputDirectory) process.env.YTCONV_OUTPUT = options.outputDirectory;
  if (options.cookiesPath) process.env.YTCONV_COOKIES = options.cookiesPath;

  const outputDirectory = defaultOutputDirectory();

  if (options.help) { console.log(fullHelpText()); return EXIT_CODES.SUCCESS; }
  if (options.version) { console.log(CLI_VERSION); return EXIT_CODES.SUCCESS; }
  if (system.examples) { console.log(examplesText()); return EXIT_CODES.SUCCESS; }
  if (system.shellInfo) return printShellInfo({ outputDirectory });
  if (system.clearCache) return clearCaches();
  if (system.repair) return repairInstallation();
  if (system.selfTest) return selfTest({ outputDirectory });
  if (options.listPresets) {
    console.log(`YTConv ${CLI_VERSION} presets\n\n${presetText()}`);
    return EXIT_CODES.SUCCESS;
  }
  if (options.checkUpdate) return printUpdateCheck();
  if (options.update) return performUpdate();
  if (options.diagnose) return printDiagnostics(options.initialPlatform, selectedProfile);

  if (isDirectCommand(options)) {
    try {
      return await runDirectCommand({ options, outputDirectory });
    } catch (error) {
      console.error(`YTConv:\n${explainError(error)}`);
      return exitCodeForError(error);
    }
  }

  const headless = system.headless || system.stdin || Boolean(system.batchFile)
    || (!process.stdin.isTTY || !process.stdout.isTTY);
  if (headless) {
    let urls = [];
    try {
      urls = await collectUrls({ initialUrl: options.initialUrl, batchFile: system.batchFile, readStdin: system.stdin });
      const exitCode = await runHeadlessDownloads({
        options,
        outputDirectory,
        urls,
        continueOnError: system.continueOnError,
        openOutput: system.openOutput,
        jobs: system.jobs,
        resultJson: system.resultJson,
      });
      await appendHistory({
        version: CLI_VERSION,
        command: rawArgs[0] || 'download',
        urls,
        preset: options.preset,
        mode: options.initialMode,
        outputDirectory,
        profile: selectedProfile,
        exitCode,
      }).catch(() => {});
      return exitCode;
    } catch (error) {
      const exitCode = exitCodeForError(error);
      await appendHistory({
        version: CLI_VERSION,
        command: rawArgs[0] || 'download',
        urls,
        preset: options.preset,
        mode: options.initialMode,
        outputDirectory,
        profile: selectedProfile,
        exitCode,
      }).catch(() => {});
      console.error(`YTConv headless:\n${explainError(error)}`);
      return exitCode;
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
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    process.stdout.write('\n');
    console.error(`YTConv stopped:\n${explainError(error)}`);
    return exitCodeForError(error);
  }
}

process.exitCode = await main();
