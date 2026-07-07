import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.env.PORT = '0';
process.env.YTDLP_AUTO_UPDATE = 'false';
const mod = await import('../index.js');
const { server: startedServer } = mod;
if (startedServer?.unref) startedServer.unref();
if (!startedServer.listening) await new Promise((resolve) => startedServer.once('listening', resolve));
after(async () => {
  if (startedServer?.listening) await new Promise((resolve) => startedServer.close(resolve));
});
const baseUrl = `http://127.0.0.1:${startedServer.address().port}`;
const serverSource = await readFile(new URL('../index.js', import.meta.url), 'utf8');

test('admin state-changing endpoints reject unauthenticated or missing-CSRF requests', async () => {
  const queueClear = await fetch(`${baseUrl}/api/admin/queue/clear`, { method: 'POST' });
  assert.ok([401, 403].includes(queueClear.status));
  const cookieTest = await fetch(`${baseUrl}/api/admin/cookies/test`, { method: 'POST' });
  assert.ok([401, 403].includes(cookieTest.status));
  const adminControl = await fetch(`${baseUrl}/api/admin/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'noop' }),
  });
  assert.ok([401, 403].includes(adminControl.status));
});

test('protected health and admin metrics do not allow anonymous access', async () => {
  const fullHealth = await fetch(`${baseUrl}/api/health/full`);
  assert.ok([401, 403].includes(fullHealth.status));
  const metrics = await fetch(`${baseUrl}/api/admin/metrics`);
  assert.ok([401, 403].includes(metrics.status));
});

test('sensitive upload and AI endpoints are rate-limited or guarded by route-specific middleware', () => {
  assert.match(serverSource, /app\.post\("\/api\/cloudinary\/signature", uploadRateLimiter/);
  assert.match(serverSource, /app\.post\("\/api\/upload-forum-image", uploadRateLimiter/);
  assert.match(serverSource, /app\.get\("\/api\/ai\/models", aiRateLimiter/);
  assert.match(serverSource, /app\.post\("\/api\/assistant-chat", aiRateLimiter/);
  assert.match(serverSource, /verifyTurnstileToken/);
});
