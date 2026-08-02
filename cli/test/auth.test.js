import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  authPaths,
  clearAuthSession,
  readAuthSession,
  requireAuthenticatedSession,
  validateAuthSession,
  writeAuthSession,
} from '../src/auth.js';

async function temporaryHome(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-auth-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test('auth session is stored outside config with user-only permissions', async (t) => {
  const homeDirectory = await temporaryHome(t);
  const value = { accessToken: 'secret-token', user: { id: 'u1', email: 'user@example.com' } };
  await writeAuthSession(value, { homeDirectory });
  assert.deepEqual(await readAuthSession({ homeDirectory }), value);
  const stats = await fs.stat(authPaths(homeDirectory).auth);
  if (process.platform !== 'win32') assert.equal(stats.mode & 0o777, 0o600);
  await clearAuthSession({ homeDirectory });
  assert.equal(await readAuthSession({ homeDirectory }), null);
});

test('validateAuthSession refreshes account metadata from the server', async (t) => {
  const homeDirectory = await temporaryHome(t);
  await writeAuthSession({ accessToken: 'valid-token', user: {} }, { homeDirectory });
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.authorization, 'Bearer valid-token');
    return new Response(JSON.stringify({
      tokenId: 'token-id',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: { id: 'user-id', email: 'user@example.com', role: 'user' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await validateAuthSession({ homeDirectory });
  assert.equal(result.ok, true);
  assert.equal(result.session.user.email, 'user@example.com');
  assert.equal(result.session.tokenId, 'token-id');
});

test('media commands cannot continue without login', async (t) => {
  const homeDirectory = await temporaryHome(t);
  await assert.rejects(
    requireAuthenticatedSession({ homeDirectory }),
    /Login is required before downloading or converting media/u,
  );
});
