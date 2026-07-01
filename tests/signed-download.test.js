import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignedDownloadToken, verifySignedDownloadToken, safeResolveDownloadPath } from '../src/lib/signedDownload.js';

test('signed download token verifies and expires', () => {
  const token = createSignedDownloadToken({ file: '../song.mp3', secret: 'secret', ttlSeconds: 60, now: 1000 });
  assert.equal(verifySignedDownloadToken({ token, secret: 'secret', now: 2000 }).file, 'song.mp3');
  assert.throws(() => verifySignedDownloadToken({ token, secret: 'secret', now: 120000 }), /expired/);
});

test('download path resolver prevents traversal', () => {
  assert.match(safeResolveDownloadPath('/tmp/out', '../song.mp3'), /song\.mp3$/);
});
