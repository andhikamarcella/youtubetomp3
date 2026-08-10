import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { resolveCookieConfigs } from './cookies.js';
import { inspectDependencies } from './dependencies.js';
import { disposePreparedCookieConfig, prepareManagedCookieConfig } from './managed-browser.js';
import { runYtDlpUtility } from './downloader.js';
import { inspectMedia } from './media-controller.js';
import { recoverSocialLoginInTerminal } from './social-auth.js';
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
  } catch { return false; }
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1; }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`;
}

function outputPlan(options, media) {
  if (options.subtitleOnly) {
    return { type: 'subtitle-only', format: 'srt', source: 'manual or automatic subtitles when available' };
  }
  if (options.initialMode === 'audio') {
    const converted = ['mp3', 'flac', 'alac', 'wav', 'aac'].includes(options.audioFormat);
    return {
      type: 'audio',
      targetFormat: options.audioFormat,
      targetBitrateKbps: options.audioQuality === 'best' ? null : Number(options.audioQuality),
      processing: converted ? 'converted' : 'remux-or-convert',
      warning: options.audioQuality === '320'
        ? '320 kbps is an output target and cannot add detail missing from the source.'
        : 'Output quality is limited by the source quality.',
      bestSourceAudioKbps: Math.max(0, ...(media.formats || []).map((item) => Number(item.audioBitrateKbps) || 0)) || null,
    };
  }
  return {
    type: options.initialMode === 'image' ? 'image/gallery' : 'video',
    targetContainer: options.videoFormat,
    maximumResolution: options.resolution,
    processing: 'download original streams, then merge or remux when required',
  };
}

function printFormats(formats = [], limit = 12) {
  if (!formats.length) return;
  const audio = formats.filter((item) => item.type === 'audio')
    .sort((a, b) => (b.audioBitrateKbps || b.totalBitrateKbps || 0) - (a.audioBitrateKbps || a.totalBitrateKbps || 0))
    .slice(0, Math.ceil(limit / 2));
  const video = formats.filter((item) => item.type !== 'audio')
    .sort((a, b) => (b.height || 0) - (a.height || 0) || (b.totalBitrateKbps || 0) - (a.totalBitrateKbps || 0))
    .slice(0, Math.floor(limit / 2));

  console.log('\nTop source formats (original):');
  for (const item of [...audio, ...video]) {
    const detail = [item.id, item.ext, item.type, item.resolution, item.fps ? `${item.fps}fps` : '',
      item.videoCodec, item.audioCodec, item.audioBitrateKbps ? `${Math.round(item.audioBitrateKbps)}kbps` : '',
      formatBytes(item.sizeBytes)].filter(Boolean).join(' · ');
    console.log(`- ${detail}`);
  }
}

function printSummary(media, options) {
  console.log(`YTConv ${CLI_VERSION} info`);
  console.log(`Preset     ${options.preset}`);
  console.log(`Platform   ${media.platform || '-'}`);
  console.log(`Title      ${media.title || '-'}`);
  console.log(`Uploader   ${media.uploader || '-'}`);
  console.log(`Duration   ${media.duration ?? '-'}`);
  console.log(`Items      ${media.itemCount ?? 1}`);
  console.log(`Views      ${media.viewCount ?? '-'}`);
  console.log(`Engine     ${media.engine || '-'}`);
  console.log(`URL        ${media.originalUrl || options.initialUrl}`);
  printFormats(media.formats);
  const plan = outputPlan(options, media);
  console.log('\nOutput plan:');
  for (const [key, value] of Object.entries(plan)) if (value !== null && value !== '') console.log(`${key.padEnd(20)} ${value}`);
}

function jsonSummary(media, options) {
  return {
    schemaVersion: 2,
    ytconvVersion: CLI_VERSION,
    preset: options.preset,
    request: {
      url: options.initialUrl,
      mode: options.initialMode,
      platform: options.initialPlatform,
      playlist: options.initialPlaylist,
    },
    outputPlan: outputPlan(options, media),
    media,
  };
}

function explicitBrowserConfig(spec) {
  return { kind: 'browser', spec, browser: spec.split(/[+:]/u)[0], label: `browser:${spec}` };
}

export async function runDirectCommand({ options, outputDirectory }) {
  if (!validateUrl(options.initialUrl)) throw new Error('A direct command requires a valid HTTP or HTTPS URL.');
  const dependencies = await inspectDependencies({ repair: true });
  if (!dependencies.ytDlp.installed) throw new Error('yt-dlp is still unavailable after automatic repair. Run `ytconv repair`, followed by `ytconv doctor`.');

  await fs.mkdir(outputDirectory, { recursive: true });
  const cookieConfigs = options.cookiesBrowser
    ? [explicitBrowserConfig(options.cookiesBrowser)]
    : await resolveCookieConfigs({
      source: options.cookiesPath ? 'file' : 'auto',
      outputDirectory,
      url: options.initialUrl,
    });
  let lastError = null;

  const attempt = async (configuredCookie) => {
    let cookieConfig = configuredCookie;
    try {
      cookieConfig = await prepareManagedCookieConfig(configuredCookie);
      await appendLog(`direct command: ${options.initialUrl} (${configuredCookie.label})`);
      if (options.listFormats || options.listSubs) {
        await runYtDlpUtility({
          ytDlpPath: dependencies.ytDlp.path,
          url: options.initialUrl,
          cookieConfig,
          playlist: options.initialPlaylist,
          kind: options.listFormats ? 'formats' : 'subs',
          options: {
            ...options,
            javascriptRuntime: dependencies.javaScriptRuntimes?.find((runtime) => runtime.supported),
          },
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
        options: {
          ...options,
          javascriptRuntime: dependencies.javaScriptRuntimes?.find((runtime) => runtime.supported),
        },
      });
      if (options.formatsJson) {
        console.log(JSON.stringify({ schemaVersion: 1, ytconvVersion: CLI_VERSION, url: options.initialUrl, formats: media.formats || [] }, null, 2));
      } else if (options.json) console.log(JSON.stringify(jsonSummary(media, options), null, 2));
      else printSummary(media, options);
      await appendLog(`direct command success: ${media.title || options.initialUrl}`);
      return 0;
    } finally {
      await disposePreparedCookieConfig(cookieConfig);
    }
  };

  for (const cookieConfig of cookieConfigs) {
    try {
      return await attempt(cookieConfig);
    } catch (error) {
      lastError = error;
      await appendLog(`direct command failed (${cookieConfig.label}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const error = lastError || new Error('No media engine or account session could read this URL.');
  error.ytconvUrl = options.initialUrl;
  if (!options.cookiesBrowser && !options.cookiesPath) {
    const recovered = await recoverSocialLoginInTerminal({
      url: options.initialUrl,
      error,
      retry: attempt,
    });
    if (recovered) return recovered.result;
  }
  throw error;
}
