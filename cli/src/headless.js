import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { resolveCookieConfigs } from './cookies.js';
import { inspectDependencies } from './dependencies.js';
import { explainError } from './error-help.js';
import { downloadMedia, inspectMedia } from './media-controller.js';
import { openOutputLocation } from './system-actions.js';

function validUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

async function stdinText() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function parseLines(value) {
  return String(value || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

export async function collectUrls({ initialUrl = '', batchFile = '', readStdin = false } = {}) {
  const values = [];
  if (initialUrl) values.push(initialUrl);
  if (batchFile) {
    const content = await fs.readFile(path.resolve(batchFile), 'utf8');
    values.push(...parseLines(content));
  }
  if (readStdin || (!process.stdin.isTTY && !initialUrl && !batchFile)) {
    values.push(...parseLines(await stdinText()));
  }
  const unique = [...new Set(values)];
  const invalid = unique.filter((value) => !validUrl(value));
  if (invalid.length) throw new Error(`Link tidak valid: ${invalid.slice(0, 3).join(', ')}`);
  return unique;
}

function progressPrinter(index, total) {
  let previous = '';
  return ({ percent = '', speed = '', eta = '' } = {}) => {
    const message = `[${index}/${total}] ${percent || '...'} ${speed || ''} ${eta ? `ETA ${eta}` : ''}`.trim();
    if (message === previous) return;
    previous = message;
    console.log(message);
  };
}

async function downloadOne({ options, url, outputDirectory, dependencies, index, total }) {
  const cookieSource = options.cookiesPath ? 'file' : 'auto';
  const cookieConfigs = await resolveCookieConfigs({ source: cookieSource, outputDirectory });
  let lastError;

  for (const cookieConfig of cookieConfigs) {
    try {
      console.log(`\n[${index}/${total}] Memeriksa ${url}`);
      const media = await inspectMedia({
        ytDlpPath: dependencies.ytDlp.path,
        url,
        cookieConfig,
        playlist: options.initialPlaylist,
        mode: options.initialMode,
        platformHint: options.initialPlatform,
      });
      console.log(`Judul   : ${media.title}`);
      console.log(`Platform: ${media.platform || '-'} · engine ${media.engine || 'auto'}`);
      console.log(`Akses   : ${cookieConfig.label}`);

      const result = await downloadMedia({
        ytDlpPath: dependencies.ytDlp.path,
        options: {
          url,
          mode: options.initialMode,
          platformHint: options.initialPlatform,
          resolution: options.resolution,
          videoFormat: options.videoFormat,
          audioFormat: options.audioFormat,
          audioQuality: options.audioQuality,
          imageFormat: options.initialImageFormat,
          subtitles: options.subtitles,
          subtitleLanguages: options.subtitleLanguages,
          writeThumbnail: options.writeThumbnail,
          cookieConfig,
          playlist: options.initialPlaylist,
          outputDirectory,
          ffmpegPath: dependencies.ffmpeg.path,
        },
        onProgress: progressPrinter(index, total),
        onLog: (line, isError) => {
          if (isError || /tersimpan|fallback|engine|merger|extractaudio|videoremuxer/iu.test(line)) {
            console.log(`${isError ? '!' : '>'} ${line}`);
          }
        },
      });
      console.log(`Selesai  : ${result.outputPath || outputDirectory}`);
      return { ok: true, url, ...result };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Semua metode akses gagal.');
}

export async function runHeadlessDownloads({
  options,
  outputDirectory,
  urls,
  continueOnError = false,
  openOutput = false,
} = {}) {
  if (!urls?.length) {
    throw new Error('Tidak ada link. Berikan LINK, --batch-file FILE, atau --stdin.');
  }

  await fs.mkdir(outputDirectory, { recursive: true });
  const dependencies = await inspectDependencies();
  if (!dependencies.ready) {
    throw new Error(`Dependency belum lengkap: ${dependencies.missing.join(', ')}. Jalankan ytconv --repair.`);
  }

  const results = [];
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    try {
      results.push(await downloadOne({
        options, url, outputDirectory, dependencies, index: index + 1, total: urls.length,
      }));
    } catch (error) {
      console.error(`\nGagal [${index + 1}/${urls.length}] ${url}`);
      console.error(explainError(error));
      results.push({ ok: false, url, error: error instanceof Error ? error.message : String(error) });
      if (!continueOnError) break;
    }
  }

  const success = results.filter((item) => item.ok).length;
  const failed = results.length - success;
  console.log(`\nRingkasan: ${success} berhasil, ${failed} gagal. Output: ${outputDirectory}`);
  if (openOutput && success) await openOutputLocation({ directory: outputDirectory });
  return failed ? 1 : 0;
}
