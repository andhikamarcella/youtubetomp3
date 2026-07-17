import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
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

  const termuxSetupCommand = 'pkg install -y python-yt-dlp yt-dlp-ejs ffmpeg';

  return {
    platform: {
      termux,
      setupCommand: termux ? termuxSetupCommand : null,
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
