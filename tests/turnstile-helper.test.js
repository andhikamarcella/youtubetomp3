import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyTurnstile } from '../src/lib/turnstile.js';

test('turnstile strict mode requires token', async () => {
  const result = await verifyTurnstile({ secretKey: 'secret', strict: true });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'turnstile_required');
});

test('turnstile accepts successful siteverify response', async () => {
  const result = await verifyTurnstile({ token: 'token', secretKey: 'secret', strict: true, fetchImpl: async () => ({ json: async () => ({ success: true }) }) });
  assert.equal(result.ok, true);
});
