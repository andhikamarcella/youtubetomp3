import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import {
  inspectGallery,
  isGalleryPreferredUrl as baseIsGalleryPreferredUrl,
  resolveGalleryDlRunner,
} from './gallery.js';
import { monochromeChildEnvironment, sanitizeTerminalText } from './terminal-style.js';

export { inspectGallery };

const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;

export function isGalleryPreferredUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./u, '');
    // Public X/Twitter posts are usually handled more reliably by yt-dlp.
    // gallery-dl remains available as the automatic fallback and for forced gallery mode.
    if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')) {
      return false;
    }
  } catch {
    // Let the shared detector decide how to handle invalid values.
  }
  return baseIsGalleryPreferredUrl(url);
}

function cookieArgs(config) {
  if (!config || config.kind === 'none') return [];
  if (config.kind === 'file') return ['--cookies', config.path];
  if (config.kind === 'browser') return ['--cookies-from-browser', config.spec];
  return [];
}

function normalizeRunner(value) {
  const command = value?.command || value?.path;
  if (!command) throw new Error('gallery-dl is not available yet.');
  return {
    command,
    prefixArgs: Array.isArray(value.prefixArgs) ? value.prefixArgs : [],
    displayPath: value.displayPath || value.path || command,
  };
}

async function listFiles(directory) {
  const files = new Set();
  async function walk(current) {
    let entries;
    try { entries = await fs.readdir(current, { withFileTypes: true }); }
    catch { return; }
    await Promise.all(entries.map(async (entry) => {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.isFile()) files.add(target);
    }));
  }
  await walk(directory);
  return files;
}

function readableError(stderr, fallback) {
  const text = sanitizeTerminalText(stderr || '');
  if (/429|too many requests/iu.test(text)) return 'The site is rate limiting requests (429). Wait, then try again.';
  if (/login|cookies?|authentication|private|not authorized/iu.test(text)) {
    return 'This media requires a signed-in account. Run `ytconv login PROVIDER`, then try again.';
  }
  const useful = text.split(/\r?\n/u).map((line) => line.trim()).filter((line) => /error|warning|failed|unsupported|login|cookie|private|429/iu.test(line));
  return useful.at(-1)?.replace(/^\[[^\]]+\]\s*/u, '') || fallback;
}

export function classifyEmptyGalleryResult({ archivePath = '', inspectedItemCount = 0, diagnostic = '' } = {}) {
  if (String(archivePath || '').trim() && Number(inspectedItemCount) > 0) {
    return {
      skipped: true,
      reason: `${inspectedItemCount} item(s) were found, but all are already recorded in the gallery-dl archive.`,
    };
  }
  return {
    skipped: false,
    reason: readableError(
      diagnostic,
      'gallery-dl returned no file for this URL. Public access will be attempted with yt-dlp; if an account is required, run `ytconv login PROVIDER`.',
    ),
  };
}

export function buildGalleryDownloadArgs({ url, cookieConfig, outputDirectory, archivePath = process.env.YTCONV_GALLERY_ARCHIVE?.trim() } = {}) {
  const include = process.env.YTCONV_GALLERY_INCLUDE?.trim();
  const args = [
    '--config-ignore', '--no-colors', '--no-input', '--retries', '10',
    '--http-timeout', '30', '--windows-filenames', '--destination', outputDirectory,
    '--option', 'extractor.instagram.static-videos=false',
    '--option', 'extractor.instagram.videos=true',
    '--option', 'extractor.pinterest.stories=true',
    '--option', 'extractor.pinterest.videos=true',
    '--option', 'extractor.tiktok.covers=false',
    ...cookieArgs(cookieConfig),
  ];
  if (include) args.push('--option', `extractor.instagram.include=${include}`);
  if (archivePath) args.push('--download-archive', archivePath);
  args.push('--print', 'file:ytconv-file:{_path}', url);
  return args;
}

