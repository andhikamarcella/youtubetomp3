import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { bundledYtDlpPath, ensureBundledYtDlp } from './binaries.js';
import { detectSystemBrowsers } from './cookies.js';
import { engineDirectory, engineFileStatus, enginePath } from './engine-storage.js';
import { installGalleryDlPython, resolveGalleryDlRunner } from './gallery.js';
import { detectLinuxDistro } from './linux-distro.js';
import { isTermux } from './platform.js';
import { monochromeChildEnvironment } from './terminal-style.js';
import { downloadVerifiedGitHubAsset } from './verified-download.js';
import { resolveCommandPath } from './command-path.js';

const execFileAsync = promisify(execFile);
const FFMPEG_REPOSITORY = 'yt-dlp/FFmpeg-Builds';
const FFMPEG_RELEASE = 'latest';
const MINIMUM_FFMPEG_BYTES = 10 * 1024 * 1024;
const MINIMUM_NODE = [22, 14, 0];
const MINIMUM_DENO = [2, 3, 0];

function numericVersion(value = '') {
  const match = String(value).match(/(?:^|\s)v?(\d+)\.(\d+)(?:\.(\d+))?/u);
  if (!match) return [0, 0, 0];
  return [match[1], match[2], match[3] || '0'].map((part) => Number.parseInt(part, 10) || 0);
}

function minimumVersionSatisfied(value, minimum) {
  const actual = numericVersion(value);
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] > minimum[index]) return true;
    if (actual[index] < minimum[index]) return false;
  }
  return true;
}

export function nodeRuntimeSupported(version = process.versions.node) {
  return minimumVersionSatisfied(version, MINIMUM_NODE);
}

export function denoRuntimeSupported(version = '') {
  return minimumVersionSatisfied(version, MINIMUM_DENO);
}

async function fileExists(filePath) {
  if (!filePath) return false;
  try { return (await fs.stat(filePath)).isFile(); } catch { return false; }
}

async function resolveCommand(names) {
  return resolveCommandPath(names);
}

async function readVersion(command, args = ['--version']) {
  if (!command) return null;
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      windowsHide: true,
      timeout: 20_000,
      env: monochromeChildEnvironment(process.env),
    });
    return `${stdout || stderr}`.trim().split(/\r?\n/u)[0] || null;
  } catch {
    return null;
  }
}

export function ffmpegReleaseAsset({ platform = process.platform, architecture = process.arch } = {}) {
  const assets = {
    'linux-arm64': 'ffmpeg-master-latest-linuxarm64-gpl.tar.xz',
    'linux-x64': 'ffmpeg-master-latest-linux64-gpl.tar.xz',
    'win32-arm64': 'ffmpeg-master-latest-winarm64-gpl.zip',
    'win32-ia32': 'ffmpeg-master-latest-win32-gpl.zip',
    'win32-x64': 'ffmpeg-master-latest-win64-gpl.zip',
  };
  return assets[`${platform}-${architecture}`] ?? null;
}

export function bundledFfmpegPath(options = {}) {
  return enginePath(process.platform === 'win32' ? 'ffmpeg-yt-dlp.exe' : 'ffmpeg-yt-dlp', options);
}

export function bundledFfprobePath(options = {}) {
  return enginePath(process.platform === 'win32' ? 'ffprobe-yt-dlp.exe' : 'ffprobe-yt-dlp', options);
}

function safeArchiveMember(value) {
  const normalized = String(value || '').replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || normalized.startsWith('-') || normalized.includes('\0')) return null;
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  return normalized;
}

export function ffmpegArchiveMembers(entries = [], { platform = process.platform } = {}) {
  const extension = platform === 'win32' ? '.exe' : '';
  const normalized = entries.map(safeArchiveMember).filter(Boolean);
  const ffmpeg = normalized.filter((entry) => entry.endsWith(`/bin/ffmpeg${extension}`));
  const ffprobe = normalized.filter((entry) => entry.endsWith(`/bin/ffprobe${extension}`));
  if (ffmpeg.length !== 1 || ffprobe.length !== 1) {
    throw new Error('the verified archive does not contain exactly one FFmpeg and one ffprobe executable');
  }
  return { ffmpeg: ffmpeg[0], ffprobe: ffprobe[0] };
}

