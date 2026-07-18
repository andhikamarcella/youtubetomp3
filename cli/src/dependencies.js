import fs from 'node:fs/promises';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import which from 'which';
import { ensureBundledYtDlp } from './binaries.js';
import { installGalleryDlPython, resolveGalleryDlRunner } from './gallery.js';
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

  let ytDlpVersion = await readVersion(python, ['-m', 'yt_dlp', '--version']);
  if (!ytDlpVersion) {
    console.log('\nMemasang yt-dlp melalui modul Python Termux...');
    runVisible(python, [
      '-m',
      'pip',
      'install',
      '--upgrade',
      '--no-cache-dir',
      'yt-dlp',
    ]);
    ytDlpVersion = await readVersion(python, ['-m', 'yt_dlp', '--version']);
  }

  if (!ytDlpVersion) {
    throw new Error('Modul Python yt_dlp tetap tidak dapat dijalankan.');
  }

  console.log('\nMemasang engine gambar, posting, dan sosial media...');
  const galleryRunner = await installGalleryDlPython({ visible: true });
  if (!galleryRunner) {
    throw new Error('Modul gallery_dl tidak dapat dipasang di Termux.');
  }

  runVisible('pkg', ['install', '-y', 'yt-dlp-ejs'], { optional: true });

  return {
    prepared: true,
    termux: true,
    installedFromRepository,
    ytDlpVersion,
    galleryDlVersion: galleryRunner.version,
  };
}

export async function prepareDesktopDependencies({ silent = false } = {}) {
  if (isTermux()) return { prepared: false, termux: true };

  const errors = [];
  let ytDlpPath = null;
  let galleryRunner = null;
  let ffmpegPath = null;

  try {
    ytDlpPath = await ensureBundledYtDlp({ silent });
  } catch (error) {
    errors.push(`yt-dlp: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    galleryRunner = await resolveGalleryDlRunner({ install: true, silent });
    if (!galleryRunner) errors.push('gallery-dl: installer tidak menghasilkan executable yang dapat dijalankan.');
  } catch (error) {
    errors.push(`gallery-dl: ${error instanceof Error ? error.message : String(error)}`);
  }

  ffmpegPath = await resolveBundledFfmpeg() || await resolveCommand(['ffmpeg', 'ffmpeg.exe']);
  if (!ffmpegPath) {
    errors.push('FFmpeg: paket ffmpeg-static tidak ditemukan dan FFmpeg tidak tersedia di PATH.');
  }

  return {
    prepared: Boolean(ytDlpPath && galleryRunner && ffmpegPath),
    termux: false,
    ytDlpPath,
    galleryDlPath: galleryRunner?.displayPath ?? null,
    ffmpegPath,
    errors,
  };
}

export async function inspectDependencies({ repair = true } = {}) {
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

  let galleryDlRunner = await resolveGalleryDlRunner({ install: false });
  let bundledFfmpeg = await resolveBundledFfmpeg();
  let systemFfmpeg = await resolveCommand(['ffmpeg', 'ffmpeg.exe']);

  if (!termux && repair && (!ytDlpRunner || !galleryDlRunner || !(bundledFfmpeg || systemFfmpeg))) {
    await prepareDesktopDependencies({ silent: true });
    galleryDlRunner = await resolveGalleryDlRunner({ install: false });
    bundledFfmpeg = await resolveBundledFfmpeg();
    systemFfmpeg = await resolveCommand(['ffmpeg', 'ffmpeg.exe']);
  }

  const finalYtDlpRunner = termux
    ? await resolveTermuxYtDlpRunner()
    : await resolveDesktopYtDlpRunner({
      bundledYtDlp: bundledYtDlp || await ensureBundledYtDlp({ silent: true }).catch(() => null),
    });
  const ffmpegPath = termux ? systemFfmpeg : (bundledFfmpeg || systemFfmpeg);
  const runnerValue = finalYtDlpRunner
    ? {
      command: finalYtDlpRunner.command,
      prefixArgs: finalYtDlpRunner.prefixArgs,
      path: finalYtDlpRunner.displayPath,
    }
    : null;

  const missing = [
    !finalYtDlpRunner ? 'yt-dlp' : '',
    !galleryDlRunner ? 'gallery-dl' : '',
    !ffmpegPath ? 'FFmpeg' : '',
  ].filter(Boolean);

  return {
    platform: {
      termux,
      setupCommand: termux
        ? 'pkg install -y python ffmpeg && python -m pip install -U yt-dlp gallery-dl'
        : 'npm uninstall -g ytconv && npm cache clean --force && npm install -g ytconv@latest --force',
    },
    ready: missing.length === 0,
    missing,
    ytDlp: {
      command: finalYtDlpRunner?.command ?? null,
      prefixArgs: finalYtDlpRunner?.prefixArgs ?? [],
      path: runnerValue,
      displayPath: finalYtDlpRunner?.displayPath ?? null,
      mode: finalYtDlpRunner?.mode ?? null,
      version: finalYtDlpRunner?.version ?? null,
      installed: Boolean(finalYtDlpRunner),
      bundled: Boolean(bundledYtDlp),
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
    ffmpeg: {
      path: ffmpegPath,
      version: await readVersion(ffmpegPath, ['-version']),
      installed: Boolean(ffmpegPath),
      bundled: Boolean(bundledFfmpeg),
    },
  };
}
