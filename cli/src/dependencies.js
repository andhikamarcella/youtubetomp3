import fs from 'node:fs/promises';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import which from 'which';
import { ensureBundledYtDlp } from './binaries.js';
import { isTermux } from './platform.js';

const execFileAsync = promisify(execFile);

async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveCommand(names) {
  for (const name of names) {
    try {
      return await which(name);
    } catch {
      // Coba nama executable berikutnya.
    }
  }
  return null;
}

async function resolveBundledFfmpeg() {
  if (isTermux()) return null;

  try {
    const module = await import('ffmpeg-static');
    const candidate = module.default;
    return await fileExists(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

async function readVersion(command, args = ['--version']) {
  if (!command) return null;

  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      windowsHide: true,
      timeout: 20_000,
      env: process.env,
    });
    return `${stdout || stderr}`.trim().split(/\r?\n/u)[0] || null;
  } catch {
    return null;
  }
}

function runVisible(command, args, { optional = false } = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });

  if (result.error || result.status !== 0) {
    if (optional) return false;
    const detail = result.error?.message || `exit code ${result.status ?? 'unknown'}`;
    throw new Error(`${command} gagal: ${detail}`);
  }

  return true;
}

async function resolveTermuxYtDlpRunner() {
  const python = await resolveCommand(['python', 'python3']);
  if (python) {
    const version = await readVersion(python, ['-m', 'yt_dlp', '--version']);
    if (version) {
      return {
        command: python,
        prefixArgs: ['-m', 'yt_dlp'],
        displayPath: `${python} -m yt_dlp`,
        version,
        mode: 'python-module',
      };
    }
  }

  const executable = await resolveCommand(['yt-dlp']);
  const version = await readVersion(executable);
  if (!executable || !version) return null;

  return {
    command: executable,
    prefixArgs: [],
    displayPath: executable,
    version,
    mode: 'executable',
  };
}

async function resolveDesktopYtDlpRunner({ bundledYtDlp = null } = {}) {
  const executable = bundledYtDlp || await resolveCommand(['yt-dlp', 'yt-dlp.exe']);
  const version = await readVersion(executable);
  if (!executable || !version) return null;

  return {
    command: executable,
    prefixArgs: [],
    displayPath: executable,
    version,
    mode: bundledYtDlp ? 'bundled' : 'executable',
  };
}

export async function prepareTermuxDependencies() {
  if (!isTermux()) return { prepared: false, termux: false };

  runVisible('pkg', ['install', '-y', 'python', 'ffmpeg']);
  const installedFromRepository = runVisible(
    'pkg',
    ['install', '-y', 'python-yt-dlp'],
    { optional: true },
  );

  const python = await resolveCommand(['python', 'python3']);
  if (!python) throw new Error('Python tidak ditemukan setelah instalasi Termux.');

  let version = await readVersion(python, ['-m', 'yt_dlp', '--version']);
  if (!version) {
    console.log('\nMemasang yt-dlp melalui modul Python Termux...');
    runVisible(python, [
      '-m',
      'pip',
      'install',
      '--upgrade',
      '--no-cache-dir',
      'yt-dlp',
    ]);
    version = await readVersion(python, ['-m', 'yt_dlp', '--version']);
  }

  if (!version) {
    throw new Error('Modul Python yt_dlp tetap tidak dapat dijalankan.');
  }

  runVisible('pkg', ['install', '-y', 'yt-dlp-ejs'], { optional: true });

  return {
    prepared: true,
    termux: true,
    installedFromRepository,
    version,
  };
}

export async function inspectDependencies() {
  const termux = isTermux();
  let bundledYtDlp = null;
  let ytDlpInstallError = null;

  if (!termux) {
    try {
      bundledYtDlp = await ensureBundledYtDlp({ silent: true });
    } catch (error) {
      ytDlpInstallError = error instanceof Error ? error.message : String(error);
    }
  }

  const ytDlpRunner = termux
    ? await resolveTermuxYtDlpRunner()
    : await resolveDesktopYtDlpRunner({ bundledYtDlp });

  const bundledFfmpeg = await resolveBundledFfmpeg();
  const systemFfmpeg = await resolveCommand(['ffmpeg', 'ffmpeg.exe']);
  const ffmpegPath = termux ? systemFfmpeg : (bundledFfmpeg || systemFfmpeg);

  return {
    platform: {
      termux,
      setupCommand: termux
        ? 'pkg install -y python ffmpeg && python -m pip install -U yt-dlp'
        : null,
    },
    ytDlp: {
      command: ytDlpRunner?.command ?? null,
      prefixArgs: ytDlpRunner?.prefixArgs ?? [],
      path: ytDlpRunner?.displayPath ?? null,
      mode: ytDlpRunner?.mode ?? null,
      version: ytDlpRunner?.version ?? null,
      installed: Boolean(ytDlpRunner),
      bundled: Boolean(bundledYtDlp),
      error: ytDlpInstallError,
    },
    ffmpeg: {
      path: ffmpegPath,
      version: await readVersion(ffmpegPath, ['-version']),
      installed: Boolean(ffmpegPath),
      bundled: Boolean(bundledFfmpeg),
    },
  };
}
