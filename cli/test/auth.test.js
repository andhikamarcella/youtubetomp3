import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  applyAuthEnvironment,
  authPaths,
  clearAuthSession,
  login,
  loginLocally,
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

test('legacy explicit account requirement still reports a clear login command', async (t) => {
  const homeDirectory = await temporaryHome(t);
  await assert.rejects(
    requireAuthenticatedSession({ homeDirectory }),
    /A YTConv profile is required before downloading or converting media/u,
  );
});

test('CLI wrapper no longer blocks public commands behind the cloud account server', async (t) => {
  const homeDirectory = await temporaryHome(t);
  const entry = fileURLToPath(new URL('../bin/ytconv-auth.js', import.meta.url));
  const result = spawnSync(process.execPath, [entry, '--version'], {
    encoding: 'utf8',
    env: { ...process.env, HOME: homeDirectory, USERPROFILE: homeDirectory, YTCONV_NO_UPDATE_CHECK: '1' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '1.5.7');
});

test('local fallback profile validates without a cloud request', async (t) => {
  const homeDirectory = await temporaryHome(t);
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => { throw new Error('cloud request must not run'); };
  const result = await loginLocally({
    version: '1.5.7',
    homeDirectory,
    localName: 'Local Tester',
  });
  assert.equal(result.session.mode, 'local');
  assert.equal(result.session.user.displayName, 'Local Tester');
  const validated = await validateAuthSession({ homeDirectory });
  assert.equal(validated.ok, true);
  assert.equal(validated.offline, true);
});

test('login falls back locally when the cloud endpoint is not deployed', async (t) => {
  const homeDirectory = await temporaryHome(t);
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response('Not Found', { status: 404 });
  const result = await login({
    version: '1.5.7',
    homeDirectory,
    localName: 'Fallback Tester',
  });
  assert.equal(result.mode, 'local');
  assert.equal(result.session.user.displayName, 'Fallback Tester');
});

test('auth environment exposes account label and mode without leaking through arguments', () => {
  const env = {};
  applyAuthEnvironment({
    mode: 'local',
    accessToken: 'local:test',
    user: { id: 'local-user', displayName: 'Dhika' },
  }, env);
  assert.equal(env.YTCONV_AUTH_MODE, 'local');
  assert.equal(env.YTCONV_ACCOUNT_LABEL, 'Dhika');
  assert.equal(env.YTCONV_USER_ID, 'local-user');
});
