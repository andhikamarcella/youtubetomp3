import path from 'node:path';
import process from 'node:process';
import { SOCIAL_PLATFORM_KEYS } from './social-platforms.js';
import { CLI_VERSION } from './version.js';

const IMAGE_FORMATS = new Set(['original', 'jpg', 'png', 'webp']);
const AUDIO_FORMATS = new Set(['mp3', 'm4a', 'opus', 'flac', 'wav']);
const VIDEO_FORMATS = new Set(['auto', 'mp4', 'mkv', 'webm']);
const AUDIO_QUALITIES = new Set(['best', '320', '256', '192', '128']);
const RESOLUTIONS = new Set(['best', '2160', '1440', '1080', '720', '480', '360']);

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

export function parseCliOptions(argv = []) {
  const options = {
    help: false,
    version: false,
    diagnose: false,
    checkUpdate: false,
    update: false,
    noUpdateCheck: false,
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
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (/^https?:\/\//iu.test(argument)) {
      options.initialUrl ||= argument;
      continue;
    }

    switch (argument) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--version':
      case '-v':
        options.version = true;
        break;
      case '--diagnose':
        options.diagnose = true;
        break;
      case '--check-update':
        options.checkUpdate = true;
        break;
      case '--update':
        options.update = true;
        break;
      case '--no-update-check':
        options.noUpdateCheck = true;
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
        options.initialMode = 'audio';
        options.forceGallery = false;
        options.forceVideo = false;
        break;
      case '--video':
        options.initialMode = 'video';
        options.forceVideo = true;
        options.forceGallery = false;
        break;
      case '--image':
      case '--images':
      case '--gallery':
        options.initialMode = 'image';
        options.forceGallery = true;
        options.forceVideo = false;
        break;
      case '--auto':
        options.initialMode = 'auto';
        options.forceGallery = false;
        options.forceVideo = false;
        break;
      case '--stories':
        options.initialMode = 'image';
        options.initialPlatform = 'instagram';
        options.forceGallery = true;
        options.forceVideo = false;
        options.galleryInclude = 'stories';
        break;
      case '--all-media':
        options.initialMode = 'image';
        options.initialPlatform = 'instagram';
        options.forceGallery = true;
        options.forceVideo = false;
        options.galleryInclude = 'all';
        break;
      case '--image-format':
        options.initialImageFormat = validateChoice(
          takeValue(argv, index, argument), IMAGE_FORMATS, argument,
        );
        index += 1;
        break;
      case '--audio-format':
        options.audioFormat = validateChoice(
          takeValue(argv, index, argument), AUDIO_FORMATS, argument,
        );
        options.initialMode = 'audio';
        index += 1;
        break;
      case '--audio-quality':
      case '--bitrate':
        options.audioQuality = validateChoice(
          takeValue(argv, index, argument), AUDIO_QUALITIES, argument,
        );
        options.initialMode = 'audio';
        index += 1;
        break;
      case '--video-format':
      case '--container':
        options.videoFormat = validateChoice(
          takeValue(argv, index, argument), VIDEO_FORMATS, argument,
        );
        options.initialMode = 'video';
        options.forceVideo = true;
        index += 1;
        break;
      case '--resolution':
        options.resolution = validateChoice(
          takeValue(argv, index, argument), RESOLUTIONS, argument,
        );
        options.initialMode = 'video';
        options.forceVideo = true;
        index += 1;
        break;
      case '--subtitles':
        options.subtitles = true;
        options.initialMode = 'video';
        options.forceVideo = true;
        break;
      case '--subtitle-langs':
        options.subtitleLanguages = takeValue(argv, index, argument);
        options.subtitles = true;
        options.initialMode = 'video';
        options.forceVideo = true;
        index += 1;
        break;
      case '--metadata-files':
        options.writeInfoJson = true;
        options.writeDescription = true;
        break;
      case '--write-info-json':
        options.writeInfoJson = true;
        break;
      case '--write-description':
        options.writeDescription = true;
        break;
      case '--thumbnail':
      case '--write-thumbnail':
        options.writeThumbnail = true;
        break;
      case '--start':
        options.clipStart = validateTime(takeValue(argv, index, argument), argument);
        index += 1;
        break;
      case '--end':
        options.clipEnd = validateTime(takeValue(argv, index, argument), argument);
        index += 1;
        break;
      case '--archive':
        options.archivePath = path.resolve(takeValue(argv, index, argument));
        index += 1;
        break;
      case '--playlist':
        options.initialPlaylist = true;
        break;
      case '--output':
      case '-o':
        options.outputDirectory = path.resolve(takeValue(argv, index, argument));
        index += 1;
        break;
      case '--cookies':
        options.cookiesPath = path.resolve(takeValue(argv, index, argument));
        index += 1;
        break;
      default:
        throw new Error(`Opsi tidak dikenal: ${argument}`);
    }
  }

  return options;
}

