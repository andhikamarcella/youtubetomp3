import test from 'node:test';
import assert from 'node:assert/strict';
import { createSecurityHeadersMiddleware } from '../src/lib/security.js';

test('production CSP avoids unsafe-eval while keeping required script origins explicit', () => {
  const headers = new Map();
  const res = { setHeader: (key, value) => headers.set(key, value) };
  createSecurityHeadersMiddleware({ NODE_ENV: 'production', FORCE_HTTPS: true, CORS_ORIGINS: [], PUBLIC_BASE_URL: 'https://ytconv.up.railway.app' })({ path: '/' }, res, () => {});
  const csp = headers.get('Content-Security-Policy');
  assert.match(csp, /script-src/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(csp, /challenges\.cloudflare\.com/);
  assert.equal(headers.get('Strict-Transport-Security'), 'max-age=31536000; includeSubDomains');
});
