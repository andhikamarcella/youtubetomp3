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

test('YTConv final public release is version 1.2.0', () => {
  assert.equal(manifest.version, '1.2.0');
});

test('release package includes complete docs and native iSH frontend', () => {
  assert.equal(fs.existsSync(path.join(packageRoot, 'ish', 'ytconv.py')), true);
  assert.equal(fs.existsSync(path.join(packageRoot, 'ish', 'VERSION')), true);
  assert.equal(fs.existsSync(path.join(packageRoot, 'scripts', 'install-ish.sh')), true);
  assert.equal(fs.existsSync(path.join(packageRoot, 'CHANGELOG.md')), true);
  assert.equal(fs.existsSync(path.join(packageRoot, 'docs', 'COMMANDS.md')), true);
  assert.equal(fs.existsSync(path.join(packageRoot, 'docs', 'TROUBLESHOOTING.md')), true);
  assert.ok(manifest.files.includes('ish'));
  assert.ok(manifest.files.includes('docs'));
  assert.ok(manifest.files.includes('CHANGELOG.md'));
});

test('FFmpeg static remains optional so Termux can use pkg ffmpeg', () => {
  assert.equal(manifest.optionalDependencies['ffmpeg-static'], '5.3.0');
  assert.equal(manifest.dependencies['ffmpeg-static'], undefined);
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

test('parses platform-first, presets and legacy compatibility modes', () => {
  assert.equal(parseCliOptions(['--platform', 'instagram']).initialPlatform, 'instagram');
  assert.equal(parseCliOptions(['--preset', 'music']).audioFormat, 'mp3');
  assert.equal(parseCliOptions(['--stories']).galleryInclude, 'stories');
  assert.equal(parseCliOptions(['--all-media']).galleryInclude, 'all');
  assert.equal(parseCliOptions(['--video']).forceVideo, true);
  assert.equal(parseCliOptions(['--auto']).forceGallery, false);
});
