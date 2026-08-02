const PLATFORMS = [
  { key: 'auto', label: 'AUTO', hosts: [] },
  {
    key: 'youtube',
    label: 'YouTube',
    hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
  },
  { key: 'instagram', label: 'Instagram', hosts: ['instagram.com', 'instagr.am'] },
  { key: 'facebook', label: 'Facebook', hosts: ['facebook.com', 'fb.watch'] },
  { key: 'tiktok', label: 'TikTok', hosts: ['tiktok.com'] },
  { key: 'x', label: 'X / Twitter', hosts: ['x.com', 'twitter.com'] },
  { key: 'pinterest', label: 'Pinterest', hosts: ['pinterest.com', 'pin.it'] },
  { key: 'reddit', label: 'Reddit', hosts: ['reddit.com', 'redd.it'] },
  { key: 'threads', label: 'Threads', hosts: ['threads.com', 'threads.net'] },
  { key: 'twitch', label: 'Twitch', hosts: ['twitch.tv'] },
  { key: 'snapchat', label: 'Snapchat', hosts: ['snapchat.com'] },
  { key: 'other', label: 'Sosmed lainnya', hosts: [] },
];

const EXTRA_PLATFORM_HOSTS = [
  ['soundcloud', 'SoundCloud', ['soundcloud.com']],
  ['bandcamp', 'Bandcamp', ['bandcamp.com']],
  ['mixcloud', 'Mixcloud', ['mixcloud.com']],
  ['vimeo', 'Vimeo', ['vimeo.com']],
  ['dailymotion', 'Dailymotion', ['dailymotion.com', 'dai.ly']],
  ['bilibili', 'Bilibili', ['bilibili.com', 'b23.tv']],
  ['tumblr', 'Tumblr', ['tumblr.com']],
  ['telegram', 'Telegram', ['t.me', 'telegram.me']],
  ['linkedin', 'LinkedIn', ['linkedin.com']],
  ['bluesky', 'Bluesky', ['bsky.app']],
  ['imgur', 'Imgur', ['imgur.com']],
  ['flickr', 'Flickr', ['flickr.com', 'flic.kr']],
  ['deviantart', 'DeviantArt', ['deviantart.com', 'fav.me']],
  ['pixiv', 'Pixiv', ['pixiv.net']],
  ['weibo', 'Weibo', ['weibo.com', 'weibo.cn']],
  ['vk', 'VK', ['vk.com']],
  ['mastodon', 'Mastodon', ['mastodon.social', 'mastodon.online', 'mstdn.social', 'fosstodon.org']],
  ['kick', 'Kick', ['kick.com']],
  ['rumble', 'Rumble', ['rumble.com']],
  ['streamable', 'Streamable', ['streamable.com']],
  ['odysee', 'Odysee', ['odysee.com']],
  ['9gag', '9GAG', ['9gag.com']],
];

export const SOCIAL_PLATFORM_KEYS = [
  ...new Set([
    ...PLATFORMS.map((item) => item.key),
    ...EXTRA_PLATFORM_HOSTS.map(([key]) => key),
  ]),
];

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
  let host = '';
  try {
    const parsed = new URL(url);
    pathname = parsed.pathname.toLowerCase();
    host = parsed.hostname.toLowerCase().replace(/^www\./u, '');
  } catch {
    return 'auto';
  }

  if (platform === 'youtube') {
    return host === 'music.youtube.com' ? 'audio' : 'video';
  }

  if (platform === 'instagram') {
    if (/^\/(reel|reels|tv)\//u.test(pathname)) return 'video';
    if (/^\/(p|stories)\//u.test(pathname)) return 'image';
    return 'image';
  }

  if (platform === 'facebook') {
    if (/\/(watch|videos?|reels?)\b/u.test(pathname) || host === 'fb.watch') return 'video';
    if (/\/(photo|photos|story|stories)\b/u.test(pathname)) return 'image';
    return 'auto';
  }

  if (platform === 'tiktok') return /\/photo\//u.test(pathname) ? 'image' : 'video';
  if (platform === 'reddit') return /\/gallery\//u.test(pathname) ? 'image' : 'auto';

  if (platform === 'soundcloud' || platform === 'bandcamp' || platform === 'mixcloud') {
    return 'audio';
  }

  if (platform === 'pinterest' || platform === 'tumblr' || platform === 'bluesky'
    || platform === 'imgur' || platform === 'flickr' || platform === 'deviantart'
    || platform === 'pixiv') return 'image';

  if (platform === 'twitch' || platform === 'snapchat' || platform === 'vimeo'
    || platform === 'dailymotion' || platform === 'bilibili' || platform === 'kick'
    || platform === 'rumble' || platform === 'streamable' || platform === 'odysee') {
    return 'video';
  }

  // X, Threads, Telegram, LinkedIn, Mastodon, Weibo, VK, and 9GAG can contain
  // images, video, or mixed posts. AUTO lets yt-dlp/gallery-dl use their fallback.
  return 'auto';
}

export function socialPlatformSummary({ selected = 'auto', url = '' } = {}) {
  const detected = url ? detectSocialPlatform(url) : 'other';
  if (selected && selected !== 'auto') return socialPlatformLabel(selected);
  return detected === 'other' ? 'AUTO semua sosmed' : `${socialPlatformLabel(detected)} terdeteksi`;
}
