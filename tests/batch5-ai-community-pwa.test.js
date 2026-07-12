import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.env.PORT = '0';
const mod = await import('../index.js');
const { buildAiModelsResponse, server: startedServer } = mod;
if (startedServer?.unref) startedServer.unref();
after(async () => {
  if (startedServer?.listening) await new Promise((resolve) => startedServer.close(resolve));
});

const server = await readFile(new URL('../index.js', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public-ui/sw.js', import.meta.url), 'utf8');
const home = await readFile(new URL('../public-ui/index.html', import.meta.url), 'utf8');

test('AI models response exposes public modes without requiring provider secrets', () => {
  const payload = buildAiModelsResponse({ advanced: true });
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.modes.map((mode) => mode.id), ['auto', 'fast', 'smart']);
  assert.ok(Array.isArray(payload.providers));
  assert.ok(payload.advanced);
  assert.doesNotMatch(JSON.stringify(payload), /API_KEY|SECRET|Bearer/i);
});

test('server implements forum report/block moderation and filtered broadcasts', () => {
  assert.match(server, /app\.post\('\/api\/forum\/report'/);
  assert.match(server, /app\.post\('\/api\/forum\/block'/);
  assert.match(server, /socket\.on\("forum:report"/);
  assert.match(server, /socket\.on\("forum:blockUser"/);
  assert.match(server, /isForumBlockedBy\(member\.userId, userId\)/);
  assert.match(server, /admin:forumReport/);
});

test('voice signaling requires consent and active call participants', () => {
  assert.match(server, /microphone_consent_required/);
  assert.match(server, /const activeCalls = new Map\(\)/);
  assert.match(server, /activeCalls\.set\(callId/);
  assert.match(server, /endSocketCalls\(socket\.id, "disconnected"\)/);
});

test('PWA service worker has versioned caches, cache reset messages, and sensitive route exclusions', () => {
  assert.match(sw, /const APP_VERSION = 'v4\.0\.1'/);
  assert.match(sw, /ytconv-ui-\$\{APP_VERSION\}/);
  assert.match(sw, /CLEAR_CACHE/);
  assert.match(sw, /SKIP_WAITING/);
  assert.match(sw, /resolveToScopePath\('data-request\.html'\)/);
  assert.match(sw, /resolveToScopePath\('public\/jobs\/'\)/);
});

test('rewards remain isolated behind the rewards route instead of becoming primary converter UI', () => {
  assert.match(home, /data-route-path="\/rewards"/);
  assert.match(home, /body\.route-home #assistantFab/);
  assert.match(server, /"\/rewards"/);
});
