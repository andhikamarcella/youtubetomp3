import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import which from 'which';

const execFileAsync = promisify(execFile);

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
      timeout: 10_000,
    });
    return `${stdout || stderr}`.trim().split(/\r?\n/u)[0] || null;
  } catch {
    return null;
  }
}

export async function inspectDependencies() {
  const ytDlpPath = await resolveCommand(['yt-dlp', 'yt-dlp.exe']);
  const ffmpegPath = await resolveCommand(['ffmpeg', 'ffmpeg.exe']);

  return {
    ytDlp: {
      path: ytDlpPath,
      version: await readVersion(ytDlpPath),
      installed: Boolean(ytDlpPath),
    },
    ffmpeg: {
      path: ffmpegPath,
      version: await readVersion(ffmpegPath, ['-version']),
      installed: Boolean(ffmpegPath),
    },
  };
}