export async function downloadGallery({
  url,
  cookieConfig,
  outputDirectory,
  onProgress,
  onLog,
  signal,
} = {}) {
  const runnerValue = await resolveGalleryDlRunner({ install: true, silent: false });
  if (!runnerValue) throw new Error('The gallery-dl image engine could not be prepared on this device.');
  const runner = normalizeRunner(runnerValue);

  await fs.mkdir(outputDirectory, { recursive: true });
  const archive = process.env.YTCONV_GALLERY_ARCHIVE?.trim();
  if (archive) await fs.mkdir(path.dirname(archive), { recursive: true });
  const before = await listFiles(outputDirectory);
  const args = buildGalleryDownloadArgs({ url, cookieConfig, outputDirectory, archivePath: archive });

  return new Promise((resolve, reject) => {
    const child = spawn(runner.command, [...runner.prefixArgs, ...args], {
      cwd: outputDirectory,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: monochromeChildEnvironment(process.env),
    });
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let stderrAll = '';
    let downloadedCount = 0;
    let outputPath = '';
    let settled = false;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      callback();
    };
    const abort = () => {
      child.kill('SIGTERM');
      finish(() => reject(new Error('The download was cancelled.')));
    };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });

    const processLine = (line, isError = false) => {
      const clean = sanitizeTerminalText(line, { allowNewlines: false, maximumLength: 4096 }).trim();
      if (!clean) return;
      if (clean.startsWith('ytconv-file:')) {
        outputPath = clean.slice('ytconv-file:'.length).trim();
        downloadedCount += 1;
        onProgress?.({ percent: `${Math.min(95, 5 + downloadedCount * 7)}%`, speed: `${downloadedCount} file`, eta: '' });
        onLog?.(`Saved: ${outputPath}`, false);
        return;
      }
      onLog?.(clean, isError);
    };

    const consume = (chunk, isError) => {
      const text = chunk.toString();
      if (isError) stderrAll = `${stderrAll}${text}`.slice(-MAX_OUTPUT_BYTES);
      const previous = isError ? stderrBuffer : stdoutBuffer;
      const lines = `${previous}${text}`.split(/\r?\n/u);
      const rest = lines.pop() ?? '';
      if (isError) stderrBuffer = rest; else stdoutBuffer = rest;
      for (const line of lines) processLine(line, isError);
    };

    child.stdout.on('data', (chunk) => consume(chunk, false));
    child.stderr.on('data', (chunk) => consume(chunk, true));
    child.on('error', (error) => finish(() => reject(new Error(`Could not start gallery-dl (${runner.displayPath}): ${error.message}`))));
    child.on('close', async (code) => {
      if (settled) return;
      processLine(stdoutBuffer, false);
      processLine(stderrBuffer, true);
      if (code !== 0) {
        finish(() => reject(new Error(readableError(stderrAll, `gallery-dl exited with code ${code}.`))));
        return;
      }
      const after = await listFiles(outputDirectory);
      const created = [...after].filter((filePath) => !before.has(filePath));
      if (!outputPath && created.length) outputPath = created.at(-1);
      const count = Math.max(downloadedCount, created.length);

      if (!count) {
        let inspectedItemCount = 0;
        let inspectionDiagnostic = '';
        if (archive) {
          try {
            const inspection = await inspectGallery({ url, cookieConfig, outputDirectory, signal });
            inspectedItemCount = Math.max(0, Number(inspection?.itemCount) || 0);
          } catch (error) {
            inspectionDiagnostic = error instanceof Error ? error.message : String(error);
          }
        }
        const outcome = classifyEmptyGalleryResult({
          archivePath: archive,
          inspectedItemCount,
          diagnostic: [stderrAll, inspectionDiagnostic].filter(Boolean).join('\n'),
        });
        if (!outcome.skipped) {
          finish(() => reject(new Error(outcome.reason)));
          return;
        }
        onProgress?.({ percent: '100%', speed: '0 new files', eta: '' });
        onLog?.(outcome.reason, false);
        finish(() => resolve({
          outputPath: outputDirectory,
          fileCount: 0,
          inspectedItemCount,
          skipped: true,
          engine: 'gallery-dl',
        }));
        return;
      }

      onProgress?.({ percent: '100%', speed: `${count} new files`, eta: '' });
      finish(() => resolve({ outputPath: outputPath || outputDirectory, fileCount: count, skipped: false, engine: 'gallery-dl' }));
    });
  });
}
