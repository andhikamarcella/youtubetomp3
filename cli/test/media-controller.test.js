import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanMediaUrl,
  effectiveMediaMode,
  instagramMediaKind,
} from '../src/media-controller.js';

test('cleans Instagram tracking parameters without changing the post path', () => {
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

test('explicit image and video modes override auto routing', () => {
  const reel = 'https://www.instagram.com/reel/C9HAdlRxSO1/';
  assert.equal(effectiveMediaMode({ url: reel, mode: 'image' }), 'image');
  assert.equal(effectiveMediaMode({ url: reel, mode: 'video' }), 'video');
});