async function resolveBundledFfprobe() {
  const candidate = bundledFfprobePath();
  const status = await engineFileStatus(candidate, { minimumBytes: MINIMUM_FFMPEG_BYTES });
  if (!status.valid) return null;
  return await readVersion(candidate, ['-version']) ? candidate : null;
}

async function replaceManagedExecutable(source, destination) {
  const temporary = `${destination}.${process.pid}.${Date.now()}.install`;
  try {
    await fs.copyFile(source, temporary);
    if (process.platform !== 'win32') await fs.chmod(temporary, 0o700);
    await fs.rm(destination, { force: true });
    await fs.rename(temporary, destination);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

export async function resolveBundledFfmpeg() {
  if (isTermux()) return null;
  const candidate = bundledFfmpegPath();
  const status = await engineFileStatus(candidate, { minimumBytes: MINIMUM_FFMPEG_BYTES });
  if (!status.valid) return null;
  return await readVersion(candidate, ['-version']) ? candidate : null;
}

export async function repairBundledFfmpeg({
  silent = false,
  force = false,
  fetchImpl = globalThis.fetch,
} = {}) {
  const current = await resolveBundledFfmpeg();
  if (current && !force) return { installed: true, path: current, repaired: false, error: '' };

  const assetName = ffmpegReleaseAsset();
  if (!assetName) {
    return {
      installed: false,
      path: null,
      repaired: false,
      error: `No verified bundled FFmpeg executable is available for ${process.platform}/${process.arch}; install FFmpeg with the operating-system package manager.`,
    };
  }

  const ffmpegDestination = bundledFfmpegPath();
  const ffprobeDestination = bundledFfprobePath();
  const archiveExtension = assetName.endsWith('.tar.xz') ? '.tar.xz' : '.zip';
  const archiveDestination = enginePath(`ffmpeg-bundle-${process.pid}-${Date.now()}${archiveExtension}`);
  let stagingDirectory = '';
  try {
    await downloadVerifiedGitHubAsset({
      repository: FFMPEG_REPOSITORY,
      release: FFMPEG_RELEASE,
      assetName,
      destination: archiveDestination,
      minimumBytes: 50 * 1024 * 1024,
      maximumOutputBytes: 220 * 1024 * 1024,
      executable: false,
      fetchImpl,
      silent,
    });
    const tar = await resolveCommand(['tar', 'tar.exe']);
    if (!tar) throw new Error('the system archive extractor `tar` is required for verified FFmpeg repair');
    const listed = await execFileAsync(tar, ['-tf', archiveDestination], {
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
      env: monochromeChildEnvironment(process.env),
    });
    const members = ffmpegArchiveMembers(String(listed.stdout || '').split(/\r?\n/u));
    await fs.mkdir(engineDirectory(), { recursive: true, mode: 0o700 });
    stagingDirectory = await fs.mkdtemp(path.join(engineDirectory(), 'ffmpeg-install-'));
    const extractionSafety = process.platform === 'win32' ? [] : ['--no-same-owner', '--no-same-permissions'];
    await execFileAsync(tar, [
      '-xf', archiveDestination,
      ...extractionSafety,
      '-C', stagingDirectory,
      '--', members.ffmpeg, members.ffprobe,
    ], {
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
      env: monochromeChildEnvironment(process.env),
    });
    const extractedFfmpeg = path.join(stagingDirectory, ...members.ffmpeg.split('/'));
    const extractedFfprobe = path.join(stagingDirectory, ...members.ffprobe.split('/'));
    if (process.platform !== 'win32') {
      await fs.chmod(extractedFfmpeg, 0o700);
      await fs.chmod(extractedFfprobe, 0o700);
    }
    if (!await readVersion(extractedFfmpeg, ['-version'])) throw new Error('the extracted FFmpeg executable failed its version check');
    if (!await readVersion(extractedFfprobe, ['-version'])) throw new Error('the extracted ffprobe executable failed its version check');
    await replaceManagedExecutable(extractedFfmpeg, ffmpegDestination);
    await replaceManagedExecutable(extractedFfprobe, ffprobeDestination);
    const repaired = await resolveBundledFfmpeg();
    const repairedFfprobe = await resolveBundledFfprobe();
    if (!repaired || !repairedFfprobe) throw new Error('the installed FFmpeg bundle failed its final version check');
    if (!silent) console.log('YTConv: FFmpeg is ready.');
    return { installed: true, path: repaired, repaired: true, error: '' };
  } catch (error) {
    return {
      installed: false,
      path: null,
      repaired: false,
      error: `FFmpeg automatic repair failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    await fs.rm(archiveDestination, { force: true }).catch(() => {});
    if (stagingDirectory) await fs.rm(stagingDirectory, { recursive: true, force: true }).catch(() => {});
  }
}

function runVisible(command, args, { optional = false } = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    windowsHide: true,
    env: monochromeChildEnvironment(process.env),
  });
  if (result.error || result.status !== 0) {
    if (optional) return false;
    const detail = result.error?.message || `exit code ${result.status ?? 'unknown'}`;
    throw new Error(`${command} failed: ${detail}`);
  }
  return true;
}

async function resolvePython() {
  return resolveCommand(process.platform === 'win32' ? ['python.exe', 'python3.exe', 'py.exe'] : ['python3', 'python']);
}

async function installPythonEngines({ visible = true } = {}) {
  const python = await resolvePython();
  if (!python) return { installed: false, error: 'Python 3 was not found.' };
  const moduleArgs = ['-m', 'pip', 'install', '--user', '--upgrade', '--no-cache-dir', 'yt-dlp[default]', 'gallery-dl'];
  const args = python.toLowerCase().endsWith('py.exe') ? ['-3', ...moduleArgs] : moduleArgs;
  const result = spawnSync(python, args, {
    stdio: visible ? 'inherit' : 'ignore',
    windowsHide: true,
    env: monochromeChildEnvironment(process.env),
  });
  return {
    installed: !result.error && result.status === 0,
    error: result.error?.message || (result.status ? `pip exit ${result.status}` : ''),
  };
}

async function resolvePythonYtDlpRunner() {
  const python = await resolvePython();
  if (!python) return null;
  const prefixArgs = python.toLowerCase().endsWith('py.exe') ? ['-3', '-m', 'yt_dlp'] : ['-m', 'yt_dlp'];
  const version = await readVersion(python, [...prefixArgs, '--version']);
  if (!version) return null;
  return { command: python, prefixArgs, displayPath: `${python} ${prefixArgs.join(' ')}`, version, mode: 'python-module' };
}

async function resolveYtDlpRunner({ bundledYtDlp = null } = {}) {
  if (bundledYtDlp) {
    const version = await readVersion(bundledYtDlp);
    if (version) return { command: bundledYtDlp, prefixArgs: [], displayPath: bundledYtDlp, version, mode: 'verified-bundled' };
  }
  const executable = await resolveCommand(['yt-dlp', 'yt-dlp.exe']);
  const executableVersion = await readVersion(executable);
  if (executable && executableVersion) {
    return { command: executable, prefixArgs: [], displayPath: executable, version: executableVersion, mode: 'executable' };
  }
  return resolvePythonYtDlpRunner();
}

async function existingBundledYtDlp() {
  if (isTermux()) return null;
  const candidate = bundledYtDlpPath();
  const status = await engineFileStatus(candidate, { minimumBytes: 1024 * 1024 });
  return status.valid && await readVersion(candidate) ? candidate : null;
}

async function inspectJavaScriptRuntimes() {
  const runtimes = [];
  const deno = await resolveCommand(['deno', 'deno.exe']);
  const denoVersion = await readVersion(deno);
  if (deno && denoVersion) {
    runtimes.push({
      name: 'deno', path: deno, version: denoVersion,
      supported: denoRuntimeSupported(denoVersion), recommended: true, minimum: '2.3.0',
    });
  }
  if (nodeRuntimeSupported()) {
    runtimes.push({ name: 'node', path: process.execPath, version: process.version, supported: true, recommended: true, minimum: '22.0.0' });
  }
  const quickJs = await resolveCommand(['qjs', 'quickjs']);
  const quickJsVersion = await readVersion(quickJs);
  if (quickJs && quickJsVersion) runtimes.push({ name: 'quickjs', path: quickJs, version: quickJsVersion, supported: true, recommended: false });
  const bun = await resolveCommand(['bun', 'bun.exe']);
  const bunVersion = await readVersion(bun);
  if (bun && bunVersion) runtimes.push({ name: 'bun', path: bun, version: bunVersion, supported: true, recommended: false });
  return runtimes.sort((left, right) => Number(right.supported) - Number(left.supported));
}

export async function prepareTermuxDependencies() {
  if (!isTermux()) return { prepared: false, termux: false };
  runVisible('pkg', ['install', '-y', 'python', 'ffmpeg', 'nodejs']);
  const installedFromRepository = runVisible('pkg', ['install', '-y', 'python-yt-dlp'], { optional: true });
  runVisible('pkg', ['install', '-y', 'gallery-dl'], { optional: true });
  const python = await resolvePython();
  if (!python) throw new Error('Python was not found after the Termux installation.');
  let ytDlpVersion = await readVersion(python, ['-m', 'yt_dlp', '--version']);
  if (!ytDlpVersion) {
    runVisible(python, ['-m', 'pip', 'install', '--upgrade', '--no-cache-dir', 'yt-dlp[default]', 'gallery-dl']);
    ytDlpVersion = await readVersion(python, ['-m', 'yt_dlp', '--version']);
  }
  if (!ytDlpVersion) throw new Error('The Python yt_dlp module still cannot run.');
  const galleryRunner = await resolveGalleryDlRunner({ install: true, silent: false });
  if (!galleryRunner) throw new Error('The gallery_dl module could not be installed in Termux.');
  return { prepared: true, termux: true, installedFromRepository, ytDlpVersion, galleryDlVersion: galleryRunner.version };
}

export async function prepareDesktopDependencies({ silent = false } = {}) {
  if (isTermux()) return { prepared: false, termux: true };
  const errors = [];
  let bundledYtDlp = null;
  try { bundledYtDlp = await ensureBundledYtDlp({ silent }); }
  catch (error) { errors.push(`yt-dlp: ${error instanceof Error ? error.message : String(error)}`); }

  let ytDlpRunner = await resolveYtDlpRunner({ bundledYtDlp });
  let galleryRunner = await resolveGalleryDlRunner({ install: true, silent }).catch((error) => {
    errors.push(`gallery-dl: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });

  if (!ytDlpRunner || !galleryRunner) {
    const pipResult = await installPythonEngines({ visible: !silent });
    if (!pipResult.installed) errors.push(`Python engines: ${pipResult.error}`);
    ytDlpRunner = ytDlpRunner || await resolveYtDlpRunner({ bundledYtDlp });
    galleryRunner = galleryRunner || await resolveGalleryDlRunner({ install: false });
  }

  const systemFfmpeg = await resolveCommand(['ffmpeg', 'ffmpeg.exe']);
  const usableSystemFfmpeg = await readVersion(systemFfmpeg, ['-version']) ? systemFfmpeg : null;
  let bundledFfmpeg = usableSystemFfmpeg ? null : await resolveBundledFfmpeg();
  if (!usableSystemFfmpeg && !bundledFfmpeg) {
    const ffmpegRepair = await repairBundledFfmpeg({ silent });
    bundledFfmpeg = ffmpegRepair.path;
    if (!ffmpegRepair.installed) errors.push(ffmpegRepair.error);
  }
  const ffmpegPath = usableSystemFfmpeg || bundledFfmpeg;
  if (!ffmpegPath) errors.push('FFmpeg is unavailable after automatic repair. Run `ytconv doctor` for platform-specific setup help.');

  return {
    prepared: Boolean(ytDlpRunner && galleryRunner && ffmpegPath),
    termux: false,
    ytDlpPath: ytDlpRunner?.displayPath ?? null,
    galleryDlPath: galleryRunner?.displayPath ?? null,
    ffmpegPath,
    errors: [...new Set(errors)],
  };
}

async function availableManagers() {
  const names = ['apt-get', 'dnf', 'pacman', 'zypper', 'apk', 'xbps-install', 'emerge', 'nix', 'brew'];
  const found = [];
  for (const name of names) if (await resolveCommand([name])) found.push(name);
  return found;
}

export async function inspectDependencies({ repair = true } = {}) {
  const termux = isTermux();
  const repairErrors = [];

  if (repair) {
    const repaired = termux
      ? await prepareTermuxDependencies().catch((error) => ({ prepared: false, errors: [error.message] }))
      : await prepareDesktopDependencies({ silent: true }).catch((error) => ({ prepared: false, errors: [error.message] }));
    repairErrors.push(...(repaired.errors || []));
  }

  const bundledYtDlp = await existingBundledYtDlp();
  const ytDlpRunner = await resolveYtDlpRunner({ bundledYtDlp });
  const galleryDlRunner = await resolveGalleryDlRunner({ install: false });
  const systemFfmpeg = await resolveCommand(['ffmpeg', 'ffmpeg.exe']);
  const usableSystemFfmpeg = await readVersion(systemFfmpeg, ['-version']) ? systemFfmpeg : null;
  const bundledFfmpeg = termux || usableSystemFfmpeg ? null : await resolveBundledFfmpeg();
  const ffmpegPath = usableSystemFfmpeg || bundledFfmpeg;
  const ffmpegVersion = await readVersion(ffmpegPath, ['-version']);
  const systemFfprobe = await resolveCommand(['ffprobe', 'ffprobe.exe']);
  const usableSystemFfprobe = await readVersion(systemFfprobe, ['-version']) ? systemFfprobe : null;
  const bundledFfprobe = bundledFfmpeg && !usableSystemFfprobe ? await resolveBundledFfprobe() : null;
  const ffprobePath = usableSystemFfprobe || bundledFfprobe;
  const ffprobeVersion = await readVersion(ffprobePath, ['-version']);
  const pythonPath = await resolvePython();
  const pythonVersion = await readVersion(pythonPath, ['--version']);
  const npmPath = await resolveCommand(process.platform === 'win32' ? ['npm.cmd', 'npm.exe', 'npm'] : ['npm']);
  const npmVersion = await readVersion(npmPath);
  const javaScriptRuntimes = await inspectJavaScriptRuntimes();
  const browsers = termux ? [] : await detectSystemBrowsers().catch(() => []);
  const distro = await detectLinuxDistro({ available: await availableManagers() });
  const supportedNode = nodeRuntimeSupported();
  const missing = [
    !supportedNode ? 'Node.js 22.14.0 or newer' : '',
    !ytDlpRunner ? 'yt-dlp' : '',
    !galleryDlRunner ? 'gallery-dl' : '',
    !ffmpegPath ? 'FFmpeg' : '',
  ].filter(Boolean);
  const recommendedMissing = [
    !javaScriptRuntimes.some((runtime) => runtime.supported) ? 'JavaScript runtime (Deno 2.3+ or Node.js 22+)' : '',
    !ffprobeVersion ? 'ffprobe' : '',
    !termux && !browsers.length ? 'supported desktop browser for account-required media' : '',
  ].filter(Boolean);
  const setupCommand = termux
    ? 'pkg install -y python ffmpeg nodejs && python -m pip install -U "yt-dlp[default]" gallery-dl'
    : distro.installPlan;

  return {
    platform: { termux, distro, setupCommand },
    ready: missing.length === 0,
    missing,
    recommendedMissing,
    errors: [...new Set(repairErrors.filter(Boolean))],
    engineDirectory: engineDirectory(),
    node: { path: process.execPath, version: process.version, installed: true, supported: supportedNode, minimum: '22.14.0' },
    npm: { path: npmPath, version: npmVersion, installed: Boolean(npmPath && npmVersion) },
    python: { path: pythonPath, version: pythonVersion, installed: Boolean(pythonPath && pythonVersion) },
    javaScriptRuntimes,
    browsers,
    ytDlp: {
      command: ytDlpRunner?.command ?? null,
      prefixArgs: ytDlpRunner?.prefixArgs ?? [],
      path: ytDlpRunner ? { command: ytDlpRunner.command, prefixArgs: ytDlpRunner.prefixArgs, path: ytDlpRunner.displayPath } : null,
      displayPath: ytDlpRunner?.displayPath ?? null,
      mode: ytDlpRunner?.mode ?? null,
      version: ytDlpRunner?.version ?? null,
      installed: Boolean(ytDlpRunner),
      bundled: ytDlpRunner?.mode === 'verified-bundled',
    },
    galleryDl: {
      command: galleryDlRunner?.command ?? null,
      prefixArgs: galleryDlRunner?.prefixArgs ?? [],
      path: galleryDlRunner ?? null,
      displayPath: galleryDlRunner?.displayPath ?? null,
      mode: galleryDlRunner?.mode ?? null,
      version: galleryDlRunner?.version ?? null,
      installed: Boolean(galleryDlRunner),
    },
    ffmpeg: { path: ffmpegPath, version: ffmpegVersion, installed: Boolean(ffmpegPath && ffmpegVersion), bundled: Boolean(bundledFfmpeg) },
    ffprobe: { path: ffprobePath, version: ffprobeVersion, installed: Boolean(ffprobePath && ffprobeVersion) },
  };
}
