import path from 'node:path';
import { CLI_VERSION } from './version.js';

function takeValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`${flag} membutuhkan nilai.`);
  }
  return value;
}

export function parseCliOptions(argv = []) {
  const options = {
    help: false,
    version: false,
    diagnose: false,
    initialUrl: '',
    outputDirectory: '',
    cookiesPath: '',
    initialMode: 'video',
    initialPlaylist: false,
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
      case '--audio':
        options.initialMode = 'audio';
        break;
      case '--video':
        options.initialMode = 'video';
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

export function helpText() {
  return `YTConv CLI v${CLI_VERSION}\n\n`
    + 'Pemakaian:\n'
    + '  ytconv [link] [opsi]\n'
    + '  npx -y ytconv@latest [link]\n\n'
    + 'Opsi:\n'
    + '  -h, --help          Tampilkan bantuan\n'
    + '  -v, --version       Tampilkan versi\n'
    + '      --diagnose      Cek Node.js, yt-dlp, FFmpeg, dan folder output\n'
    + '      --audio         Mulai dalam mode audio\n'
    + '      --video         Mulai dalam mode video\n'
    + '      --playlist      Aktifkan playlist\n'
    + '  -o, --output PATH   Pilih folder hasil\n'
    + '      --cookies FILE  Gunakan cookies.txt Netscape\n\n'
    + 'Contoh:\n'
    + '  ytconv "https://www.youtube.com/watch?v=..."\n'
    + '  ytconv --audio --output D:\\Music "https://..."\n'
    + '  ytconv --diagnose\n';
}
