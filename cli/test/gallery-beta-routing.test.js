import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGalleryDownloadArgs,
  classifyEmptyGalleryResult,
  isGalleryPreferredUrl,
} from '../src/gallery-beta.js';

test('public X and Twitter links prefer yt-dlp while gallery platforms keep gallery-dl', () => {
  assert.equal(isGalleryPreferredUrl('https://x.com/example/status/123'), false);
  assert.equal(isGalleryPreferredUrl('https://mobile.twitter.com/example/status/123'), false);
  assert.equal(isGalleryPreferredUrl('https://www.instagram.com/p/example/'), true);
  assert.equal(isGalleryPreferredUrl('https://www.pinterest.com/pin/123/'), true);
});

test('gallery arguments include archive and cookies without losing the media URL', () => {
  const args = buildGalleryDownloadArgs({
    url: 'https://www.instagram.com/p/example/',
    cookieConfig: { kind: 'file', path: '/tmp/cookies.txt' },
    outputDirectory: '/tmp/output',
    archivePath: '/tmp/gallery.sqlite3',
  });
  assert.deepEqual(args.slice(-3), ['--print', 'file:ytconv-file:{_path}', 'https://www.instagram.com/p/example/']);
  assert.ok(args.includes('--download-archive'));
  assert.ok(args.includes('/tmp/gallery.sqlite3'));
  assert.ok(args.includes('--cookies'));
  assert.ok(args.includes('/tmp/cookies.txt'));
});

test('zero files are successful only when inspection proves archived media exists', () => {
  const archived = classifyEmptyGalleryResult({
    archivePath: '/tmp/gallery.sqlite3',
    inspectedItemCount: 2,
  });
  assert.equal(archived.skipped, true);
  assert.match(archived.reason, /2 item/u);

  const unexplained = classifyEmptyGalleryResult({
    archivePath: '/tmp/gallery.sqlite3',
    inspectedItemCount: 0,
  });
  assert.equal(unexplained.skipped, false);
  assert.match(unexplained.reason, /tidak mengembalikan file/u);

  const loginOnly = classifyEmptyGalleryResult({
    archivePath: '/tmp/gallery.sqlite3',
    inspectedItemCount: 0,
    diagnostic: 'authentication failed: cookies required',
  });
  assert.equal(loginOnly.skipped, false);
  assert.match(loginOnly.reason, /ytconv login PROVIDER/u);
});
