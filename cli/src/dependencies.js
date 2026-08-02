import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import which from 'which';
import { ensureBundledYtDlp } from './binaries.js';
import { installGalleryDlPython, resolveGalleryDlRunner } from './gallery.js';
import { detectLinuxDistro } from './linux-distro.js';
import { isTermux } from './platform.js';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

async function fileExists(filePath) {
  if (!filePath) return false;
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function resolveCommand(names) {
  for (const name of names) {
    try { return await which(name); } catch { /* next */ }
  }
  return null;
}

async function readVersion(command, args = ['--version']) {
  if (!command) return null;
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      windowsHide: true, timeout: 20_000, env: process.env,
    });
    return `${stdout || stderr}`.trim().split(/\r?\n/u)[0] || null;
  } catch { return null; }
}

async function resolveBundledFfmpeg() {
  if (isTermux()) return null;
  try {
    const module = await import('ffmpeg-static');
    const candidate = module.default;
    if (!await fileExists(candidate)) return null;
    return await readVersion(candidate, ['-version']) ? candidate : null;
  } catch { return null; }
}

function ffmpegStaticDetails() {
  const packageJsonPath = require.resolve('ffmpeg-static/package.json');
  return {
    binaryPath: require('ffmpeg-static'),
    installerPath: path.join(path.dirname(packageJsonPath), 'install.js'),
    packageDirectory: path.dirname(packageJsonPath),
  };
}

export function ffmpegInstallerInvocation({
  execPath = process.execPath,
  packageJsonPath = require.resolve('ffmpeg-static/package.json'),
} = {}) {
  const pathApi = packageJsonPath.includes('\\') ? path.win32 : path;
  const packageDirectory = pathApi.dirname(packageJsonPath);
  return {
    command: execPath,
    args: [pathApi.join(packageDirectory, 'install.js')],
    cwd: packageDirectory,
  };
}

