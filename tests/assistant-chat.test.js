import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { upsertGoogleUser } from '../user_store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
await fsp.rm(DATA_DIR, { recursive: true, force: true });

process.env.PORT = '0';
process.env.ENABLE_CHEATS = 'true';

const mod = await import('../index.js');
const { 
  server,
  buildAssistantResponse,
  initProgress,
  updateProgress,
  clearProgress,
  resolveToolVersions,
  createSessionToken,
  signedPublicDownloadUrl,
  isJobDownloadReady,
} = mod;

if (server?.unref) server.unref();

const resolveAddress = () => {
  const address = server.address();
  if (address && typeof address === 'object' && typeof address.port === 'number') {
    return `http://127.0.0.1:${address.port}`;
  }
  return null;
};

const immediateAddress = resolveAddress();
const baseUrl = immediateAddress ?? await new Promise((resolve) => {
  server.once('listening', () => {
    resolve(resolveAddress() ?? 'http://127.0.0.1:3000');
  });
});

globalThis.__serverRefCount = (globalThis.__serverRefCount || 0) + 1;

after(async () => {
  globalThis.__serverRefCount -= 1;
  if (globalThis.__serverRefCount <= 0 && server?.listening) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('buildAssistantResponse memberikan arahan donasi yang jelas', () => {
  const result = buildAssistantResponse('Bagaimana cara donasi di Saweria 100 ribu?');
  assert.ok(result);
  assert.match(result.reply, /donasi|Saweria/i);
  assert.ok(Array.isArray(result.suggestions));
  assert.ok(result.suggestions.length > 0);
});

test('download helper menyiapkan URL file publik dan status ready yang benar', () => {
  assert.equal(signedPublicDownloadUrl('hasil convert.mp3'), '/public/jobs/hasil%20convert.mp3');
  assert.equal(isJobDownloadReady({ status: 'ready', filename: 'hasil.mp3' }), true);
  assert.equal(isJobDownloadReady({ status: 'completed', filename: 'hasil.mp3' }), true);
  assert.equal(isJobDownloadReady({ status: 'processing', filename: 'hasil.mp3' }), false);
});

test('POST /api/assistant-chat mengembalikan jawaban subtitle', async () => {
  const response = await fetch(`${baseUrl}/api/assistant-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Tolong ambil subtitle bahasa Indonesia dan Inggris' }),
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.match(data.reply, /subtitle|transkrip/i);
  assert.ok(Array.isArray(data.suggestions));
  assert.ok(data.suggestions.length > 0);
});

test('POST /api/assistant-chat menolak prompt kosong', async () => {
  const response = await fetch(`${baseUrl}/api/assistant-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: '   ' }),
  });
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.ok(/prompt/i.test(payload.error || ''));
});

test('POST /api/video-info menolak permintaan tanpa URL atau kata kunci', async () => {
  const response = await fetch(`${baseUrl}/api/video-info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: '  ' }),
  });
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.ok(/tidak valid/i.test(payload.error || ''));
});

test('POST /api/search menolak kata kunci kosong', async () => {
  const response = await fetch(`${baseUrl}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '   ' }),
  });
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.ok(/kosong|valid/i.test(payload.error || ''));
});

test('GET /api/progress/:id mengembalikan status konversi', async () => {
  const progressId = `test-${Date.now()}`;
  initProgress(progressId, { stage: 'metadata', percent: 12, message: 'Metadata siap' });
  updateProgress(progressId, { stage: 'downloading', percent: 42, message: 'Mengunduh' });
  const response = await fetch(`${baseUrl}/api/progress/${progressId}`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.progress.id, progressId);
  assert.equal(Math.round(payload.progress.percent), 42);
  assert.equal(payload.progress.stage, 'downloading');
  clearProgress(progressId);
});

test('GET /api/tool-versions memberikan struktur versi', async () => {
  const response = await fetch(`${baseUrl}/api/tool-versions`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.tools);
  assert.ok('ytDlp' in payload.tools);
  assert.ok('ffmpeg' in payload.tools);
});

test('POST /api/ai-tags mengembalikan genre otomatis', async () => {
  const response = await fetch(`${baseUrl}/api/ai-tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Lo-fi Beats to Relax',
      channel: 'Study Radio',
      duration: 180,
    }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.tags);
  assert.ok(payload.tags.genre);
});

test('resolveToolVersions dapat dipanggil langsung', async () => {
  const data = await resolveToolVersions();
  assert.ok(data);
  assert.ok('ytDlp' in data);
  assert.ok('ffmpeg' in data);
});

test('POST /api/cheats/claim mengembalikan XP rahasia', async () => {
  await upsertGoogleUser({
    googleId: 'cheat-api-user',
    email: 'cheat-api@example.com',
    name: 'Cheat API Tester',
  });
  const token = createSessionToken('cheat-api-user');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const response = await fetch(`${baseUrl}/api/cheats/claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: 'andhikagantengbangetomagadgantengbangetmuachmuach' }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.applied, true);
  assert.equal(payload.xpDelta, 30000);
  assert.equal(payload.user?.id, 'cheat-api-user');

  const duplicate = await fetch(`${baseUrl}/api/cheats/claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: 'andhikagantengbangetomagadgantengbangetmuachmuach' }),
  });
  assert.equal(duplicate.status, 200);
  const dupPayload = await duplicate.json();
  assert.equal(dupPayload.alreadyClaimed, true);
  assert.equal(dupPayload.user?.id, 'cheat-api-user');
});

test('GET /admin/dashboard redirects unauthenticated users to admin login', async () => {
  const response = await fetch(`${baseUrl}/admin/dashboard`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.match(response.headers.get('location') || '', /^\/admin\/login\?next=/);
  assert.equal(response.headers.get('x-request-id')?.length > 0, true);
});

test('GET /api/status returns safe public dependency health', async () => {
  const response = await fetch(`${baseUrl}/api/status`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(['operational', 'degraded', 'maintenance'].includes(payload.status));
  assert.equal(typeof payload.version, 'string');
  assert.ok(payload.services?.api);
  assert.ok(payload.services?.converter);
  const raw = JSON.stringify(payload);
  assert.doesNotMatch(raw, /DATABASE_URL|REDIS_URL|COOKIE|SECRET|api_secret/i);
});

test('GET /api/ai/models exposes safe public model modes', async () => {
  const response = await fetch(`${baseUrl}/api/ai/models?advanced=true`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.modes.map((mode) => mode.id), ['auto', 'fast', 'smart']);
  assert.doesNotMatch(JSON.stringify(payload), /API_KEY|SECRET|Bearer/i);
});

test('POST /api/assistant-chat rejects unavailable technical model names', async () => {
  const response = await fetch(`${baseUrl}/api/assistant-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'halo', model: 'non-existent-model' }),
  });
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.error, 'ai_model_unavailable');
});
