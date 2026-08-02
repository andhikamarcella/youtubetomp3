import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGalleryDownloadArgs } from '../src/gallery-beta.js';

test('gallery beta uses canonical print option and separate archive', () => {
  const args = buildGalleryDownloadArgs({
    url: 'https://example.com/post',
    cookieConfig: { kind: 'none' },
    outputDirectory: '/tmp/output',
    archivePath: '/tmp/archive.sqlite3',
  });
  assert.ok(args.includes('--download-archive'));
  assert.equal(args[args.indexOf('--download-archive') + 1], '/tmp/archive.sqlite3');
  assert.ok(args.includes('--print'));
  assert.equal(args.includes('--Print'), false);
  assert.equal(args.at(-1), 'https://example.com/post');
});

test('gallery beta omits archive when disabled', () => {
  const args = buildGalleryDownloadArgs({
    url: 'https://example.com/post',
    cookieConfig: { kind: 'none' },
    outputDirectory: '/tmp/output',
    archivePath: '',
  });
  assert.equal(args.includes('--download-archive'), false);
});
