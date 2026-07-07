import test, { after } from 'node:test';
import assert from 'node:assert/strict';

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

async function expectRoute(path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
  assert.equal(response.status, expectedStatus, `${path} status`);
  assert.ok(response.headers.get('x-request-id'), `${path} x-request-id`);
  return response;
}

test('smoke: public and PWA routes render after refresh-like direct requests', async () => {
  for (const path of ['/', '/studio', '/history', '/assistant', '/community', '/support', '/status', '/account', '/rewards', '/privacy', '/terms', '/cookies', '/copyright', '/data-request', '/community-guidelines', '/manifest.json', '/robots.txt', '/sitemap.xml', '/offline.html']) {
    await expectRoute(path);
  }
});

test('smoke: admin route is protected and health is safe', async () => {
  await expectRoute('/admin/dashboard', 302);
  const health = await expectRoute('/api/health');
  const payload = await health.json();
  assert.equal(payload.ok, true);
  assert.doesNotMatch(JSON.stringify(payload), /DATABASE_URL|SECRET|COOKIE|TOKEN/i);
});
