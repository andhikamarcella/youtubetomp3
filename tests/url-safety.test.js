import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicMediaUrl, validatePublicMediaUrlDeep, resolvePublicHostname, isPrivateHostname } from '../src/lib/urlSafety.js';

test('url safety blocks localhost/private and unsupported domains', () => {
  assert.equal(isPrivateHostname('127.0.0.1'), true);
  assert.equal(validatePublicMediaUrl('file:///etc/passwd').ok, false);
  assert.equal(validatePublicMediaUrl('https://example.com/video').error, 'unsupported_domain');
  assert.equal(validatePublicMediaUrl('https://youtu.be/dQw4w9WgXcQ').ok, true);
});


test('deep URL safety blocks private IP DNS targets and non-HTTPS URLs', async () => {
  assert.equal(validatePublicMediaUrl('http://youtu.be/dQw4w9WgXcQ').error, 'protocol_blocked');
  const privateIp = await resolvePublicHostname('127.0.0.1');
  assert.equal(privateIp.ok, false);
  assert.equal(privateIp.error, 'private_url_blocked');
  const deep = await validatePublicMediaUrlDeep('https://127.0.0.1/watch?v=x');
  assert.equal(deep.ok, false);
});
