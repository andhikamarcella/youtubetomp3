import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegStaticPath from 'ffmpeg-static';
import which from 'which';
import { ensureBundledYtDlp } from './binaries.js';

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
  let bundledYtDlp = null;
  let ytDlpInstallError = null;

  try {
    bundledYtDlp = await ensureBundledYtDlp({ silent: true });
  } catch (error) {
    ytDlpInstallError = error instanceof Error ? error.message : String(error);
  }

  const ytDlpPath = bundledYtDlp || await resolveCommand(['yt-dlp', 'yt-dlp.exe']);
  const bundledFfmpeg = await fileExists(ffmpegStaticPath) ? ffmpegStaticPath : null;
  const ffmpegPath = bundledFfmpeg || await resolveCommand(['ffmpeg', 'ffmpeg.exe']);

  return {
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
