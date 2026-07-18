import test from 'node:test';
import assert from 'node:assert/strict';
import {
  automaticFallbackMode,
  cleanMediaUrl,
  effectiveMediaMode,
  instagramMediaKind,
} from '../src/media-controller.js';
import {
  detectSocialPlatform,
  SOCIAL_PLATFORM_KEYS,
  socialRouteMode,
  validatePlatformHint,
} from '../src/social-platforms.js';

test('cleans social tracking parameters without changing the post path', () => {
  assert.equal(
    cleanMediaUrl('https://www.instagram.com/p/C9RnMtaxKoT/?utm_source=ig_web_copy_link&igsh=abc'),
    'https://www.instagram.com/p/C9RnMtaxKoT/',
  );
});

test('routes Instagram post to gallery and Reel to yt-dlp video', () => {
  const post = 'https://www.instagram.com/p/C9RnMtaxKoT/';
  const reel = 'https://www.instagram.com/reel/C9HAdlRxSO1/';
  assert.equal(instagramMediaKind(post), 'post');
  assert.equal(instagramMediaKind(reel), 'video');
  assert.equal(effectiveMediaMode({ url: post, mode: 'auto' }), 'image');
  assert.equal(effectiveMediaMode({ url: reel, mode: 'auto' }), 'video');
});

test('detects major and extended social platforms', () => {
  const cases = [
    ['https://youtu.be/abc', 'youtube'],
    ['https://music.youtube.com/watch?v=abc', 'youtube'],
    ['https://www.facebook.com/reel/123', 'facebook'],
    ['https://www.tiktok.com/@u/photo/1', 'tiktok'],
    ['https://x.com/user/status/1', 'x'],
    ['https://www.pinterest.com/pin/1', 'pinterest'],
    ['https://www.threads.com/@user/post/abc', 'threads'],
    ['https://soundcloud.com/user/track', 'soundcloud'],
    ['https://artist.bandcamp.com/track/song', 'bandcamp'],
    ['https://www.mixcloud.com/user/show/', 'mixcloud'],
    ['https://bsky.app/profile/user/post/abc', 'bluesky'],
    ['https://odysee.com/@channel/video:1', 'odysee'],
  ];

  for (const [url, expected] of cases) {
    assert.equal(detectSocialPlatform(url), expected, url);
    assert.ok(SOCIAL_PLATFORM_KEYS.includes(expected), expected);
  }
});

test('routes Facebook, TikTok, and Reddit by post shape', () => {
  assert.equal(socialRouteMode({ url: 'https://www.facebook.com/reel/123' }), 'video');
  assert.equal(socialRouteMode({ url: 'https://www.facebook.com/photo/123' }), 'image');
  assert.equal(socialRouteMode({ url: 'https://www.tiktok.com/@u/photo/1' }), 'image');
  assert.equal(socialRouteMode({ url: 'https://www.tiktok.com/@u/video/1' }), 'video');
  assert.equal(socialRouteMode({ url: 'https://www.reddit.com/gallery/abc' }), 'image');
  assert.equal(socialRouteMode({ url: 'https://www.reddit.com/r/test/comments/abc/post/' }), 'auto');
});

test('routes music services to audio automatically', () => {
  const urls = [
    'https://music.youtube.com/watch?v=music-id',
    'https://soundcloud.com/user/track',
    'https://artist.bandcamp.com/track/song',
    'https://www.mixcloud.com/user/show/',
  ];
  for (const url of urls) assert.equal(socialRouteMode({ url }), 'audio', url);
  assert.equal(socialRouteMode({ url: 'https://www.youtube.com/watch?v=video-id' }), 'video');
});

test('routes video-first services to video and image-first services to image', () => {
  const videos = [
    'https://www.twitch.tv/videos/123',
    'https://vimeo.com/123',
    'https://www.dailymotion.com/video/abc',
    'https://www.bilibili.com/video/BV123',
    'https://kick.com/channel',
    'https://rumble.com/v123.html',
    'https://streamable.com/abc',
    'https://odysee.com/@channel/video:1',
    'https://www.snapchat.com/spotlight/abc',
  ];
  for (const url of videos) assert.equal(socialRouteMode({ url }), 'video', url);

  const images = [
    'https://www.pinterest.com/pin/123',
    'https://www.tumblr.com/user/123',
    'https://bsky.app/profile/user/post/abc',
    'https://imgur.com/gallery/abc',
    'https://www.flickr.com/photos/user/123',
    'https://www.deviantart.com/user/art/title-123',
    'https://www.pixiv.net/artworks/123',
  ];
  for (const url of images) assert.equal(socialRouteMode({ url }), 'image', url);
});

test('keeps mixed-post services in automatic fallback mode', () => {
  const urls = [
    'https://x.com/user/status/1',
    'https://www.threads.com/@user/post/abc',
    'https://t.me/channel/123',
    'https://www.linkedin.com/posts/user_abc',
    'https://mastodon.social/@user/123',
    'https://weibo.com/123/abc',
    'https://vk.com/wall-1_2',
    'https://9gag.com/gag/abc',
  ];
  for (const url of urls) assert.equal(socialRouteMode({ url }), 'auto', url);
});

test('automatic mode retries the alternate engine but forced modes do not', () => {
  assert.equal(automaticFallbackMode({ requestedMode: 'auto', effectiveMode: 'image' }), 'video');
  assert.equal(automaticFallbackMode({ requestedMode: 'auto', effectiveMode: 'video' }), 'image');
  assert.equal(automaticFallbackMode({ requestedMode: 'auto', effectiveMode: 'auto' }), 'video');
  assert.equal(automaticFallbackMode({ requestedMode: 'auto', effectiveMode: 'audio' }), '');
  assert.equal(automaticFallbackMode({ requestedMode: 'video', effectiveMode: 'video' }), '');
  assert.equal(automaticFallbackMode({ requestedMode: 'image', effectiveMode: 'image' }), '');
});

test('platform hint detects mismatched social links', () => {
  assert.equal(validatePlatformHint({
    url: 'https://www.instagram.com/p/abc/',
    platformHint: 'instagram',
  }).valid, true);
  assert.equal(validatePlatformHint({
    url: 'https://www.instagram.com/p/abc/',
    platformHint: 'facebook',
  }).valid, false);
});

test('explicit image, video, and audio modes override automatic routing', () => {
  const reel = 'https://www.instagram.com/reel/C9HAdlRxSO1/';
  assert.equal(effectiveMediaMode({ url: reel, mode: 'image' }), 'image');
  assert.equal(effectiveMediaMode({ url: reel, mode: 'video' }), 'video');
  assert.equal(effectiveMediaMode({ url: reel, mode: 'audio' }), 'audio');
});
