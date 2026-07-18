const PLATFORMS = [
  { key: 'auto', label: 'AUTO', hosts: [] },
  { key: 'youtube', label: 'YouTube', hosts: ['youtube.com', 'youtu.be', 'music.youtube.com'] },
  { key: 'instagram', label: 'Instagram', hosts: ['instagram.com'] },
  { key: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'fb.watch'] },
  { key: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'] },
  { key: 'x', label: 'X / Twitter', hosts: ['x.com', 'twitter.com'] },
  { key: 'pinterest', label: 'Pinterest', hosts: ['pinterest.com', 'pin.it'] },
  { key: 'reddit', label: 'Reddit', hosts: ['reddit.com', 'redd.it'] },
  { key: 'threads', label: 'Threads', hosts: ['threads.net'] },
  { key: 'twitch', label: 'Twitch', hosts: ['twitch.tv'] },
  { key: 'snapchat', label: 'Snapchat', hosts: ['snapchat.com'] },
  { key: 'other', label: 'Sosmed lainnya', hosts: [] },
];

const EXTRA_PLATFORM_HOSTS = [
  ['soundcloud', 'SoundCloud', ['soundcloud.com']],
  ['vimeo', 'Vimeo', ['vimeo.com']],
  ['dailymotion', 'Dailymotion', ['dailymotion.com', 'dai.ly']],
  ['bilibili', 'Bilibili', ['bilibili.com', 'b23.tv']],
  ['tumblr', 'Tumblr', ['tumblr.com']],
  ['telegram', 'Telegram', ['t.me', 'telegram.me']],
  ['linkedin', 'LinkedIn', ['linkedin.com']],
  ['bluesky', 'Bluesky', ['bsky.app']],
  ['imgur', 'Imgur', ['imgur.com']],
  ['flickr', 'Flickr', ['flickr.com']],
  ['deviantart', 'DeviantArt', ['deviantart.com']],
  ['pixiv', 'Pixiv', ['pixiv.net']],
  ['weibo', 'Weibo', ['weibo.com']],
  ['vk', 'VK', ['vk.com']],
  ['mastodon', 'Mastodon', ['mastodon.social']],
  ['kick', 'Kick', ['kick.com']],
  ['rumble', 'Rumble', ['rumble.com']],
  ['streamable', 'Streamable', ['streamable.com']],
  ['9gag', '9GAG', ['9gag.com']],
];

export const SOCIAL_PLATFORM_KEYS = PLATFORMS.map((item) => item.key);

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

export function socialPlatformLabel(key) {
  return PLATFORMS.find((item) => item.key === key)?.label
    || EXTRA_PLATFORM_HOSTS.find(([candidate]) => candidate === key)?.[1]
    || 'Sosmed lainnya';
}

export function detectSocialPlatform(value) {
  const host = normalizedHost(value);
  if (!host) return 'other';

  for (const item of PLATFORMS) {
    if (item.key === 'auto' || item.key === 'other') continue;
    if (item.hosts.some((candidate) => hostMatches(host, candidate))) return item.key;
  }

  for (const [key, , hosts] of EXTRA_PLATFORM_HOSTS) {
    if (hosts.some((candidate) => hostMatches(host, candidate))) return key;
  }

  return 'other';
}

export function validatePlatformHint({ url, platformHint = 'auto' } = {}) {
  const detected = detectSocialPlatform(url);
  if (!platformHint || platformHint === 'auto' || platformHint === 'other') {
    return { detected, valid: true };
  }

  return {
    detected,
    valid: detected === platformHint,
  };
}

export function socialRouteMode({ url, requestedMode = 'auto', platformHint = 'auto' } = {}) {
  if (['video', 'audio', 'image'].includes(requestedMode)) return requestedMode;

  const detected = detectSocialPlatform(url);
  const platform = detected === 'other' && platformHint !== 'auto' ? platformHint : detected;
  let pathname = '';
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return 'auto';
  }

  if (platform === 'instagram') {
    if (/^\/(reel|reels|tv)\//u.test(pathname)) return 'video';
    if (/^\/(p|stories)\//u.test(pathname)) return 'image';
    return 'image';
  }

  if (platform === 'facebook') {
    if (/\/(watch|videos?|reels?)\b/u.test(pathname) || normalizedHost(url) === 'fb.watch') return 'video';
    if (/\/(photo|photos|story|stories)\b/u.test(pathname)) return 'image';
    return 'auto';
  }

  if (platform === 'tiktok') return /\/photo\//u.test(pathname) ? 'image' : 'video';
  if (platform === 'reddit') return /\/gallery\//u.test(pathname) ? 'image' : 'auto';
  if (platform === 'pinterest' || platform === 'threads' || platform === 'tumblr'
    || platform === 'bluesky' || platform === 'imgur' || platform === 'flickr'
    || platform === 'deviantart' || platform === 'pixiv') return 'image';

  if (platform === 'youtube' || platform === 'twitch' || platform === 'snapchat'
    || platform === 'soundcloud' || platform === 'vimeo' || platform === 'dailymotion'
    || platform === 'bilibili' || platform === 'kick' || platform === 'rumble'
    || platform === 'streamable') return 'video';

  return 'auto';
}

export function socialPlatformSummary({ selected = 'auto', url = '' } = {}) {
  const detected = url ? detectSocialPlatform(url) : 'other';
  if (selected && selected !== 'auto') return socialPlatformLabel(selected);
  return detected === 'other' ? 'AUTO semua sosmed' : `${socialPlatformLabel(detected)} terdeteksi`;
}
