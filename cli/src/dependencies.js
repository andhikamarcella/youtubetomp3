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
      timeout: 15_000,
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

export async function prepareTermuxDependencies() {
  if (!isTermux()) return { prepared: false, termux: false };

  let installedFromRepository = false;
  try {
    runVisible('pkg', ['install', '-y', 'python-yt-dlp', 'ffmpeg']);
    installedFromRepository = true;
  } catch {
    console.log('\nPaket python-yt-dlp belum tersedia dari mirror. Mencoba fallback Python...');
    runVisible('pkg', ['install', '-y', 'python', 'ffmpeg']);
    runVisible('python', ['-m', 'pip', 'install', '--upgrade', 'yt-dlp']);
  }

  runVisible('pkg', ['install', '-y', 'yt-dlp-ejs'], { optional: true });

  return {
    prepared: true,
    termux: true,
    installedFromRepository,
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

  const systemYtDlp = await resolveCommand(['yt-dlp', 'yt-dlp.exe']);
  const ytDlpPath = termux ? systemYtDlp : (bundledYtDlp || systemYtDlp);

  const bundledFfmpeg = await resolveBundledFfmpeg();
  const systemFfmpeg = await resolveCommand(['ffmpeg', 'ffmpeg.exe']);
  const ffmpegPath = termux ? systemFfmpeg : (bundledFfmpeg || systemFfmpeg);

  return {
    platform: {
      termux,
      setupCommand: termux
        ? 'pkg install -y python-yt-dlp ffmpeg'
        : null,
    },
    ytDlp: {
      path: ytDlpPath,
      version: await readVersion(ytDlpPath),
      installed: Boolean(ytDlpPath),
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
