import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv, safeEnvDiagnostics } from '../src/lib/env.js';

test('env loader applies safe defaults and redacts diagnostics', () => {
  const { env } = loadEnv({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://user:pass@example/db', PUBLIC_BASE_URL: 'https://yt.example' });
  assert.equal(env.APP_VERSION, 'v4.0.0');
  assert.equal(env.PUBLIC_BASE_URL, 'https://yt.example');
  assert.match(safeEnvDiagnostics(env).databaseUrl, /\*\*\*/);
});

test('production env reports missing critical secrets', () => {
  const { missing } = loadEnv({ NODE_ENV: 'production', PUBLIC_BASE_URL: 'https://yt.example', SIGNED_DOWNLOADS: 'true' });
  assert.ok(missing.includes('ADMIN_BEARER'));
  assert.ok(missing.includes('DOWNLOAD_TOKEN_SECRET'));
});
