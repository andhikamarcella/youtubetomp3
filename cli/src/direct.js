import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { resolveCookieConfigs } from './cookies.js';
import { inspectDependencies } from './dependencies.js';
import { runYtDlpUtility } from './downloader.js';
import { inspectMedia } from './media-controller.js';
import { CLI_VERSION } from './version.js';

async function appendLog(line) {
  const target = process.env.YTCONV_LOG_FILE;
  if (!target) return;
  const timestamp = new Date().toISOString();
  await fs.mkdir(path.dirname(target), { recursive: true }).catch(() => {});
  await fs.appendFile(target, `[${timestamp}] ${line}\n`, 'utf8').catch(() => {});
}

function validateUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function printSummary(media, options) {
  console.log(`YTConv ${CLI_VERSION} dry run`);
  console.log(`Preset     ${options.preset}`);
  console.log(`Platform   ${media.platform || '-'}`);
  console.log(`Title      ${media.title || '-'}`);
  console.log(`Uploader   ${media.uploader || '-'}`);
  console.log(`Duration   ${media.duration ?? '-'}`);
  console.log(`Items      ${media.itemCount ?? 1}`);
  console.log(`Engine     ${media.engine || '-'}`);
  console.log(`URL        ${media.originalUrl || options.initialUrl}`);
}

function jsonSummary(media, options) {
  return {
    schemaVersion: 1,
    ytconvVersion: CLI_VERSION,
    preset: options.preset,
    request: {
      url: options.initialUrl,
      mode: options.initialMode,
      platform: options.initialPlatform,
      playlist: options.initialPlaylist,
    },
    media,
  };
}

export async function runDirectCommand({ options, outputDirectory }) {
  if (!validateUrl(options.initialUrl)) {
    throw new Error('Mode langsung membutuhkan LINK http/https yang valid.');
  }

  const dependencies = await inspectDependencies();
  if (!dependencies.ytDlp.installed) {
    throw new Error('yt-dlp belum tersedia. Jalankan ytconv --diagnose untuk memperbaiki dependency.');
  }

  await fs.mkdir(outputDirectory, { recursive: true });
  const source = options.cookiesPath ? 'file' : 'auto';
  const cookieConfigs = await resolveCookieConfigs({ source, outputDirectory });
  let lastError = null;

  for (const cookieConfig of cookieConfigs) {
    try {
      await appendLog(`direct command: ${options.initialUrl} (${cookieConfig.label})`);
      if (options.listFormats || options.listSubs) {
        await runYtDlpUtility({
          ytDlpPath: dependencies.ytDlp.path,
          url: options.initialUrl,
          cookieConfig,
          playlist: options.initialPlaylist,
          kind: options.listFormats ? 'formats' : 'subs',
        });
        return 0;
      }

      const media = await inspectMedia({
        ytDlpPath: dependencies.ytDlp.path,
        url: options.initialUrl,
        cookieConfig,
        playlist: options.initialPlaylist,
        mode: options.initialMode,
        platformHint: options.initialPlatform,
      });
      if (options.json) console.log(JSON.stringify(jsonSummary(media, options), null, 2));
      else printSummary(media, options);
      await appendLog(`dry run success: ${media.title || options.initialUrl}`);
      return 0;
    } catch (error) {
      lastError = error;
      await appendLog(`direct command failed (${cookieConfig.label}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw lastError || new Error('Tidak ada sumber cookies/engine yang berhasil memeriksa link.');
}
