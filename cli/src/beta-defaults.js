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

function profileName(options = {}) {
  if (options.initialMode === 'audio') {
    return `audio-${safeProfilePart(options.audioFormat, 'mp3')}-${safeProfilePart(options.audioQuality, 'best')}`;
  }
  if (options.initialMode === 'video') {
    return `video-${safeProfilePart(options.videoFormat, 'auto')}-${safeProfilePart(options.resolution, 'best')}`;
  }
  if (options.initialMode === 'image') return `image-${safeProfilePart(options.initialImageFormat, 'original')}`;
  return `auto-${safeProfilePart(options.preset, 'balanced')}`;
}

export function extractBetaToggles(argv = []) {
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

export function applyBetaDefaults(options = {}, toggles = {}, {
  homeDirectory = os.homedir(),
  mkdirSync = fs.mkdirSync,
} = {}) {
  const disabled = toggles.disabled || {};
  const explicit = toggles.explicit || {};

  if (disabled.subtitles) options.subtitles = false;
  else if (!explicit.subtitles) options.subtitles = true;

  if (disabled.sponsorBlock) options.sponsorBlockMode = 'off';
  else if (!explicit.sponsorBlock) options.sponsorBlockMode = 'mark';

  if (disabled.archive) {
    options.archivePath = '';
    options.galleryArchivePath = '';
    return options;
  }

  const archiveDirectory = path.join(homeDirectory, '.ytconv', 'archives');
  mkdirSync(archiveDirectory, { recursive: true });
  const profile = profileName(options);

  if (!options.archivePath) options.archivePath = path.join(archiveDirectory, `yt-dlp-${profile}.txt`);
  options.galleryArchivePath = explicit.archive
    ? `${options.archivePath}.gallery.sqlite3`
    : path.join(archiveDirectory, `gallery-dl-${profile}.sqlite3`);
  return options;
}

export function betaDefaultsHelpText() {
  return [
    'YTConv 1.5 beta defaults:',
    '  subtitles       ON for video; disable with --no-subtitles',
    '  SponsorBlock    ON in mark mode; disable with --no-sponsorblock',
    '  download archive ON per output profile; disable with --no-archive',
    '  SponsorBlock mark adds chapters and does not cut the media.',
    '',
  ].join('\n');
}
