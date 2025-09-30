import { test, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.PORT = process.env.PORT || '0';

const mod = await import('../index.js');
const { server, sanitizeFormatOptions, FORMAT_RULES, buildVideoFormatSelector } = mod;

if (server?.unref) server.unref();

globalThis.__serverRefCount = (globalThis.__serverRefCount || 0) + 1;

after(async () => {
  globalThis.__serverRefCount -= 1;
  if (globalThis.__serverRefCount <= 0 && server?.listening) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('FORMAT_RULES mencakup format audio baru', () => {
  for (const key of ['aac', 'opus', 'aiff']) {
    assert.ok(FORMAT_RULES[key], `FORMAT_RULES harus memiliki entri untuk ${key}`);
  }
  assert.deepEqual(FORMAT_RULES.aac.abr, [320, 256, 192, 128]);
  assert.ok(Array.isArray(FORMAT_RULES.mp4.videoQualities));
});

test('sanitizeFormatOptions merapikan bitrate & sample rate', () => {
  const cleaned = sanitizeFormatOptions('aac', { abr: 999, sampleRate: 12345, speedMode: 'nightcore', videoQuality: '1080' });
  assert.equal(cleaned.abr, 320);
  assert.equal(cleaned.sampleRate, 44100);
  assert.equal(cleaned.speedMode, 'normal');
});

test('sanitizeFormatOptions menetapkan kualitas video default', () => {
  const cleanedVideo = sanitizeFormatOptions('mp4', { abr: null, sampleRate: null, speedMode: 'normal', videoQuality: '1440' });
  assert.equal(cleanedVideo.videoQuality, '1440');
  const fallback = sanitizeFormatOptions('mp4', { abr: null, sampleRate: null, speedMode: 'normal', videoQuality: 'unknown' });
  assert.equal(fallback.videoQuality, 'best');
});

test('buildVideoFormatSelector menghormati batas resolusi', () => {
  const selector = buildVideoFormatSelector('mp4', '1080');
  assert.match(selector, /height<=1080/);
  assert.match(selector, /ext=mp4/);
  const fallback = buildVideoFormatSelector('webm', 'best');
  assert.match(fallback, /bv\*/);
  assert.match(fallback, /ba\[ext=webm\]/);
});