export function applyCliEnvironment(options = {}) {
  const set = (name, value) => {
    if (value !== undefined && value !== null && value !== '') process.env[name] = String(value);
  };
  const flag = (name, value) => {
    if (value) process.env[name] = '1';
    else delete process.env[name];
  };

  set('YTCONV_AUDIO_FORMAT', options.audioFormat);
  set('YTCONV_AUDIO_QUALITY', options.audioQuality);
  set('YTCONV_VIDEO_FORMAT', options.videoFormat);
  set('YTCONV_RESOLUTION', options.resolution);
  set('YTCONV_SUBTITLE_LANGS', options.subtitleLanguages);
  set('YTCONV_CLIP_START', options.clipStart);
  set('YTCONV_CLIP_END', options.clipEnd);
  set('YTCONV_ARCHIVE', options.archivePath);
  flag('YTCONV_SUBTITLES', options.subtitles);
  flag('YTCONV_WRITE_INFO_JSON', options.writeInfoJson);
  flag('YTCONV_WRITE_DESCRIPTION', options.writeDescription);
  flag('YTCONV_WRITE_THUMBNAIL', options.writeThumbnail);
}

export function helpText() {
  return `YTConv CLI v${CLI_VERSION}\n\n`
    + 'Pemakaian:\n'
    + '  ytconv [link] [opsi]\n'
    + '  npx -y ytconv@latest [link]\n\n'
    + 'Mode dan platform:\n'
    + '  --auto / --video / --audio / --image\n'
    + '  --platform PLATFORM    Deteksi atau paksa platform sosial\n'
    + '  --playlist             Unduh playlist atau kumpulan post\n\n'
    + 'Konversi audio:\n'
    + '  --audio-format FMT     mp3, m4a, opus, flac, atau wav\n'
    + '  --audio-quality RATE   best, 320, 256, 192, atau 128 kbps\n\n'
    + 'Konversi video:\n'
    + '  --video-format FMT     auto, mp4, mkv, atau webm\n'
    + '  --resolution SIZE      best, 2160, 1440, 1080, 720, 480, 360\n'
    + '  --subtitles            Simpan subtitle normal dan otomatis\n'
    + '  --subtitle-langs LANG  Contoh: id,en atau all,-live_chat\n\n'
    + 'File tambahan dan potong durasi:\n'
    + '  --thumbnail            Simpan thumbnail JPG terpisah\n'
    + '  --metadata-files       Simpan info.json dan description\n'
    + '  --write-info-json      Simpan metadata mentah JSON\n'
    + '  --write-description    Simpan deskripsi sebagai file teks\n'
    + '  --start TIME           Mulai dari detik/MM:SS/HH:MM:SS\n'
    + '  --end TIME             Berhenti pada detik/MM:SS/HH:MM:SS\n'
    + '  --archive FILE         Catat ID agar tidak terunduh ulang\n\n'
    + 'Gambar, akses, dan lokasi:\n'
    + '  --image-format FMT     original, jpg, png, atau webp\n'
    + '  -o, --output PATH      Pilih folder hasil\n'
    + '  --cookies FILE         Gunakan cookies.txt Netscape\n'
    + '  --stories / --all-media\n\n'
    + 'Sistem:\n'
    + '  -h, --help             Tampilkan bantuan\n'
    + '  -v, --version          Tampilkan versi\n'
    + '  --diagnose             Cek engine dan konfigurasi\n'
    + '  --check-update         Cek versi terbaru di npm\n'
    + '  --update               Update otomatis ke ytconv@latest\n'
    + '  --no-update-check      Matikan pengecekan update sesi ini\n\n'
    + 'Contoh:\n'
    + '  ytconv --audio-format flac --thumbnail "LINK"\n'
    + '  ytconv --video-format mp4 --resolution 1080 --subtitles "LINK"\n'
    + '  ytconv --start 01:00 --end 02:30 --metadata-files "LINK"\n'
    + '  ytconv --archive downloaded.txt --playlist "LINK_PLAYLIST"\n';
}
