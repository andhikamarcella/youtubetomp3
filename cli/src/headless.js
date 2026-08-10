import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { resolveCookieConfigs } from './cookies.js';
import { inspectDependencies } from './dependencies.js';
import { explainError } from './error-help.js';
import { exitCodeForError } from './exit-codes.js';
import { downloadMedia, inspectMedia } from './media-controller.js';
import { openOutputLocation } from './system-actions.js';
import { CLI_VERSION } from './version.js';

function validUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch { return false; }
}

async function stdinText() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function parseLines(value) {
  return String(value || '').split(/\r?\n/u).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

export async function collectUrls({ initialUrl = '', batchFile = '', readStdin = false } = {}) {
  const values = [];
  if (initialUrl) values.push(initialUrl);
  if (batchFile) values.push(...parseLines(await fs.readFile(path.resolve(batchFile), 'utf8')));
  if (readStdin || (!process.stdin.isTTY && !initialUrl && !batchFile)) values.push(...parseLines(await stdinText()));
  const unique = [...new Set(values)];
  const invalid = unique.filter((value) => !validUrl(value));
  if (invalid.length) throw new Error(`Invalid URL: ${invalid.slice(0, 3).join(', ')}`);
  return unique;
}

function progressPrinter(index, total) {
  let previous = '';
  return ({ percent = '', speed = '', eta = '', total: totalSize = '' } = {}) => {
    const message = `[${index}/${total}] ${percent || '...'} ${totalSize || ''} ${speed || ''} ${eta ? `ETA ${eta}` : ''}`.trim();
    if (message === previous) return;
    previous = message;
    console.log(message);
  };
}

function explicitBrowserConfig(spec) {
  return { kind: 'browser', spec, browser: spec.split(/[+:]/u)[0], label: `browser:${spec}` };
}

async function partialFiles(directory, since) {
  const results = [];
  async function walk(current) {
    let entries = [];
    try { entries = await fs.readdir(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (/\.(?:part|ytdl|temp|tmp)$/iu.test(entry.name)) {
        try {
          const stats = await fs.stat(target);
          if (stats.mtimeMs >= since - 1000) results.push(target);
        } catch { /* file disappeared */ }
      }
    }
  }
  await walk(directory);
  return results;
}

async function cleanupPartials(directory, since) {
  const files = await partialFiles(directory, since);
  await Promise.all(files.map((target) => fs.rm(target, { force: true }).catch(() => {})));
  return files.length;
}

async function downloadOne({ options, url, outputDirectory, dependencies, index, total, allowCleanup }) {
  const cookieConfigs = options.cookiesBrowser
    ? [explicitBrowserConfig(options.cookiesBrowser)]
    : await resolveCookieConfigs({
      source: options.cookiesPath ? 'file' : 'auto',
      outputDirectory,
      url,
    });
  let lastError;
  const startedAt = Date.now();

  for (const cookieConfig of cookieConfigs) {
    try {
      console.log(`\n[${index}/${total}] Inspecting ${url}`);
      const media = await inspectMedia({
        ytDlpPath: dependencies.ytDlp.path,
        url,
        cookieConfig,
        playlist: options.initialPlaylist,
        mode: options.initialMode,
        platformHint: options.initialPlatform,
        options,
      });
      console.log(`Title   : ${media.title}`);
      console.log(`Platform: ${media.platform || '-'} · engine ${media.engine || 'auto'}`);
      console.log(`Access  : ${cookieConfig.label}`);

      const result = await downloadMedia({
        ytDlpPath: dependencies.ytDlp.path,
        options: {
          ...options,
          url,
          mode: options.initialMode,
          platformHint: options.initialPlatform,
          imageFormat: options.initialImageFormat,
          cookieConfig,
          playlist: options.initialPlaylist,
          outputDirectory,
          ffmpegPath: dependencies.ffmpeg.path,
          ffprobePath: dependencies.ffprobe?.path,
          javascriptRuntime: dependencies.javaScriptRuntimes?.find((runtime) => runtime.supported),
          upscaleHeight: options.upscaleHeight,
        },
        onProgress: progressPrinter(index, total),
        onLog: (line, isError) => {
          if (isError || /saved|fallback|engine|merger|extractaudio|videoremuxer/iu.test(line)) {
            console.log(`[${index}/${total}] ${isError ? '!' : '>'} ${line}`);
          }
        },
      });
      console.log(`Completed: ${result.outputPath || outputDirectory}`);
      return { ok: true, url, title: media.title, ...result };
    } catch (error) {
      lastError = error;
    }
  }

  if (options.cleanupPart && allowCleanup) {
    const count = await cleanupPartials(outputDirectory, startedAt);
    if (count) console.log(`[${index}/${total}] Removed ${count} temporary file(s).`);
  }
  const error = lastError || new Error('All available access methods failed.');
  error.ytconvUrl = url;
  throw error;
}

async function writeResultJson(target, payload) {
  if (!target) return;
  const resolved = path.resolve(target);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`JSON report: ${resolved}`);
}

export async function runHeadlessDownloads({
  options,
  outputDirectory,
  urls,
  continueOnError = false,
  openOutput = false,
  jobs = 1,
  resultJson = '',
} = {}) {
  if (!urls?.length) throw new Error('No URL was provided. Pass a URL, --batch-file FILE, or --stdin.');
  await fs.mkdir(outputDirectory, { recursive: true });
  const dependencies = await inspectDependencies({ repair: true });
  if (!dependencies.ready) {
    throw new Error(`Automatic repair could not prepare: ${dependencies.missing.join(', ')}. Run ytconv repair, followed by ytconv doctor.`);
  }

  const workerCount = Math.max(1, Math.min(Number(jobs) || 1, 8, urls.length));
  if (options.cleanupPart && workerCount > 1) {
    console.log("Note: --cleanup-part is disabled when --jobs is greater than 1 so one worker cannot delete another worker's files.");
  }
  const results = new Array(urls.length);
  let cursor = 0;
  let stop = false;

  async function worker() {
    while (!stop) {
      const index = cursor;
      cursor += 1;
      if (index >= urls.length) return;
      const url = urls[index];
      try {
        results[index] = await downloadOne({
          options, url, outputDirectory, dependencies, index: index + 1, total: urls.length,
          allowCleanup: workerCount === 1,
        });
      } catch (error) {
        const code = exitCodeForError(error);
        console.error(`\nFailed [${index + 1}/${urls.length}] ${url}`);
        console.error(explainError(error, { url }));
        results[index] = { ok: false, url, exitCode: code, error: error instanceof Error ? error.message : String(error) };
        if (!continueOnError) stop = true;
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  const completed = results.filter(Boolean);
  const success = completed.filter((item) => item.ok).length;
  const failed = completed.length - success;
  const report = {
    schemaVersion: 1,
    ytconvVersion: CLI_VERSION,
    startedUrls: completed.length,
    requestedUrls: urls.length,
    jobs: workerCount,
    success,
    failed,
    outputDirectory,
    results: completed,
  };
  console.log(`\nSummary: ${success} succeeded, ${failed} failed. Output: ${outputDirectory}`);
  await writeResultJson(resultJson, report);
  if (openOutput && success) await openOutputLocation({ directory: outputDirectory });
  if (!failed) return 0;
  return Math.max(...completed.filter((item) => !item.ok).map((item) => item.exitCode || 1));
}
