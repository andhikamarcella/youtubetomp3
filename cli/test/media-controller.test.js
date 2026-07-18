import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanMediaUrl,
  effectiveMediaMode,
  instagramMediaKind,
} from '../src/media-controller.js';
import {
  detectSocialPlatform,
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

test('detects major social platforms', () => {
  assert.equal(detectSocialPlatform('https://youtu.be/abc'), 'youtube');
  assert.equal(detectSocialPlatform('https://www.facebook.com/reel/123'), 'facebook');
  assert.equal(detectSocialPlatform('https://www.tiktok.com/@u/photo/1'), 'tiktok');
  assert.equal(detectSocialPlatform('https://x.com/user/status/1'), 'x');
  assert.equal(detectSocialPlatform('https://www.pinterest.com/pin/1'), 'pinterest');
});

test('routes Facebook, TikTok, and Reddit by post shape', () => {
  assert.equal(socialRouteMode({ url: 'https://www.facebook.com/reel/123' }), 'video');
  assert.equal(socialRouteMode({ url: 'https://www.facebook.com/photo/123' }), 'image');
  assert.equal(socialRouteMode({ url: 'https://www.tiktok.com/@u/photo/1' }), 'image');
  assert.equal(socialRouteMode({ url: 'https://www.tiktok.com/@u/video/1' }), 'video');
  assert.equal(socialRouteMode({ url: 'https://www.reddit.com/gallery/abc' }), 'image');
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

test('explicit image and video modes override automatic routing', () => {
  const reel = 'https://www.instagram.com/reel/C9HAdlRxSO1/';
  assert.equal(effectiveMediaMode({ url: reel, mode: 'image' }), 'image');
  assert.equal(effectiveMediaMode({ url: reel, mode: 'video' }), 'video');
});
