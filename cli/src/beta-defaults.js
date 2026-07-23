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

export function applyBetaDefaults(options = {}, toggles = {}) {
  const disabled = toggles.disabled || {};

  // Stable 1.4.0 keeps potentially surprising behavior opt-in.
  if (disabled.subtitles) options.subtitles = false;
  if (disabled.sponsorBlock) options.sponsorBlockMode = 'off';
  if (disabled.archive) {
    options.archivePath = '';
    options.galleryArchivePath = '';
  } else if (options.archivePath) {
    options.galleryArchivePath = `${options.archivePath}.gallery.sqlite3`;
  }

  return options;
}

export function betaDefaultsHelpText() {
  return [
    'YTConv 1.4.0 stable defaults:',
    '  subtitles       OFF by default; enable with --subtitles',
    '  SponsorBlock    OFF by default; enable with --sponsorblock mark or remove',
    '  download archive OFF by default; enable with --archive FILE',
    '',
  ].join('\n');
}
