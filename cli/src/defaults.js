import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const NEGATIVE_FLAGS = new Map([
  ['--no-subtitles', 'subtitles'],
  ['--subtitles-off', 'subtitles'],
  ['--no-sponsorblock', 'sponsorBlock'],
  ['--sponsorblock-off', 'sponsorBlock'],
  ['--no-archive', 'archive'],
]);

const RETRY_SLEEP_PREFIXES = /^(?:(?:http|fragment|file_access|extractor):)+/iu;

function includesAny(argv, names) {
  return argv.some((value) => names.includes(value));
}

function safeProfilePart(value, fallback = 'default') {
  const normalized = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return normalized || fallback;
}

export function outputProfileName(options = {}) {
  const mode = options.mode || options.initialMode;
  if (mode === 'audio') {
    return `audio-${safeProfilePart(options.audioFormat, 'mp3')}-${safeProfilePart(options.audioQuality, 'best')}`;
  }
  if (mode === 'video') {
    return `video-${safeProfilePart(options.videoFormat, 'auto')}-${safeProfilePart(options.resolution, 'best')}`;
  }
  if (mode === 'image') return `image-${safeProfilePart(options.imageFormat || options.initialImageFormat, 'original')}`;
  return `auto-${safeProfilePart(options.preset, 'balanced')}`;
}

export function managedArchivePaths(options = {}, {
  homeDirectory = os.homedir(),
} = {}) {
  const archiveDirectory = path.join(homeDirectory, '.ytconv', 'archives');
  const profile = outputProfileName(options);
  return {
    archiveDirectory,
    archivePath: path.join(archiveDirectory, `yt-dlp-${profile}.txt`),
    galleryArchivePath: path.join(archiveDirectory, `gallery-dl-${profile}.sqlite3`),
  };
}

export function normalizeRetrySleep(value, fallback = 'linear=1::2') {
  const normalized = String(value || fallback).trim().replace(RETRY_SLEEP_PREFIXES, '');
  return normalized || fallback;
}

export function extractDefaultToggles(argv = []) {
  const cleanArgs = [];
  const disabled = { subtitles: false, sponsorBlock: false, archive: false };

  for (const argument of argv) {
    const target = NEGATIVE_FLAGS.get(argument);
    if (target) disabled[target] = true;
    else cleanArgs.push(argument);
  }

  return {
    cleanArgs,
    disabled,
    explicit: {
      subtitles: includesAny(argv, ['--subtitles', '--subtitle-only', '--subtitle-langs']),
      sponsorBlock: includesAny(argv, ['--sponsorblock', '--sponsorblock-mode', '--remove-sponsors']),
      archive: includesAny(argv, ['--archive']),
    },
  };
}

export function applyStableDefaults(options = {}, toggles = {}, {
  homeDirectory = os.homedir(),
  mkdirSync = fs.mkdirSync,
} = {}) {
  const disabled = toggles.disabled || {};
  const explicit = toggles.explicit || {};

  options.retrySleep = normalizeRetrySleep(options.retrySleep);

  if (disabled.subtitles) options.subtitles = false;
  else if (!explicit.subtitles) options.subtitles = false;

  if (disabled.sponsorBlock) options.sponsorBlockMode = 'off';
  else if (!explicit.sponsorBlock) options.sponsorBlockMode = 'mark';

  if (disabled.archive) {
    options.archivePath = '';
    options.galleryArchivePath = '';
    options.archiveManaged = false;
    return options;
  }

  const managed = managedArchivePaths(options, { homeDirectory });
  const { archiveDirectory } = managed;
  mkdirSync(archiveDirectory, { recursive: true });

  if (!options.archivePath) options.archivePath = managed.archivePath;
  options.galleryArchivePath = explicit.archive
    ? `${options.archivePath}.gallery.sqlite3`
    : managed.galleryArchivePath;
  options.archiveManaged = !explicit.archive;
  return options;
}

export function stableDefaultsHelpText() {
  return [
    'YTConv stable defaults:',
    '  subtitles       OFF by default; enable with --subtitles',
    '  SponsorBlock    ON in mark mode; disable with --no-sponsorblock',
    '  download archive ON per output profile; disable with --no-archive',
    '  SponsorBlock mark adds chapters and does not cut the media.',
    '',
  ].join('\n');
}
