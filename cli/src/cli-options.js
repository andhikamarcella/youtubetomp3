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
const RETRY_SLEEP_PREFIX = /^(?:http|fragment|file_access|extractor):/iu;

function takeValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${flag} requires a value.`);
  return value;
}

function validateChoice(value, allowed, flag) {
  const normalized = String(value).toLowerCase();
  if (!allowed.has(normalized)) throw new Error(`${flag} must be one of: ${[...allowed].join(', ')}.`);
  return normalized;
}

function validateText(value, flag, max = 500) {
  const normalized = String(value).trim();
  if (!normalized || normalized.length > max || /[\0\r\n]/u.test(normalized)) {
    throw new Error(`${flag} is invalid or too long.`);
  }
  return normalized;
}

function validateTime(value, flag) {
  const normalized = String(value).trim();
  if (!/^\d+(?::[0-5]\d){0,2}(?:\.\d+)?$/u.test(normalized)) {
    throw new Error(`${flag} must be seconds, MM:SS, or HH:MM:SS.`);
  }
  return normalized;
}

function validateInteger(value, flag, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(number) || String(number) !== String(value) || number < min || number > max) {
    throw new Error(`${flag} must be an integer from ${min} to ${max}.`);
  }
  return number;
}

function validateRetries(value, flag) {
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'infinite') return normalized;
  return String(validateInteger(normalized, flag, { min: 0, max: 1000 }));
}

function validateRetrySleep(value, flag) {
  const normalized = validateText(value, flag, 120).replace(RETRY_SLEEP_PREFIX, '');
  if (!/^(?:\d+(?:\.\d+)?|linear=\d+(?::\d*)?(?::\d*)?|exp=\d+(?::\d*)?(?::\d*)?)$/iu.test(normalized)) {
    throw new Error(`${flag} must be a number, linear=START:END:STEP, or exp=START:END:BASE.`);
  }
  return `http:${normalized}`;
}

function validateRate(value, flag) {
  const normalized = String(value).trim().toUpperCase();
  if (!/^\d+(?:\.\d+)?[KMG]?$/u.test(normalized)) throw new Error(`${flag} must look like 500K, 2M, or 1.5G.`);
  return normalized;
}

function validateProxy(value, flag) {
  const normalized = String(value).trim();
  if (!/^(?:https?|socks4a?|socks5h?):\/\//iu.test(normalized)) {
    throw new Error(`${flag} must be an HTTP(S), SOCKS4, or SOCKS5 proxy URL.`);
  }
  return normalized;
}

function validateTemplate(value, flag) {
  const normalized = validateText(value, flag);
  if (path.isAbsolute(normalized) || normalized.split(/[\\/]+/u).includes('..')) {
    throw new Error(`${flag} must be a relative template inside the output directory.`);
  }
  if (!normalized.includes('%(ext)s')) throw new Error(`${flag} must contain %(ext)s so the output extension is correct.`);
  return normalized;
}

function validatePlaylistItems(value, flag) {
  const normalized = String(value).trim();
  if (!/^[0-9,:-]+$/u.test(normalized)) {
    throw new Error(`${flag} accepts only numbers, commas, colons, and hyphens.`);
  }
  return normalized;
}

function validateBrowserSpec(value, flag) {
  const normalized = validateText(value, flag, 250).toLowerCase();
  const browser = normalized.split(/[+:]/u)[0];
  if (!BROWSERS.has(browser)) throw new Error(`${flag} browser must be one of: ${[...BROWSERS].join(', ')}.`);
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
    retrySleep: 'http:linear=1::2',
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
  throw new Error(`${flag} must be a supported audio or video format.`);
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
  throw new Error(`${flag} must be a supported audio bitrate or video resolution.`);
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
          throw new Error(`Platform "${platform}" is not recognized. Choose: ${SOCIAL_PLATFORM_KEYS.join(', ')}`);
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
      default: throw new Error(`Unknown option: ${argument}`);
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
    + 'Usage:\n'
    + '  ytconv download URL [OPTIONS]\n'
    + '  ytconv playlist URL [OPTIONS]\n'
    + '  ytconv batch links.txt [OPTIONS]\n'
    + '  ytconv info URL --json\n'
    + '  ytconv formats URL [--json]\n'
    + '  ytconv [URL] [OPTIONS]  (legacy-compatible)\n\n'
    + 'Playlist, batch, and reliability:\n'
    + '  --playlist / --playlist-items ITEMS / --max-downloads N\n'
    + '  --archive FILE / --skip-playlist-after-errors N\n'
    + '  --retries N|infinite / --fragment-retries N|infinite\n'
    + '  --file-access-retries N / --retry-sleep EXPR\n'
    + '  --resume / --no-resume / --cleanup-part\n\n'
    + 'Formats and quality:\n'
    + '  --format FORMAT        Generic audio/video format\n'
    + '  --quality VALUE        Audio bitrate or video resolution\n'
    + '  --audio-format FORMAT  mp3, m4a, aac, opus, vorbis, flac, alac, wav\n'
    + '  --audio-quality RATE   best, 320, 256, 192, 128, 96\n'
    + '  --video-format FORMAT  auto, mp4, mkv, webm\n'
    + '  --resolution SIZE      best through 144p\n\n'
    + 'Metadata, cover art, and subtitles:\n'
    + '  --metadata --thumbnail --metadata-files\n'
    + '  --artist/--title/--album/--track/--year/--genre VALUE\n'
    + '  --subtitles / --subtitle-only / --subtitle-langs LANGS\n'
    + '  --start/--end TIME     Aliases: --from/--to\n'
    + '  --sponsorblock MODE / --normalize-audio\n\n'
    + 'Cookies and authentication:\n'
    + '  --cookies FILE\n'
    + '  --cookies-from-browser chrome|chromium|edge|firefox|brave[:PROFILE]\n\n'
    + 'Files and performance:\n'
    + '  --concurrent-fragments N / --rate-limit RATE / --proxy URL\n'
    + '  --output-template TEMPLATE / --restrict-filenames / --overwrite\n'
    + '  -o, --output PATH / --log-file FILE\n\n'
    + 'Inspection without downloading:\n'
    + '  --dry-run / --json / --list-formats / --formats-json / --list-subs\n\n'
    + 'System:\n'
    + '  --diagnose / --check-update / --update / --no-update-check\n'
    + '  -h, --help / -v, --version / -y, --yes\n\n'
    + 'Quality note: MP3 320 kbps is an encoder target and cannot add detail missing from the source.\n\n'
    + 'Presets:\n'
    + `${presetText()}\n`;
}
