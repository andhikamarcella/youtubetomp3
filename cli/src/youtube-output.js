const VIDEO_CONTAINERS = new Set(['auto', 'mp4', 'mkv', 'webm']);
const MEDIA_MODES = new Set(['auto', 'audio', 'video', 'image']);

function normalizedHost(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./u, '');
  } catch {
    return '';
  }
}

function hostMatches(host, candidate) {
  return host === candidate || host.endsWith(`.${candidate}`);
}

export function isYouTubeUrl(value) {
  const host = normalizedHost(value);
  return ['youtube.com', 'youtu.be', 'youtube-nocookie.com']
    .some((candidate) => hostMatches(host, candidate));
}

export function isYouTubeMusicUrl(value) {
  return normalizedHost(value) === 'music.youtube.com';
}

export function effectiveVideoContainer({
  url = '',
  mode = 'video',
  requestedContainer = 'auto',
} = {}) {
  const requested = VIDEO_CONTAINERS.has(String(requestedContainer).toLowerCase())
    ? String(requestedContainer).toLowerCase()
    : 'auto';
  if (requested !== 'auto') return requested;
  if (mode === 'video' && isYouTubeUrl(url)) return 'mp4';
  return 'auto';
}

export function resolveYouTubeOutputPolicy({
  url = '',
  requestedMode = 'auto',
  requestedVideoFormat = 'auto',
} = {}) {
  const normalizedMode = MEDIA_MODES.has(String(requestedMode).toLowerCase())
    ? String(requestedMode).toLowerCase()
    : 'auto';
  let mode = normalizedMode;
  if (mode === 'auto') {
    if (isYouTubeMusicUrl(url)) mode = 'audio';
    else if (isYouTubeUrl(url)) mode = 'video';
  }
  const videoFormat = effectiveVideoContainer({
    url,
    mode,
    requestedContainer: requestedVideoFormat,
  });
  return { mode, videoFormat };
}

function heightFilter(resolution) {
  return resolution === 'best' ? '' : `[height<=${resolution}]`;
}

export function formatVideoSelector(resolution = 'best', container = 'auto') {
  const limit = heightFilter(resolution);
  const separateAny = `bv${limit}+ba`;
  const broadSeparateAny = `bv*${limit}+ba`;
  const combinedAny = `b${limit}`;

  if (container === 'mp4' || container === 'auto') {
    return [
      `bv${limit}[ext=mp4][vcodec^=avc1]+ba[ext=m4a]`,
      `b${limit}[ext=mp4][vcodec^=avc1]`,
      `bv${limit}[ext=mp4]+ba[ext=m4a]`,
      `b${limit}[ext=mp4]`,
      separateAny,
      broadSeparateAny,
      combinedAny,
    ].join('/');
  }

  if (container === 'webm') {
    return [
      `bv${limit}[ext=webm]+ba[ext=webm]`,
      `b${limit}[ext=webm]`,
      separateAny,
      broadSeparateAny,
      combinedAny,
    ].join('/');
  }

  return [separateAny, broadSeparateAny, combinedAny].join('/');
}

export function videoContainerArgs(container = 'auto') {
  if (container === 'mp4') {
    return ['--merge-output-format', 'mp4', '--recode-video', 'mp4'];
  }
  if (container === 'mkv') {
    return ['--merge-output-format', 'mkv', '--remux-video', 'mkv'];
  }
  if (container === 'webm') {
    return ['--merge-output-format', 'webm', '--recode-video', 'webm'];
  }
  return ['--merge-output-format', 'mp4/mkv'];
}
