import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import {
  closeManagedBrowserSession,
  disposePreparedCookieConfig,
  exportManagedBrowserCookies,
  launchManagedBrowserSession,
} from '../src/managed-browser.js';

const executable = process.env.YTCONV_TEST_BROWSER;
if (!executable) throw new Error('YTCONV_TEST_BROWSER must point to a Chromium browser executable.');

const homeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-browser-smoke-'));
const server = http.createServer((request, response) => {
  response.setHeader('Set-Cookie', 'ytconv_bridge=verified; Path=/; SameSite=Lax');
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.end('YTConv browser bridge smoke test');
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();

let session;
let prepared;
try {
  session = await launchManagedBrowserSession({
    provider: 'instagram',
    browserSpec: 'chrome',
    url: `http://127.0.0.1:${address.port}/`,
    homeDirectory,
    executable,
    headless: true,
  });

  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      prepared = await exportManagedBrowserCookies({
        session,
        provider: 'instagram',
        domains: ['127.0.0.1'],
        requireAuthentication: false,
      });
      const text = await fs.readFile(prepared.path, 'utf8');
      if (text.includes('\tytconv_bridge\tverified')) break;
      await disposePreparedCookieConfig(prepared);
      prepared = null;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!prepared) throw lastError || new Error('The real browser did not expose its test cookie.');
  const cookiePath = prepared.path;
  await disposePreparedCookieConfig(prepared);
  prepared = null;
  try {
    await fs.access(cookiePath);
    throw new Error('The temporary browser cookie file was not deleted.');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  console.log('Real managed-browser bridge: verified and temporary cookie file deleted.');
} finally {
  await disposePreparedCookieConfig(prepared);
  await closeManagedBrowserSession(session);
  server.close();
  await fs.rm(homeDirectory, { recursive: true, force: true });
}
