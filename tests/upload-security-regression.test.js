import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImageDataUri } from '../src/lib/uploadSecurity.js';

const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('upload inspector rejects executable/html payloads disguised as data URLs', () => {
  const html = Buffer.from('<script>alert(1)</script>').toString('base64');
  const inspected = inspectImageDataUri(`data:image/png;base64,${html}`);
  assert.equal(inspected.ok, false);
  assert.match(inspected.error, /magic|image|mime/i);
});

test('upload inspector enforces configured size limits before Cloudinary upload', () => {
  const inspected = inspectImageDataUri(`data:image/png;base64,${tinyPng}`, { maxBytes: 8 });
  assert.equal(inspected.ok, false);
  assert.match(inspected.error, /too_large|max/i);
});
