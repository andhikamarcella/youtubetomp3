import path from 'node:path';

export const PRESET_NAMES = ['balanced', 'music', 'lossless', 'mobile', 'hd', 'archive'];

export const PRESET_DESCRIPTIONS = {
  balanced: 'Deteksi otomatis dengan kualitas terbaik dan pengaturan aman.',
  music: 'MP3 320 kbps dengan thumbnail JPG, cover, metadata, dan chapter.',
  lossless: 'FLAC kualitas terbaik dengan thumbnail dan metadata.',
  mobile: 'MP4 720p yang ringan dan kompatibel untuk ponsel.',
  hd: 'MP4 1080p dengan format yang kompatibel untuk pemutar umum.',
  archive: 'Kualitas terbaik, MKV, subtitle, thumbnail, sidecar metadata, dan anti-duplikat.',
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
  if (!preset) {
    throw new Error(`Preset "${name}" tidak dikenal. Pilih: ${PRESET_NAMES.join(', ')}.`);
  }
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
