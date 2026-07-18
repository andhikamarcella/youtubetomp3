import path from 'node:path';
import { SOCIAL_PLATFORM_KEYS } from './social-platforms.js';
import { CLI_VERSION } from './version.js';

const IMAGE_FORMATS = new Set(['original', 'jpg', 'png', 'webp']);

function takeValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${flag} membutuhkan nilai.`);
  return value;
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
      case '--image-format': {
        const format = takeValue(argv, index, argument).toLowerCase();
        if (!IMAGE_FORMATS.has(format)) {
          throw new Error('--image-format harus original, jpg, png, atau webp.');
        }
        options.initialImageFormat = format;
        index += 1;
        break;
      }
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

export function helpText() {
  return `YTConv CLI v${CLI_VERSION}\n\n`
    + 'Pemakaian:\n'
    + '  ytconv [link] [opsi]\n'
    + '  npx -y ytconv@latest [link]\n\n'
    + 'Pilihan sosmed:\n'
    + '  --platform auto        Deteksi otomatis semua sosmed\n'
    + '  --platform youtube     YouTube / YouTube Music\n'
    + '  --platform instagram   Instagram post, Reel, dan Story\n'
    + '  --platform facebook    Facebook post, video, Reel, dan foto\n'
    + '  --platform tiktok      TikTok video dan photo post\n'
    + '  --platform x           X / Twitter\n'
    + '  --platform pinterest   Pinterest\n'
    + '  --platform reddit      Reddit\n\n'
    + 'Opsi:\n'
    + '  -h, --help             Tampilkan bantuan\n'
    + '  -v, --version          Tampilkan versi\n'
    + '      --diagnose         Cek engine, output, cookies, dan update\n'
    + '      --check-update     Cek versi terbaru di npm\n'
    + '      --update           Update otomatis ke ytconv@latest\n'
    + '      --no-update-check  Matikan pengecekan update untuk sesi ini\n'
    + '      --image-format FMT Pilih original, jpg, png, atau webp\n'
    + '      --playlist         Aktifkan playlist atau kumpulan post\n'
    + '  -o, --output PATH      Pilih folder hasil\n'
    + '      --cookies FILE     Gunakan cookies.txt Netscape\n\n'
    + 'Mode lanjutan kompatibilitas lama:\n'
    + '      --auto / --video / --audio / --image\n'
    + '      --stories / --all-media\n\n'
    + 'Contoh:\n'
    + '  ytconv --platform instagram "https://www.instagram.com/p/..."\n'
    + '  ytconv --platform facebook "https://www.facebook.com/..."\n'
    + '  ytconv --platform tiktok "https://www.tiktok.com/@user/video/..."\n'
    + '  ytconv --platform pinterest --image-format jpg "LINK_PIN"\n';
}
