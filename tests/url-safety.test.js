import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicMediaUrl, isPrivateHostname } from '../src/lib/urlSafety.js';

test('url safety blocks localhost/private and unsupported domains', () => {
  assert.equal(isPrivateHostname('127.0.0.1'), true);
  assert.equal(validatePublicMediaUrl('file:///etc/passwd').ok, false);
  assert.equal(validatePublicMediaUrl('https://example.com/video').error, 'unsupported_domain');
  assert.equal(validatePublicMediaUrl('https://youtu.be/dQw4w9WgXcQ').ok, true);
});
