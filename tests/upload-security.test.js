import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImageDataUri } from '../src/lib/uploadSecurity.js';

const oneByOnePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

test('inspectImageDataUri accepts real PNG magic bytes', () => {
  const result = inspectImageDataUri(oneByOnePng, { maxBytes: 1024 });
  assert.equal(result.ok, true);
  assert.equal(result.mime, 'image/png');
  assert.equal(result.width, 1);
  assert.equal(result.height, 1);
});

test('inspectImageDataUri rejects MIME spoofing and SVG/script payloads', () => {
  const spoofed = `data:image/png;base64,${Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64')}`;
  assert.equal(inspectImageDataUri(spoofed).ok, false);
  assert.equal(inspectImageDataUri(spoofed).error, 'unsupported_image_type');
});
