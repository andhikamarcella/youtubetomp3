import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isGalleryPreferredUrl } from '../src/gallery.js';
import { parseCliOptions } from '../src/cli-options.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(directory, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

test('YTConv public release is version 1.1.2', () => {
  assert.equal(manifest.version, '1.1.2');
});

test('FFmpeg static is optional so Termux can use pkg ffmpeg', () => {
  assert.equal(manifest.optionalDependencies['ffmpeg-static'], '5.3.0');
  assert.equal(manifest.dependencies['ffmpeg-static'], undefined);
});

test('native iSH frontend and installer are included in the package source', () => {
  assert.equal(fs.existsSync(path.join(packageRoot, 'ish', 'ytconv.py')), true);
  assert.equal(fs.existsSync(path.join(packageRoot, 'ish', 'VERSION')), true);
  assert.equal(fs.existsSync(path.join(packageRoot, 'scripts', 'install-ish.sh')), true);
  assert.ok(manifest.files.includes('ish'));
});

test('gallery engine recognizes social image and mixed-post sites', () => {
  const urls = [
    'https://www.instagram.com/p/ABC123/',
    'https://www.instagram.com/stories/example/123/',
    'https://www.pinterest.com/pin/123/',
    'https://www.tiktok.com/@user/photo/123',
    'https://x.com/user/status/123',
    'https://www.reddit.com/gallery/123',
  ];
  for (const url of urls) assert.equal(isGalleryPreferredUrl(url), true, url);
  assert.equal(isGalleryPreferredUrl('https://www.youtube.com/watch?v=test'), false);
});

test('parses platform-first and legacy compatibility modes', () => {
  assert.equal(parseCliOptions(['--platform', 'instagram']).initialPlatform, 'instagram');
  assert.equal(parseCliOptions(['--stories']).galleryInclude, 'stories');
  assert.equal(parseCliOptions(['--all-media']).galleryInclude, 'all');
  assert.equal(parseCliOptions(['--video']).forceVideo, true);
  assert.equal(parseCliOptions(['--auto']).forceGallery, false);
  assert.equal(parseCliOptions(['--auto']).initialMode, 'auto');
});
