import { test, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.PORT = '0';

const mod = await import('../index.js');
const { server, buildAssistantResponse } = mod;

const address = server.address();
const baseUrl = typeof address === 'object' && address
  ? `http://127.0.0.1:${address.port}`
  : 'http://127.0.0.1:3000';

after(() => {
  server.close();
});

test('buildAssistantResponse memberikan arahan donasi yang jelas', () => {
  const result = buildAssistantResponse('Bagaimana cara donasi di Saweria 100 ribu?');
  assert.ok(result);
  assert.match(result.reply, /donasi|Saweria/i);
  assert.ok(Array.isArray(result.suggestions));
  assert.ok(result.suggestions.length > 0);
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
