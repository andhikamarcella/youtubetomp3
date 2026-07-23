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
const BROWSERS = new Set(['chrome', 'chromium', 'edge', 'firefox', 'brave', 'opera', 'vivaldi', 'safari', 'whale']);
const DEFAULT_SPONSORBLOCK_CATEGORIES = 'sponsor,selfpromo,interaction,intro,outro,preview,music_offtopic';

function takeValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${flag} membutuhkan nilai.`);
  return value;
}

function validateChoice(value, allowed, flag) {
  const normalized = String(value).toLowerCase();
  if (!allowed.has(normalized)) throw new Error(`${flag} harus salah satu dari: ${[...allowed].join(', ')}.`);
  return normalized;
}

function validateText(value, flag, max = 500) {
  const normalized = String(value).trim();
  if (!normalized || normalized.length > max || /[\0\r\n]/u.test(normalized)) {
    throw new Error(`${flag} tidak valid atau terlalu panjang.`);
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

function validateRetries(value, flag) {
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'infinite') return normalized;
  return String(validateInteger(normalized, flag, { min: 0, max: 1000 }));
}

function validateRetrySleep(value, flag) {
  const normalized = validateText(value, flag, 120);
  if (!/^(?:(?:http|fragment|file_access|extractor):)?(?:\d+(?:\.\d+)?|linear=\d+(?::\d*)?(?::\d*)?|exp=\d+(?::\d*)?(?::\d*)?)$/iu.test(normalized)) {
    throw new Error(`${flag} harus angka, linear=START:END:STEP, atau exp=START:END:BASE.`);
  }
  return normalized;
}

function validateRate(value, flag) {
  const normalized = String(value).trim().toUpperCase();
  if (!/^\d+(?:\.\d+)?[KMG]?$/u.test(normalized)) throw new Error(`${flag} harus seperti 500K, 2M, atau 1.5G.`);
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
  const normalized = validateText(value, flag);
  if (path.isAbsolute(normalized) || normalized.split(/[\\/]+/u).includes('..')) {
    throw new Error(`${flag} harus template relatif di dalam folder output.`);
  }
  if (!normalized.includes('%(ext)s')) throw new Error(`${flag} wajib memuat %(ext)s agar ekstensi hasil benar.`);
  return normalized;
}

function validatePlaylistItems(value, flag) {
  const normalized = String(value).trim();
  if (!/^[0-9,:-]+$/u.test(normalized)) {
    throw new Error(`${flag} hanya menerima angka, koma, titik dua, dan tanda hubung.`);
  }
  return normalized;
}

function validateBrowserSpec(value, flag) {
  const normalized = validateText(value, flag, 250).toLowerCase();
  const browser = normalized.split(/[+:]/u)[0];
  if (!BROWSERS.has(browser)) throw new Error(`${flag} browser harus salah satu dari: ${[...BROWSERS].join(', ')}.`);
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
    formatsJson: false,
    listSubs: false,
    initialUrl: '',
    outputDirectory: '',
    cookiesPath: '',
    cookiesBrowser: '',
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
    subtitleOnly: false,
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
    skipPlaylistAfterErrors: 0,
    liveFromStart: false,
    retries: '10',
    fragmentRetries: '10',
    fileAccessRetries: '3',
    retrySleep: 'linear=1::2',
    resume: true,
    cleanupPart: false,
    metadataArtist: '',
    metadataTitle: '',
    metadataAlbum: '',
    metadataTrack: '',
    metadataYear: '',
    metadataGenre: '',
    yes: false,
  };
}

function presetFromArguments(argv) {
  const index = argv.indexOf('--preset');
  if (index < 0) return '';
  return takeValue(argv, index, '--preset').toLowerCase();
}

function applyGenericFormat(options, value, flag) {
  const normalized = String(value).toLowerCase();
  if (AUDIO_FORMATS.has(normalized)) {
    options.audioFormat = normalized;
    options.initialMode = 'audio';
    options.forceVideo = false;
    return;
  }
  if (VIDEO_FORMATS.has(normalized)) {
    options.videoFormat = normalized;
    options.initialMode = 'video';
    options.forceVideo = true;
    return;
  }
  throw new Error(`${flag} harus format audio atau video yang didukung.`);
}

function applyGenericQuality(options, value, flag) {
  const normalized = String(value).toLowerCase().replace(/p$/u, '');
  if (AUDIO_QUALITIES.has(normalized)) {
    options.audioQuality = normalized;
    options.initialMode = 'audio';
    return;
  }
  if (RESOLUTIONS.has(normalized)) {
    options.resolution = normalized;
    options.initialMode = 'video';
    options.forceVideo = true;
    return;
  }
  throw new Error(`${flag} harus bitrate audio atau resolusi video yang didukung.`);
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
      case '--formats-json': options.formatsJson = true; options.noUpdateCheck = true; break;
      case '--list-subs': options.listSubs = true; options.noUpdateCheck = true; break;
      case '--yes':
      case '-y': options.yes = true; break;
      case '--preset':
        validateChoice(takeValue(argv, index, argument), new Set(PRESET_NAMES), argument);
        index += 1; break;
      case '--platform':
      case '--social': {
        const platform = takeValue(argv, index, argument).toLowerCase();
        if (!SOCIAL_PLATFORM_KEYS.includes(platform)) {
          throw new Error(`Platform "${platform}" tidak dikenali. Pilih: ${SOCIAL_PLATFORM_KEYS.join(', ')}`);
        }
        options.initialPlatform = platform;
        index += 1; break;
      }
      case '--audio': options.initialMode = 'audio'; options.forceGallery = false; options.forceVideo = false; break;
      case '--video': options.initialMode = 'video'; options.forceVideo = true; options.forceGallery = false; break;
      case '--image':
      case '--images':
      case '--gallery': options.initialMode = 'image'; options.forceGallery = true; options.forceVideo = false; break;
      case '--auto': options.initialMode = 'auto'; options.forceGallery = false; options.forceVideo = false; break;
      case '--stories':
        options.initialMode = 'image'; options.initialPlatform = 'instagram'; options.forceGallery = true;
        options.forceVideo = false; options.galleryInclude = 'stories'; break;
      case '--all-media':
        options.initialMode = 'image'; options.initialPlatform = 'instagram'; options.forceGallery = true;
        options.forceVideo = false; options.galleryInclude = 'all'; break;
      case '--image-format':
        options.initialImageFormat = validateChoice(takeValue(argv, index, argument), IMAGE_FORMATS, argument);
        index += 1; break;
      case '--format': applyGenericFormat(options, takeValue(argv, index, argument), argument); index += 1; break;
      case '--quality': applyGenericQuality(options, takeValue(argv, index, argument), argument); index += 1; break;
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
        options.resolution = validateChoice(String(takeValue(argv, index, argument)).replace(/p$/iu, ''), RESOLUTIONS, argument);
        options.initialMode = 'video'; options.forceVideo = true; index += 1; break;
      case '--subtitles': options.subtitles = true; options.initialMode = 'video'; options.forceVideo = true; break;
      case '--subtitle-only': options.subtitles = true; options.subtitleOnly = true; options.initialMode = 'video'; options.forceVideo = true; break;
      case '--subtitle-langs':
        options.subtitleLanguages = validateText(takeValue(argv, index, argument), argument, 250);
        options.subtitles = true; options.initialMode = 'video'; options.forceVideo = true; index += 1; break;
      case '--metadata': break;
      case '--metadata-files': options.writeInfoJson = true; options.writeDescription = true; break;
      case '--write-info-json': options.writeInfoJson = true; break;
      case '--write-description': options.writeDescription = true; break;
      case '--thumbnail':
      case '--write-thumbnail': options.writeThumbnail = true; break;
      case '--start':
      case '--from': options.clipStart = validateTime(takeValue(argv, index, argument), argument); index += 1; break;
      case '--end':
      case '--to': options.clipEnd = validateTime(takeValue(argv, index, argument), argument); index += 1; break;
      case '--archive': options.archivePath = path.resolve(takeValue(argv, index, argument)); index += 1; break;
      case '--sponsorblock':
      case '--sponsorblock-mode':
        options.sponsorBlockMode = validateChoice(takeValue(argv, index, argument), SPONSORBLOCK_MODES, argument);
        index += 1; break;
      case '--remove-sponsors': options.sponsorBlockMode = 'remove'; break;
      case '--sponsorblock-categories':
        options.sponsorBlockCategories = validateText(takeValue(argv, index, argument), argument, 250); index += 1; break;
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
      case '--skip-playlist-after-errors':
        options.skipPlaylistAfterErrors = validateInteger(takeValue(argv, index, argument), argument, { min: 1, max: 1000 });
        options.initialPlaylist = true; index += 1; break;
      case '--retries': options.retries = validateRetries(takeValue(argv, index, argument), argument); index += 1; break;
      case '--fragment-retries': options.fragmentRetries = validateRetries(takeValue(argv, index, argument), argument); index += 1; break;
      case '--file-access-retries': options.fileAccessRetries = validateRetries(takeValue(argv, index, argument), argument); index += 1; break;
      case '--retry-sleep': options.retrySleep = validateRetrySleep(takeValue(argv, index, argument), argument); index += 1; break;
      case '--resume': options.resume = true; break;
      case '--no-resume': options.resume = false; break;
      case '--cleanup-part': options.cleanupPart = true; break;
      case '--artist': options.metadataArtist = validateText(takeValue(argv, index, argument), argument); index += 1; break;
      case '--title': options.metadataTitle = validateText(takeValue(argv, index, argument), argument); index += 1; break;
      case '--album': options.metadataAlbum = validateText(takeValue(argv, index, argument), argument); index += 1; break;
      case '--track': options.metadataTrack = validateText(takeValue(argv, index, argument), argument, 50); index += 1; break;
      case '--year': options.metadataYear = validateText(takeValue(argv, index, argument), argument, 20); index += 1; break;
      case '--genre': options.metadataGenre = validateText(takeValue(argv, index, argument), argument, 100); index += 1; break;
      case '--live-from-start': options.liveFromStart = true; break;
      case '--playlist': options.initialPlaylist = true; break;
      case '--output':
      case '-o': options.outputDirectory = path.resolve(takeValue(argv, index, argument)); index += 1; break;
      case '--cookies': options.cookiesPath = path.resolve(takeValue(argv, index, argument)); options.cookiesBrowser = ''; index += 1; break;
      case '--cookies-from-browser': options.cookiesBrowser = validateBrowserSpec(takeValue(argv, index, argument), argument); options.cookiesPath = ''; index += 1; break;
      default: throw new Error(`Opsi tidak dikenal: ${argument}`);
    }
  }

  return options;
}

export function isDirectCommand(options = {}) {
  return Boolean(options.dryRun || options.json || options.listFormats || options.formatsJson || options.listSubs);
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
  set('YTCONV_SKIP_PLAYLIST_AFTER_ERRORS', options.skipPlaylistAfterErrors || '');
  set('YTCONV_RETRIES', options.retries);
  set('YTCONV_FRAGMENT_RETRIES', options.fragmentRetries);
  set('YTCONV_FILE_ACCESS_RETRIES', options.fileAccessRetries);
  set('YTCONV_RETRY_SLEEP', options.retrySleep);
  set('YTCONV_BROWSER_COOKIE_SPEC', options.cookiesBrowser);
  set('YTCONV_METADATA_ARTIST', options.metadataArtist);
  set('YTCONV_METADATA_TITLE', options.metadataTitle);
  set('YTCONV_METADATA_ALBUM', options.metadataAlbum);
  set('YTCONV_METADATA_TRACK', options.metadataTrack);
  set('YTCONV_METADATA_YEAR', options.metadataYear);
  set('YTCONV_METADATA_GENRE', options.metadataGenre);
  flag('YTCONV_SUBTITLES', options.subtitles);
  flag('YTCONV_SUBTITLE_ONLY', options.subtitleOnly);
  flag('YTCONV_WRITE_INFO_JSON', options.writeInfoJson);
  flag('YTCONV_WRITE_DESCRIPTION', options.writeDescription);
  flag('YTCONV_WRITE_THUMBNAIL', options.writeThumbnail);
  flag('YTCONV_NORMALIZE_AUDIO', options.normalizeAudio);
  flag('YTCONV_KEEP_VIDEO', options.keepVideo);
  flag('YTCONV_OVERWRITE', options.overwrite);
  flag('YTCONV_RESTRICT_FILENAMES', options.restrictFilenames);
  flag('YTCONV_LIVE_FROM_START', options.liveFromStart);
  flag('YTCONV_RESUME', options.resume);
  flag('YTCONV_CLEANUP_PART', options.cleanupPart);
}

export function helpText() {
  return `YTConv CLI v${CLI_VERSION}\n\n`
    + 'Pemakaian:\n'
    + '  ytconv download LINK [OPSI]\n'
    + '  ytconv playlist LINK [OPSI]\n'
    + '  ytconv batch links.txt [OPSI]\n'
    + '  ytconv info LINK --json\n'
    + '  ytconv formats LINK [--json]\n'
    + '  ytconv [LINK] [OPSI]  (tetap kompatibel)\n\n'
    + 'Playlist, batch, dan koneksi:\n'
    + '  --playlist / --playlist-items ITEMS / --max-downloads N\n'
    + '  --archive FILE / --skip-playlist-after-errors N\n'
    + '  --retries N|infinite / --fragment-retries N|infinite\n'
    + '  --file-access-retries N / --retry-sleep EXPR\n'
    + '  --resume / --no-resume / --cleanup-part\n\n'
    + 'Format dan kualitas:\n'
    + '  --format FMT           Format audio/video umum\n'
    + '  --quality VALUE        Bitrate audio atau resolusi video\n'
    + '  --audio-format FMT     mp3, m4a, aac, opus, vorbis, flac, alac, wav\n'
    + '  --audio-quality RATE   best, 320, 256, 192, 128, 96\n'
    + '  --video-format FMT     auto, mp4, mkv, webm\n'
    + '  --resolution SIZE      best sampai 144p\n\n'
    + 'Metadata, cover, dan subtitle:\n'
    + '  --metadata --thumbnail --metadata-files\n'
    + '  --artist/--title/--album/--track/--year/--genre VALUE\n'
    + '  --subtitles / --subtitle-only / --subtitle-langs LANG\n'
    + '  --start/--end TIME     Alias: --from/--to\n'
    + '  --sponsorblock MODE / --normalize-audio\n\n'
    + 'Cookies dan autentikasi:\n'
    + '  --cookies FILE\n'
    + '  --cookies-from-browser chrome|chromium|edge|firefox|brave[:PROFILE]\n\n'
    + 'File dan performa:\n'
    + '  --concurrent-fragments N / --rate-limit RATE / --proxy URL\n'
    + '  --output-template TPL / --restrict-filenames / --overwrite\n'
    + '  -o, --output PATH / --log-file FILE\n\n'
    + 'Pemeriksaan tanpa download:\n'
    + '  --dry-run / --json / --list-formats / --formats-json / --list-subs\n\n'
    + 'Sistem:\n'
    + '  --diagnose / --check-update / --update / --no-update-check\n'
    + '  -h, --help / -v, --version / -y, --yes\n\n'
    + 'Catatan kualitas: MP3 320 kbps adalah target konversi dan tidak menambah detail yang tidak ada pada sumber.\n\n'
    + 'Preset:\n'
    + `${presetText()}\n`;
}