export async function repairBundledFfmpeg({ silent = false, runInstaller = spawnSync } = {}) {
  const current = await resolveBundledFfmpeg();
  if (current) return { installed: true, path: current, repaired: false, error: '' };

  let details;
  try {
    details = ffmpegStaticDetails();
  } catch (error) {
    return {
      installed: false,
      path: null,
      repaired: false,
      error: `The ffmpeg-static package is unavailable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (!details.binaryPath || !await fileExists(details.installerPath)) {
    return {
      installed: false,
      path: null,
      repaired: false,
      error: 'The ffmpeg-static installer is unavailable. Reinstall YTConv with npm install -g ytconv@latest --force.',
    };
  }

  try {
    // The installer exits early when a broken or truncated binary still exists.
    // Remove only that package-owned binary after it has failed the version check.
    await fs.rm(details.binaryPath, { force: true });
    if (!silent) console.log('YTConv: downloading and repairing the bundled FFmpeg engine...');
    const invocation = ffmpegInstallerInvocation({
      execPath: process.execPath,
      packageJsonPath: path.join(details.packageDirectory, 'package.json'),
    });
    const result = runInstaller(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      env: process.env,
      windowsHide: true,
      timeout: 180_000,
      stdio: silent ? 'pipe' : 'inherit',
    });
    if (result.error || result.status !== 0) {
      const detail = result.error?.message || `${result.stderr || ''}`.trim() || `exit code ${result.status ?? 'unknown'}`;
      throw new Error(detail);
    }
    const repaired = await resolveBundledFfmpeg();
    if (!repaired) throw new Error('the downloaded FFmpeg binary did not pass the version check');
    if (!silent) console.log('YTConv: FFmpeg is ready.');
    return { installed: true, path: repaired, repaired: true, error: '' };
  } catch (error) {
    return {
      installed: false,
      path: null,
      repaired: false,
      error: `FFmpeg automatic repair failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function runVisible(command, args, { optional = false } = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true, env: process.env });
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
  const args = python.toLowerCase().endsWith('py.exe')
    ? ['-3', '-m', 'pip', 'install', '--user', '--upgrade', '--no-cache-dir', 'yt-dlp', 'gallery-dl']
    : ['-m', 'pip', 'install', '--user', '--upgrade', '--no-cache-dir', 'yt-dlp', 'gallery-dl'];
  const result = spawnSync(python, args, {
    stdio: visible ? 'inherit' : 'ignore', windowsHide: true, env: process.env,
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
    if (version) return { command: bundledYtDlp, prefixArgs: [], displayPath: bundledYtDlp, version, mode: 'bundled' };
  }
  const executable = await resolveCommand(['yt-dlp', 'yt-dlp.exe']);
  const executableVersion = await readVersion(executable);
  if (executable && executableVersion) {
    return { command: executable, prefixArgs: [], displayPath: executable, version: executableVersion, mode: 'executable' };
  }
  return resolvePythonYtDlpRunner();
}

export async function prepareTermuxDependencies() {
  if (!isTermux()) return { prepared: false, termux: false };
  runVisible('pkg', ['install', '-y', 'python', 'ffmpeg']);
  const installedFromRepository = runVisible('pkg', ['install', '-y', 'python-yt-dlp'], { optional: true });
  const python = await resolvePython();
  if (!python) throw new Error('Python was not found after the Termux installation.');
  let ytDlpVersion = await readVersion(python, ['-m', 'yt_dlp', '--version']);
  if (!ytDlpVersion) {
    runVisible(python, ['-m', 'pip', 'install', '--upgrade', '--no-cache-dir', 'yt-dlp']);
    ytDlpVersion = await readVersion(python, ['-m', 'yt_dlp', '--version']);
  }
  if (!ytDlpVersion) throw new Error('The Python yt_dlp module still cannot run.');
  const galleryRunner = await installGalleryDlPython({ visible: true });
  if (!galleryRunner) throw new Error('The gallery_dl module could not be installed in Termux.');
  runVisible('pkg', ['install', '-y', 'yt-dlp-ejs'], { optional: true });
  return { prepared: true, termux: true, installedFromRepository, ytDlpVersion, galleryDlVersion: galleryRunner.version };
}

export async function prepareDesktopDependencies({ silent = false } = {}) {
  if (isTermux()) return { prepared: false, termux: true };
  const errors = [];
  let bundledYtDlp = null;
  try { bundledYtDlp = await ensureBundledYtDlp({ silent }); }
  catch (error) { errors.push(`yt-dlp bundled: ${error instanceof Error ? error.message : String(error)}`); }

  let ytDlpRunner = await resolveYtDlpRunner({ bundledYtDlp });
  let galleryRunner = await resolveGalleryDlRunner({ install: true, silent }).catch((error) => {
    errors.push(`gallery-dl: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });

  if ((!ytDlpRunner || !galleryRunner) && process.platform !== 'win32') {
    const pipResult = await installPythonEngines({ visible: !silent });
    if (!pipResult.installed) errors.push(`Python engines: ${pipResult.error}`);
    ytDlpRunner = ytDlpRunner || await resolveYtDlpRunner({ bundledYtDlp });
    galleryRunner = galleryRunner || await resolveGalleryDlRunner({ install: false });
  }

  let bundledFfmpeg = await resolveBundledFfmpeg();
  const systemFfmpeg = await resolveCommand(['ffmpeg', 'ffmpeg.exe']);
  const usableSystemFfmpeg = await readVersion(systemFfmpeg, ['-version']) ? systemFfmpeg : null;
  if (!bundledFfmpeg && !usableSystemFfmpeg) {
    const ffmpegRepair = await repairBundledFfmpeg({ silent });
    bundledFfmpeg = ffmpegRepair.path;
    if (!ffmpegRepair.installed) errors.push(ffmpegRepair.error);
  }
  const ffmpegPath = bundledFfmpeg || usableSystemFfmpeg;
  if (!ffmpegPath) {
    errors.push('FFmpeg is unavailable after automatic repair. Run ytconv doctor for the exact failure and platform-specific setup help.');
  }

  return {
    prepared: Boolean(ytDlpRunner && galleryRunner && ffmpegPath),
    termux: false,
    ytDlpPath: ytDlpRunner?.displayPath ?? null,
    galleryDlPath: galleryRunner?.displayPath ?? null,
    ffmpegPath,
    errors,
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
  let bundledYtDlp = null;
  let ytDlpInstallError = null;
  if (!termux) {
    try { bundledYtDlp = await ensureBundledYtDlp({ silent: true }); }
    catch (error) { ytDlpInstallError = error instanceof Error ? error.message : String(error); }
  }

  let ytDlpRunner = await resolveYtDlpRunner({ bundledYtDlp });
  let galleryDlRunner = await resolveGalleryDlRunner({ install: false });
  let bundledFfmpeg = await resolveBundledFfmpeg();
  let systemFfmpeg = await resolveCommand(['ffmpeg', 'ffmpeg.exe']);
  let ffmpegPath = termux ? systemFfmpeg : (bundledFfmpeg || systemFfmpeg);
  let ffmpegVersion = await readVersion(ffmpegPath, ['-version']);
  if (!ffmpegVersion) { ffmpegPath = null; bundledFfmpeg = null; }

  if (repair && (!ytDlpRunner || !galleryDlRunner || !ffmpegPath)) {
    if (termux) {
      await prepareTermuxDependencies().catch((error) => {
        repairErrors.push(error instanceof Error ? error.message : String(error));
      });
    } else {
      const repairResult = await prepareDesktopDependencies({ silent: true }).catch((error) => ({
        prepared: false,
        errors: [error instanceof Error ? error.message : String(error)],
      }));
      repairErrors.push(...(repairResult.errors || []));
    }
    ytDlpRunner = await resolveYtDlpRunner({ bundledYtDlp: bundledYtDlp || await ensureBundledYtDlp({ silent: true }).catch(() => null) });
    galleryDlRunner = await resolveGalleryDlRunner({ install: false });
    bundledFfmpeg = await resolveBundledFfmpeg();
    systemFfmpeg = await resolveCommand(['ffmpeg', 'ffmpeg.exe']);
    ffmpegPath = termux ? systemFfmpeg : (bundledFfmpeg || systemFfmpeg);
    ffmpegVersion = await readVersion(ffmpegPath, ['-version']);
    if (!ffmpegVersion) ffmpegPath = null;
  }

  const ffprobePath = await resolveCommand(['ffprobe', 'ffprobe.exe']);
  const ffprobeVersion = await readVersion(ffprobePath, ['-version']);
  const distro = await detectLinuxDistro({ available: await availableManagers() });
  const missing = [!ytDlpRunner ? 'yt-dlp' : '', !galleryDlRunner ? 'gallery-dl' : '', !ffmpegPath ? 'FFmpeg' : ''].filter(Boolean);
  const runnerValue = ytDlpRunner ? { command: ytDlpRunner.command, prefixArgs: ytDlpRunner.prefixArgs, path: ytDlpRunner.displayPath } : null;

  return {
    platform: {
      termux,
      distro,
      setupCommand: termux
        ? 'pkg install -y python ffmpeg && python -m pip install -U yt-dlp gallery-dl'
        : distro.installPlan,
    },
    ready: missing.length === 0,
    missing,
    errors: [...new Set([ytDlpInstallError, ...repairErrors].filter(Boolean))],
    ytDlp: {
      command: ytDlpRunner?.command ?? null,
      prefixArgs: ytDlpRunner?.prefixArgs ?? [],
      path: runnerValue,
      displayPath: ytDlpRunner?.displayPath ?? null,
      mode: ytDlpRunner?.mode ?? null,
      version: ytDlpRunner?.version ?? null,
      installed: Boolean(ytDlpRunner),
      bundled: ytDlpRunner?.mode === 'bundled',
      error: ytDlpInstallError,
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
