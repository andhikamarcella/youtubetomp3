import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveCookieConfigs } from '../src/cookies.js';
import { handleSocialAuthCommand, openOfficialSocialLogin } from '../src/social-auth.js';
import {
  linkSocialSession,
  readSocialSessions,
  socialSessionPaths,
  unlinkSocialSession,
} from '../src/social-sessions.js';

async function temporaryHome(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-social-auth-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}

test('social binding stores only provider and browser reference with private permissions', async (t) => {
  const homeDirectory = await temporaryHome(t);
  await linkSocialSession({ provider: 'instagram', browserSpec: 'edge:Profile 1', homeDirectory });
  const store = await readSocialSessions({ homeDirectory });
  assert.equal(store.providers.instagram.browserSpec, 'edge:Profile 1');
  assert.equal(store.providers.instagram.storage, 'browser-os-encrypted');
  const raw = await fs.readFile(socialSessionPaths(homeDirectory).sessions, 'utf8');
  assert.doesNotMatch(raw, /password|cookie|accessToken|refreshToken/iu);
  const stats = await fs.stat(socialSessionPaths(homeDirectory).sessions);
  if (process.platform !== 'win32') assert.equal(stats.mode & 0o777, 0o600);
});

test('linked Instagram browser is tried automatically after public access', async (t) => {
  const homeDirectory = await temporaryHome(t);
  await linkSocialSession({ provider: 'instagram', browserSpec: 'firefox:default-release', homeDirectory });
  const configs = await resolveCookieConfigs({
    source: 'auto',
    url: 'https://www.instagram.com/p/example/',
    homeDirectory,
    outputDirectory: path.join(homeDirectory, 'output'),
  });
  assert.equal(configs[0].kind, 'none');
  assert.equal(configs[1].linked, true);
  assert.equal(configs[1].spec, 'firefox:default-release');
  assert.match(configs[1].label, /Instagram/u);
});

test('login command opens the official provider page and saves the selected browser', async (t) => {
  const homeDirectory = await temporaryHome(t);
  let opened;
  const result = await handleSocialAuthCommand(
    ['login', 'instagram', '--browser', 'edge', '--no-wait'],
    {
      homeDirectory,
      interactive: false,
      detectBrowsersImpl: async () => ['edge', 'firefox'],
      openLoginImpl: async (value) => {
        opened = value;
        return { opened: true, url: 'https://www.instagram.com/accounts/login/' };
      },
    },
  );
  assert.equal(result.handled, true);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(opened, { provider: 'instagram', browser: 'edge' });
  const store = await readSocialSessions({ homeDirectory });
  assert.equal(store.providers.instagram.browserSpec, 'edge');
});

test('official login opener never receives a user-supplied URL', async () => {
  const calls = [];
  const result = await openOfficialSocialLogin({
    provider: 'x',
    browser: 'firefox',
    spawnImpl: async (command, args) => {
      calls.push({ command, args });
      return true;
    },
  });
  assert.equal(result.opened, true);
  assert.equal(result.url, 'https://x.com/i/flow/login');
  assert.match(calls[0].args.at(-1), /^https:\/\/x\.com\//u);
});

test('unlink removes YTConv browser binding without requiring browser logout', async (t) => {
  const homeDirectory = await temporaryHome(t);
  await linkSocialSession({ provider: 'facebook', browserSpec: 'chrome', homeDirectory });
  await unlinkSocialSession({ provider: 'facebook', homeDirectory });
  const store = await readSocialSessions({ homeDirectory });
  assert.equal(store.providers.facebook, undefined);
});
