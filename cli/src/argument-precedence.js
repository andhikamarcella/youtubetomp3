const FLAG_GROUPS = new Map([
  ['--preset', 'preset'],
  ['--output', 'output'],
  ['--audio-format', 'audioFormat'],
  ['--audio-quality', 'audioQuality'],
  ['--video-format', 'videoFormat'],
  ['--resolution', 'resolution'],
  ['--subtitle-langs', 'subtitles'],
  ['--subtitles', 'subtitles'],
  ['--no-subtitles', 'subtitles'],
  ['--sponsorblock', 'sponsorBlock'],
  ['--no-sponsorblock', 'sponsorBlock'],
  ['--archive', 'archive'],
  ['--no-archive', 'archive'],
  ['--concurrent-fragments', 'concurrentFragments'],
  ['--rate-limit', 'rateLimit'],
  ['--restrict-filenames', 'restrictFilenames'],
  ['--normalize-audio', 'normalizeAudio'],
  ['--retries', 'retries'],
  ['--fragment-retries', 'fragmentRetries'],
]);

const VALUE_FLAGS = new Set([
  '--preset', '--output', '--audio-format', '--audio-quality', '--video-format',
  '--resolution', '--subtitle-langs', '--sponsorblock', '--archive',
  '--concurrent-fragments', '--rate-limit', '--retries', '--fragment-retries',
]);

const PRESET_MEDIA_GROUPS = new Set([
  'preset', 'audioFormat', 'audioQuality', 'videoFormat', 'resolution',
  'subtitles', 'sponsorBlock', 'normalizeAudio', 'restrictFilenames',
]);

const USER_DATA_META_FLAGS = new Set(['--no-config']);
const USER_DATA_META_VALUE_FLAGS = new Set(['--profile']);

function runtimeExplicitArgs(args) {
  const kept = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (USER_DATA_META_FLAGS.has(value)) continue;
    if (USER_DATA_META_VALUE_FLAGS.has(value)) {
      index += 1;
      continue;
    }
    kept.push(value);
  }
  return kept;
}

function explicitGroups(args) {
  const groups = new Set();
  for (const value of args) {
    const group = FLAG_GROUPS.get(value);
    if (group) groups.add(group);
  }
  if (args.includes('--preset')) {
    for (const group of PRESET_MEDIA_GROUPS) groups.add(group);
  }
  return groups;
}

export function applyExplicitPrecedence(resolvedArgs = [], explicitArgs = []) {
  const runtimeArgs = runtimeExplicitArgs(explicitArgs);
  const prefixLength = Math.max(0, resolvedArgs.length - runtimeArgs.length);
  const savedArgs = resolvedArgs.slice(0, prefixLength);
  const groups = explicitGroups(runtimeArgs);
  if (!groups.size) return [...resolvedArgs];

  const kept = [];
  for (let index = 0; index < savedArgs.length; index += 1) {
    const flag = savedArgs[index];
    const group = FLAG_GROUPS.get(flag);
    const hasValue = VALUE_FLAGS.has(flag);
    if (!group || !groups.has(group)) {
      kept.push(flag);
      if (hasValue && index + 1 < savedArgs.length) kept.push(savedArgs[index + 1]);
    }
    if (hasValue) index += 1;
  }
  return [...kept, ...runtimeArgs];
}
