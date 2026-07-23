import path from 'node:path';

export const PRESET_NAMES = ['balanced', 'music', 'lossless', 'mobile', 'hd', 'archive'];

export const PRESET_DESCRIPTIONS = {
  balanced: 'Automatic detection with the best available quality and safe settings.',
  music: 'MP3 320 kbps with a JPG thumbnail, embedded cover, metadata, and chapters.',
  lossless: 'Best-source FLAC with a thumbnail and metadata.',
  mobile: 'Lightweight and compatible MP4 up to 720p.',
  hd: 'Compatible MP4 up to 1080p.',
  archive: 'Best quality, MKV, subtitles, thumbnail, metadata sidecars, and duplicate prevention.',
};

const PRESETS = {
  balanced: {},
  music: {
    initialMode: 'audio',
    audioFormat: 'mp3',
    audioQuality: '320',
    writeThumbnail: true,
  },
  lossless: {
    initialMode: 'audio',
    audioFormat: 'flac',
    audioQuality: 'best',
    writeThumbnail: true,
  },
  mobile: {
    initialMode: 'video',
    forceVideo: true,
    videoFormat: 'mp4',
    resolution: '720',
  },
  hd: {
    initialMode: 'video',
    forceVideo: true,
    videoFormat: 'mp4',
    resolution: '1080',
  },
  archive: {
    initialMode: 'auto',
    initialPlaylist: true,
    videoFormat: 'mkv',
    resolution: 'best',
    subtitles: true,
    subtitleLanguages: 'all,-live_chat',
    writeInfoJson: true,
    writeDescription: true,
    writeThumbnail: true,
    restrictFilenames: true,
  },
};

export function applyPreset(options, name, { cwd = process.cwd() } = {}) {
  const preset = PRESETS[name];
  if (!preset) throw new Error(`--preset must be one of: ${PRESET_NAMES.join(', ')}.`);
  Object.assign(options, preset, { preset: name });
  if (name === 'archive' && !options.archivePath) {
    options.archivePath = path.resolve(cwd, 'ytconv-archive.txt');
  }
  return options;
}

export function presetText() {
  return PRESET_NAMES
    .map((name) => `${name.padEnd(10)} ${PRESET_DESCRIPTIONS[name]}`)
    .join('\n');
}
