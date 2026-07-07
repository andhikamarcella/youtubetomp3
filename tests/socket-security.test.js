import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const server = await readFile(new URL('../index.js', import.meta.url), 'utf8');

test('admin Socket.IO streams require admin session and CSRF handshake', () => {
  assert.match(server, /function isAdminSocketHandshake\(socket\)|const isAdminSocketHandshake = \(socket\) =>/);
  assert.match(server, /verifyAdminSession\(cookies\[ADMIN_SESSION_COOKIE\]\)/);
  assert.match(server, /verifyAdminCsrf\(csrfToken\)/);
  assert.match(server, /socket\.join\("admin"\)/);
});

test('public Socket.IO forum and voice events have per-event rate guards and authorization state', () => {
  for (const eventName of ['forum:join', 'forum:chatMessage', 'forum:report', 'forum:blockUser', 'call:offer', 'call:answer', 'call:ice', 'call:end']) {
    assert.match(server, new RegExp(`socket\\.on\\("${eventName.replace(':', ':')}`));
  }
  assert.match(server, /allowSocketEvent\(socket, "forum:chatMessage"/);
  assert.match(server, /const from = socketState\.get\(socket\.id\)/);
  assert.match(server, /microphone_consent_required/);
  assert.match(server, /activeCalls\.get\(callId\)/);
});
