import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import {
  inspectGallery,
  isGalleryPreferredUrl,
  resolveGalleryDlRunner,
} from './gallery.js';

export { inspectGallery, isGalleryPreferredUrl };

const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;

function cookieArgs(config) {
  if (!config || config.kind === 'none') return [];
  if (config.kind === 'file') return ['--cookies', config.path];
  if (config.kind === 'browser') return ['--cookies-from-browser', config.spec];
  return [];
}

function normalizeRunner(value) {
  const command = value?.command || value?.path;
  if (!command) throw new Error('gallery-dl belum tersedia.');
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
  const text = String(stderr || '');
  if (/429|too many requests/iu.test(text)) return 'Situs membatasi permintaan (429). Tunggu lalu coba lagi.';
  if (/login|cookies?|authentication|private|not authorized/iu.test(text)) {
    return 'Media memerlukan login/cookies. Gunakan cookies browser atau cookies.txt yang masih aktif.';
  }
  const useful = text.split(/\r?\n/u).map((line) => line.trim()).filter((line) => /error|warning|failed|unsupported|login|cookie|private|429/iu.test(line));
  return useful.at(-1)?.replace(/^\[[^\]]+\]\s*/u, '') || fallback;
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
  if (!runnerValue) throw new Error('Engine gambar gallery-dl tidak dapat disiapkan pada perangkat ini.');
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
      env: process.env,
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
      finish(() => reject(new Error('Unduhan dibatalkan.')));
    };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });

    const processLine = (line, isError = false) => {
      const clean = line.trim();
      if (!clean) return;
      if (clean.startsWith('ytconv-file:')) {
        outputPath = clean.slice('ytconv-file:'.length).trim();
        downloadedCount += 1;
        onProgress?.({ percent: `${Math.min(95, 5 + downloadedCount * 7)}%`, speed: `${downloadedCount} file`, eta: '' });
        onLog?.(`Tersimpan: ${outputPath}`, false);
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
    child.on('error', (error) => finish(() => reject(new Error(`Gagal menjalankan gallery-dl (${runner.displayPath}): ${error.message}`))));
    child.on('close', async (code) => {
      if (settled) return;
      processLine(stdoutBuffer, false);
      processLine(stderrBuffer, true);
      if (code !== 0) {
        finish(() => reject(new Error(readableError(stderrAll, `gallery-dl selesai dengan kode ${code}.`))));
        return;
      }
      const after = await listFiles(outputDirectory);
      const created = [...after].filter((filePath) => !before.has(filePath));
      if (!outputPath && created.length) outputPath = created.at(-1);
      const count = Math.max(downloadedCount, created.length);
      onProgress?.({ percent: '100%', speed: `${count} file baru`, eta: '' });
      if (!count && archive) onLog?.('Media sudah tercatat di archive gallery-dl; download dilewati.', false);
      finish(() => resolve({ outputPath: outputPath || outputDirectory, fileCount: count, engine: 'gallery-dl' }));
    });
  });
}
