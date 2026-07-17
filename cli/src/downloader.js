import { spawn } from 'node:child_process';
import path from 'node:path';

function formatVideoSelector(resolution) {
  if (resolution === 'best') {
    return 'bv*+ba/b';
  }

  return `bv*[height<=${resolution}]+ba/b[height<=${resolution}]`;
}

export function buildDownloadArgs(options) {
  const outputTemplate = path.join(options.outputDirectory, '%(title).180B [%(id)s].%(ext)s');
  const args = [
    '--newline',
    '--no-playlist',
    '--windows-filenames',
    '--no-overwrites',
    '--progress-template',
    'download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    '--output',
    outputTemplate,
  ];

  if (options.cookiesFromBrowser && options.cookiesFromBrowser !== 'none') {
    args.push('--cookies-from-browser', options.cookiesFromBrowser);
  }

  if (options.mode === 'audio') {
    args.push('-f', 'ba/b', '-x', '--audio-format', options.audioFormat);

    if (options.audioFormat === 'mp3') {
      args.push('--audio-quality', options.audioQuality);
    }

    args.push('--embed-thumbnail', '--add-metadata');
  } else {
    args.push(
      '-f',
      formatVideoSelector(options.resolution),
      '--merge-output-format',
      'mp4',
      '--embed-thumbnail',
      '--add-metadata',
    );
  }

  args.push(options.url);
  return args;
}

export function downloadMedia({ ytDlpPath, options, onProgress, onLog }) {
  return new Promise((resolve, reject) => {
    const args = buildDownloadArgs(options);
    const child = spawn(ytDlpPath, args, {
      cwd: options.outputDirectory,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let bufferedStdout = '';
    let bufferedStderr = '';

    const processLine = (line, isError = false) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      if (cleanLine.startsWith('download:')) {
        const [percent = '', speed = '', eta = ''] = cleanLine.slice('download:'.length).split('|');
        onProgress?.({
          percent: percent.trim(),
          speed: speed.trim(),
          eta: eta.trim(),
        });
        return;
      }

      onLog?.(cleanLine, isError);
    };

    const consume = (chunk, isError) => {
      const previous = isError ? bufferedStderr : bufferedStdout;
      const combined = previous + chunk.toString();
      const lines = combined.split(/\r?\n/u);
      const remaining = lines.pop() ?? '';

      if (isError) bufferedStderr = remaining;
      else bufferedStdout = remaining;

      for (const line of lines) processLine(line, isError);
    };

    child.stdout.on('data', (chunk) => consume(chunk, false));
    child.stderr.on('data', (chunk) => consume(chunk, true));

    child.on('error', (error) => {
      reject(new Error(`Gagal menjalankan yt-dlp: ${error.message}`));
    });

    child.on('close', (code) => {
      processLine(bufferedStdout, false);
      processLine(bufferedStderr, true);

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`yt-dlp selesai dengan kode ${code ?? 'tidak diketahui'}.`));
    });
  });
}
