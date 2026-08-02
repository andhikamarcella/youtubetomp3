import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import {
  disposePreparedCookieConfig,
  exportManagedBrowserCookies,
  hasProviderAuthentication,
  managedBrowserLaunchArgs,
  managedBrowserPaths,
  managedBrowserReference,
  serializeNetscapeCookies,
  supportsManagedBrowser,
} from '../src/managed-browser.js';

test('managed login supports Chromium browsers without touching the regular profile', async (t) => {
  const homeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-managed-path-'));
  t.after(() => fs.rm(homeDirectory, { recursive: true, force: true }));
  const paths = managedBrowserPaths({ provider: 'instagram', browserSpec: 'chrome:Default', homeDirectory });
  const args = managedBrowserLaunchArgs({
    userDataDirectory: paths.userDataDirectory,
    url: 'https://www.instagram.com/accounts/login/',
  });

  assert.equal(supportsManagedBrowser('chrome:Default'), true);
  assert.equal(supportsManagedBrowser('firefox:default-release'), false);
  assert.equal(managedBrowserReference('chrome:Profile 2'), 'chrome:YTConv Managed');
  assert.match(paths.userDataDirectory, /\.ytconv[/\\]browser-profiles[/\\]instagram[/\\]chrome$/u);
  assert.ok(args.includes(`--user-data-dir=${paths.userDataDirectory}`));
  assert.ok(args.includes('--remote-debugging-port=0'));
  assert.equal(args.at(-1), 'https://www.instagram.com/accounts/login/');
  assert.ok(!args.some((argument) => argument.includes('Google/Chrome/User Data')));
});

test('provider authentication recognizes real session cookie names', () => {
  assert.equal(hasProviderAuthentication([{ name: 'sessionid' }], 'instagram'), true);
  assert.equal(hasProviderAuthentication([{ name: 'csrftoken' }], 'instagram'), false);
  assert.equal(hasProviderAuthentication([{ name: 'auth_token' }], 'x'), true);
});

test('Netscape export preserves secure session cookies and omits expired rows', () => {
  const future = Math.floor(Date.now() / 1000) + 3600;
  const text = serializeNetscapeCookies([
    { domain: '.instagram.com', path: '/', secure: true, httpOnly: true, expires: future, name: 'sessionid', value: 'secret-value' },
    { domain: '.instagram.com', path: '/', secure: true, expires: 1, name: 'expired', value: 'old' },
  ]);
  assert.match(text, /#HttpOnly_\.instagram\.com\tTRUE\t\/\tTRUE/u);
  assert.match(text, /sessionid\tsecret-value/u);
  assert.doesNotMatch(text, /expired\told/u);
});

test('CDP bridge exports only provider cookies to a private temporary file and deletes it', async (t) => {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  let browserClosed = false;
  await once(server, 'listening');
  t.after(() => server.close());
  server.on('connection', (socket) => {
    socket.once('message', (payload) => {
      const request = JSON.parse(payload.toString());
      if (request.method === 'Browser.close') {
        browserClosed = true;
        socket.send(JSON.stringify({ id: request.id, result: {} }));
        return;
      }
      if (browserClosed) {
        socket.close();
        return;
      }
      socket.send(JSON.stringify({
        id: request.id,
        result: {
          cookies: [
            { domain: '.instagram.com', path: '/', secure: true, httpOnly: true, expires: Date.now() / 1000 + 3600, name: 'sessionid', value: 'provider-secret' },
            { domain: '.example.com', path: '/', secure: true, expires: Date.now() / 1000 + 3600, name: 'unrelated', value: 'must-not-leak' },
          ],
        },
      }));
    });
  });

  const address = server.address();
  const prepared = await exportManagedBrowserCookies({
    session: { webSocketDebuggerUrl: `ws://127.0.0.1:${address.port}` },
    provider: 'instagram',
  });
  const text = await fs.readFile(prepared.path, 'utf8');
  assert.equal(prepared.kind, 'file');
  assert.equal(prepared.temporary, true);
  assert.match(text, /sessionid\tprovider-secret/u);
  assert.doesNotMatch(text, /must-not-leak/u);
  const stats = await fs.stat(prepared.path);
  if (process.platform !== 'win32') assert.equal(stats.mode & 0o777, 0o600);

  await disposePreparedCookieConfig(prepared);
  await assert.rejects(fs.access(prepared.path));
});
