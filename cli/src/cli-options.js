import path from 'node:path';
import process from 'node:process';
import { applyPreset, PRESET_NAMES, presetText } from './presets.js';
import { SOCIAL_PLATFORM_KEYS } from './social-platforms.js';
import { CLI_VERSION } from './version.js';

const IMAGE_FORMATS = new Set(['original', 'jpg', 'png', 'webp']);
const AUDIO_FORMATS = new Set(['mp3', 'm4a', 'aac', 'opus', 'vorbis', 'flac', 'alac', 'wav']);
const VIDEO_FORMATS = new Set(['auto', 'mp4', 'mkv', 'webm']);
const AUDIO_QUALITIES = new Set(['best', '320', '256', '192', '128', '96']);
const RESOLUTIONS = new Set(['best', '2160', '1440', '1080', '720', '480', '360', '240', '144']);
const SPONSORBLOCK_MODES = new Set(['off', 'mark', 'remove']);
const DEFAULT_SPONSORBLOCK_CATEGORIES = 'sponsor,selfpromo,interaction,intro,outro,preview,music_offtopic';

function takeValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${flag} membutuhkan nilai.`);
  return value;
}

function validateChoice(value, allowed, flag) {
  const normalized = String(value).toLowerCase();
  if (!allowed.has(normalized)) {
    throw new Error(`${flag} harus salah satu dari: ${[...allowed].join(', ')}.`);
  }
  return normalized;
}

function validateTime(value, flag) {
  const normalized = String(value).trim();
  if (!/^\d+(?::[0-5]\d){0,2}(?:\.\d+)?$/u.test(normalized)) {
    throw new Error(`${flag} harus berupa detik, MM:SS, atau HH:MM:SS.`);
  }
  return normalized;
}

function validateInteger(value, flag, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(number) || String(number) !== String(value) || number < min || number > max) {
    throw new Error(`${flag} harus angka bulat ${min}–${max}.`);
  }
  return number;
}

function validateRate(value, flag) {
  const normalized = String(value).trim().toUpperCase();
  if (!/^\d+(?:\.\d+)?[KMG]?$/u.test(normalized)) {
    throw new Error(`${flag} harus seperti 500K, 2M, atau 1.5G.`);
  }
  return normalized;
}

function validateProxy(value, flag) {
  const normalized = String(value).trim();
  if (!/^(?:https?|socks4a?|socks5h?):\/\//iu.test(normalized)) {
    throw new Error(`${flag} harus URL proxy http(s), socks4, atau socks5.`);
  }
  return normalized;
}

function validateTemplate(value, flag) {
  const normalized = String(value).trim();
  if (!normalized || normalized.length > 500 || /[\0\r\n]/u.test(normalized)) {
    throw new Error(`${flag} tidak valid atau terlalu panjang.`);
  }
  if (path.isAbsolute(normalized) || normalized.split(/[\\/]+/u).includes('..')) {
    throw new Error(`${flag} harus template relatif di dalam folder output.`);
  }
  if (!normalized.includes('%(ext)s')) {
    throw new Error(`${flag} wajib memuat %(ext)s agar ekstensi hasil benar.`);
  }
  return normalized;
}

function validatePlaylistItems(value, flag) {
  const normalized = String(value).trim();
  if (!/^[0-9,:-]+$/u.test(normalized)) {
    throw new Error(`${flag} hanya menerima angka, koma, titik dua, dan tanda hubung.`);
  }
  return normalized;
}

function defaultOptions() {
  return {
    help: false,
    version: false,
    diagnose: false,
    checkUpdate: false,
    update: false,
    noUpdateCheck: false,
    listPresets: false,
    dryRun: false,
    json: false,
    listFormats: false,
    listSubs: false,
    initialUrl: '',
    outputDirectory: '',
    cookiesPath: '',
    initialMode: 'auto',
    initialPlatform: 'auto',
    initialImageFormat: 'original',
    initialPlaylist: false,
    forceGallery: false,
    forceVideo: false,
    galleryInclude: '',
    preset: 'balanced',
    audioFormat: 'mp3',
    audioQuality: 'best',
    videoFormat: 'auto',
    resolution: 'best',
    subtitles: false,
    subtitleLanguages: 'all,-live_chat',
    writeInfoJson: false,
    writeDescription: false,
    writeThumbnail: false,
    clipStart: '',
    clipEnd: '',
    archivePath: '',
    sponsorBlockMode: 'off',
    sponsorBlockCategories: DEFAULT_SPONSORBLOCK_CATEGORIES,
    normalizeAudio: false,
    keepVideo: false,
    overwrite: false,
    rateLimit: '',
    concurrentFragments: 4,
    proxy: '',
    outputTemplate: '',
    restrictFilenames: false,
    logFile: '',
    playlistItems: '',
    maxDownloads: 0,
    liveFromStart: false,
  };
}

function presetFromArguments(argv) {
  const index = argv.indexOf('--preset');
  if (index < 0) return '';
  return takeValue(argv, index, '--preset').toLowerCase();
}

export function parseCliOptions(argv = []) {
  const options = defaultOptions();
  const selectedPreset = presetFromArguments(argv);
  if (selectedPreset) applyPreset(options, selectedPreset);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (/^https?:\/\//iu.test(argument)) {
      options.initialUrl ||= argument;
      continue;
    }

    switch (argument) {
      case '--help':
      case '-h': options.help = true; break;
      case '--version':
      case '-v': options.version = true; break;
      case '--diagnose': options.diagnose = true; break;
      case '--check-update': options.checkUpdate = true; break;
      case '--update': options.update = true; break;
      case '--no-update-check': options.noUpdateCheck = true; break;
      case '--list-presets': options.listPresets = true; break;
      case '--dry-run': options.dryRun = true; break;
      case '--json': options.json = true; options.dryRun = true; options.noUpdateCheck = true; break;
      case '--list-formats': options.listFormats = true; options.noUpdateCheck = true; break;
      case '--list-subs': options.listSubs = true; options.noUpdateCheck = true; break;
      case '--preset':
        validateChoice(takeValue(argv, index, argument), new Set(PRESET_NAMES), argument);
        index += 1;
        break;
      case '--platform':
      case '--social': {
        const platform = takeValue(argv, index, argument).toLowerCase();
        if (!SOCIAL_PLATFORM_KEYS.includes(platform)) {
          throw new Error(`Platform "${platform}" tidak dikenali. Pilih: ${SOCIAL_PLATFORM_KEYS.join(', ')}`);
        }
        options.initialPlatform = platform;
        index += 1;
        break;
      }
      case '--audio':
        options.initialMode = 'audio'; options.forceGallery = false; options.forceVideo = false; break;
      case '--video':
        options.initialMode = 'video'; options.forceVideo = true; options.forceGallery = false; break;
      case '--image':
      case '--images':
      case '--gallery':
        options.initialMode = 'image'; options.forceGallery = true; options.forceVideo = false; break;
      case '--auto':
        options.initialMode = 'auto'; options.forceGallery = false; options.forceVideo = false; break;
      case '--stories':
        options.initialMode = 'image'; options.initialPlatform = 'instagram'; options.forceGallery = true;
        options.forceVideo = false; options.galleryInclude = 'stories'; break;
      case '--all-media':
        options.initialMode = 'image'; options.initialPlatform = 'instagram'; options.forceGallery = true;
        options.forceVideo = false; options.galleryInclude = 'all'; break;
      case '--image-format':
        options.initialImageFormat = validateChoice(takeValue(argv, index, argument), IMAGE_FORMATS, argument);
        index += 1; break;
      case '--audio-format':
        options.audioFormat = validateChoice(takeValue(argv, index, argument), AUDIO_FORMATS, argument);
        options.initialMode = 'audio'; index += 1; break;
      case '--audio-quality':
      case '--bitrate':
        options.audioQuality = validateChoice(takeValue(argv, index, argument), AUDIO_QUALITIES, argument);
        options.initialMode = 'audio'; index += 1; break;
      case '--video-format':
      case '--container':
        options.videoFormat = validateChoice(takeValue(argv, index, argument), VIDEO_FORMATS, argument);
        options.initialMode = 'video'; options.forceVideo = true; index += 1; break;
      case '--resolution':
        options.resolution = validateChoice(takeValue(argv, index, argument), RESOLUTIONS, argument);
        options.initialMode = 'video'; options.forceVideo = true; index += 1; break;
      case '--subtitles':
        options.subtitles = true; options.initialMode = 'video'; options.forceVideo = true; break;
      case '--subtitle-langs':
        options.subtitleLanguages = takeValue(argv, index, argument);
        options.subtitles = true; options.initialMode = 'video'; options.forceVideo = true; index += 1; break;
      case '--metadata-files': options.writeInfoJson = true; options.writeDescription = true; break;
      case '--write-info-json': options.writeInfoJson = true; break;
      case '--write-description': options.writeDescription = true; break;
      case '--thumbnail':
      case '--write-thumbnail': options.writeThumbnail = true; break;
      case '--start': options.clipStart = validateTime(takeValue(argv, index, argument), argument); index += 1; break;
      case '--end': options.clipEnd = validateTime(takeValue(argv, index, argument), argument); index += 1; break;
      case '--archive': options.archivePath = path.resolve(takeValue(argv, index, argument)); index += 1; break;
      case '--sponsorblock':
      case '--sponsorblock-mode':
        options.sponsorBlockMode = validateChoice(
          takeValue(argv, index, argument), SPONSORBLOCK_MODES, argument,
        );
        index += 1; break;
      case '--remove-sponsors': options.sponsorBlockMode = 'remove'; break;
      case '--sponsorblock-categories':
        options.sponsorBlockCategories = takeValue(argv, index, argument); index += 1; break;
      case '--normalize-audio': options.normalizeAudio = true; options.initialMode = 'audio'; break;
      case '--keep-video': options.keepVideo = true; options.initialMode = 'audio'; break;
      case '--overwrite': options.overwrite = true; break;
      case '--rate-limit': options.rateLimit = validateRate(takeValue(argv, index, argument), argument); index += 1; break;
      case '--concurrent-fragments':
        options.concurrentFragments = validateInteger(takeValue(argv, index, argument), argument, { min: 1, max: 16 });
        index += 1; break;
      case '--proxy': options.proxy = validateProxy(takeValue(argv, index, argument), argument); index += 1; break;
      case '--output-template':
        options.outputTemplate = validateTemplate(takeValue(argv, index, argument), argument); index += 1; break;
      case '--restrict-filenames': options.restrictFilenames = true; break;
      case '--log-file': options.logFile = path.resolve(takeValue(argv, index, argument)); index += 1; break;
      case '--playlist-items':
        options.playlistItems = validatePlaylistItems(takeValue(argv, index, argument), argument);
        options.initialPlaylist = true; index += 1; break;
      case '--max-downloads':
        options.maxDownloads = validateInteger(takeValue(argv, index, argument), argument, { min: 1, max: 100000 });
        index += 1; break;
      case '--live-from-start': options.liveFromStart = true; break;
      case '--playlist': options.initialPlaylist = true; break;
      case '--output':
      case '-o': options.outputDirectory = path.resolve(takeValue(argv, index, argument)); index += 1; break;
      case '--cookies': options.cookiesPath = path.resolve(takeValue(argv, index, argument)); index += 1; break;
      default: throw new Error(`Opsi tidak dikenal: ${argument}`);
    }
  }

  return options;
}

export function isDirectCommand(options = {}) {
  return Boolean(options.dryRun || options.json || options.listFormats || options.listSubs);
}

export function applyCliEnvironment(options = {}) {
  const set = (name, value) => {
    if (value !== undefined && value !== null && value !== '') process.env[name] = String(value);
    else delete process.env[name];
  };
  const flag = (name, value) => {
    if (value) process.env[name] = '1';
    else delete process.env[name];
  };

  set('YTCONV_PRESET', options.preset);
  set('YTCONV_AUDIO_FORMAT', options.audioFormat);
  set('YTCONV_AUDIO_QUALITY', options.audioQuality);
  set('YTCONV_VIDEO_FORMAT', options.videoFormat);
  set('YTCONV_RESOLUTION', options.resolution);
  set('YTCONV_SUBTITLE_LANGS', options.subtitleLanguages);
  set('YTCONV_CLIP_START', options.clipStart);
  set('YTCONV_CLIP_END', options.clipEnd);
  set('YTCONV_ARCHIVE', options.archivePath);
  set('YTCONV_SPONSORBLOCK_MODE', options.sponsorBlockMode);
  set('YTCONV_SPONSORBLOCK_CATEGORIES', options.sponsorBlockCategories);
  set('YTCONV_RATE_LIMIT', options.rateLimit);
  set('YTCONV_CONCURRENT_FRAGMENTS', options.concurrentFragments);
  set('YTCONV_PROXY', options.proxy);
  set('YTCONV_OUTPUT_TEMPLATE', options.outputTemplate);
  set('YTCONV_LOG_FILE', options.logFile);
  set('YTCONV_PLAYLIST_ITEMS', options.playlistItems);
  set('YTCONV_MAX_DOWNLOADS', options.maxDownloads || '');
  flag('YTCONV_SUBTITLES', options.subtitles);
  flag('YTCONV_WRITE_INFO_JSON', options.writeInfoJson);
  flag('YTCONV_WRITE_DESCRIPTION', options.writeDescription);
  flag('YTCONV_WRITE_THUMBNAIL', options.writeThumbnail);
  flag('YTCONV_NORMALIZE_AUDIO', options.normalizeAudio);
  flag('YTCONV_KEEP_VIDEO', options.keepVideo);
  flag('YTCONV_OVERWRITE', options.overwrite);
  flag('YTCONV_RESTRICT_FILENAMES', options.restrictFilenames);
  flag('YTCONV_LIVE_FROM_START', options.liveFromStart);
}

export function helpText() {
  return `YTConv CLI v${CLI_VERSION}\n\n`
    + 'Pemakaian:\n'
    + '  ytconv [LINK] [OPSI]\n'
    + '  npx -y ytconv@latest [LINK]\n\n'
    + 'Preset matang:\n'
    + '  --preset NAME          balanced, music, lossless, mobile, hd, archive\n'
    + '  --list-presets         Jelaskan seluruh preset\n\n'
    + 'Mode dan platform:\n'
    + '  --auto / --video / --audio / --image\n'
    + '  --platform PLATFORM    Deteksi atau paksa platform sosial\n'
    + '  --playlist             Unduh playlist atau kumpulan post\n'
    + '  --playlist-items ITEMS Contoh 1,3,5-10 atau 1:20:2\n'
    + '  --max-downloads N      Batasi jumlah media\n'
    + '  --live-from-start      Ambil live stream dari awal bila tersedia\n\n'
    + 'Konversi audio:\n'
    + '  --audio-format FMT     mp3, m4a, aac, opus, vorbis, flac, alac, wav\n'
    + '  --audio-quality RATE   best, 320, 256, 192, 128, atau 96 kbps\n'
    + '  --normalize-audio      Normalisasi loudness dengan FFmpeg loudnorm\n'
    + '  --keep-video           Simpan video asli setelah ekstraksi audio\n\n'
    + 'Konversi video:\n'
    + '  --video-format FMT     auto, mp4, mkv, atau webm\n'
    + '  --resolution SIZE      best sampai 144p\n'
    + '  --subtitles            Subtitle biasa + otomatis, SRT, lalu embed\n'
    + '  --subtitle-langs LANG  Contoh id,en atau all,-live_chat\n\n'
    + 'SponsorBlock dan file pendamping:\n'
    + '  --sponsorblock MODE    off, mark, atau remove\n'
    + '  --remove-sponsors      Alias cepat untuk mode remove\n'
    + '  --thumbnail            Simpan thumbnail JPG terpisah\n'
    + '  --metadata-files       Simpan info.json dan description\n'
    + '  --start/--end TIME     Potong detik, MM:SS, atau HH:MM:SS\n'
    + '  --archive FILE         Catat ID agar tidak terunduh ulang\n\n'
    + 'Jaringan, file, dan performa:\n'
    + '  --rate-limit RATE      Contoh 2M atau 500K\n'
    + '  --concurrent-fragments N  1–16 fragmen paralel\n'
    + '  --proxy URL            Proxy http(s)/socks\n'
    + '  --overwrite            Timpa hasil lama\n'
    + '  --restrict-filenames   Nama file ASCII yang aman\n'
    + '  --output-template TPL  Template relatif; wajib memuat %(ext)s\n'
    + '  -o, --output PATH      Pilih folder hasil\n'
    + '  --cookies FILE         Gunakan cookies.txt Netscape\n'
    + '  --log-file FILE        Simpan log sesi untuk troubleshooting\n\n'
    + 'Pemeriksaan tanpa download:\n'
    + '  --dry-run LINK         Tampilkan ringkasan media\n'
    + '  --json LINK            Ringkasan JSON stabil untuk script\n'
    + '  --list-formats LINK    Tampilkan format yt-dlp\n'
    + '  --list-subs LINK       Tampilkan subtitle yang tersedia\n\n'
    + 'Sistem:\n'
    + '  --diagnose / --check-update / --update / --no-update-check\n'
    + '  -h, --help / -v, --version\n\n'
    + 'Contoh:\n'
    + '  ytconv --preset music "LINK"\n'
    + '  ytconv --preset archive --playlist "LINK_PLAYLIST"\n'
    + '  ytconv --video-format mp4 --resolution 1080 --subtitles "LINK"\n'
    + '  ytconv --remove-sponsors --normalize-audio --audio "LINK"\n'
    + '  ytconv --dry-run --json "LINK"\n\n'
    + 'Preset:\n'
    + `${presetText()}\n`;
}
