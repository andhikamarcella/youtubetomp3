import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { detectBrowserProfileSpecs, resolveCookieConfigs } from '../src/cookies.js';
import {
  beginSocialLoginHandoff,
  confirmSocialLoginHandoff,
  handleSocialAuthCommand,
  isSocialAuthenticationFailure,
  openOfficialSocialLogin,
  recoverSocialLoginInTerminal,
  supportsAutomaticSocialLogin,
} from '../src/social-auth.js';
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
  assert.deepEqual(opened, { provider: 'instagram', browserSpec: 'edge' });
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

test('Windows browser popup opens the exact detected Chromium profile', async () => {
  const calls = [];
  const result = await openOfficialSocialLogin({
    provider: 'instagram',
    browserSpec: 'chrome:Profile 2',
    platform: 'win32',
    termux: false,
    spawnImpl: async (command, args) => {
      calls.push({ command, args });
      return true;
    },
  });
  assert.equal(result.opened, true);
  assert.equal(calls[0].command, 'cmd.exe');
  assert.ok(calls[0].args.includes('chrome.exe'));
  assert.ok(calls[0].args.includes('--profile-directory=Profile 2'));
  assert.equal(calls[0].args.at(-1), 'https://www.instagram.com/accounts/login/');
});

test('official browser handoff is not persisted until the exact retry succeeds', async (t) => {
  const homeDirectory = await temporaryHome(t);
  const opened = [];
  const handoff = await beginSocialLoginHandoff({
    url: 'https://www.instagram.com/p/example/',
    homeDirectory,
    detectBrowsersImpl: async () => ['chrome'],
    detectBrowserProfilesImpl: async () => ['chrome:Profile 2', 'chrome:Default'],
    openLoginImpl: async (value) => {
      opened.push(value);
      return { opened: true, url: 'https://www.instagram.com/accounts/login/' };
    },
  });

  assert.equal(handoff.browserSpec, 'chrome:Profile 2');
  assert.equal(handoff.cookieConfig.spec, 'chrome:Profile 2');
  assert.deepEqual(opened, [{ provider: 'instagram', browserSpec: 'chrome:Profile 2' }]);
  assert.equal((await readSocialSessions({ homeDirectory })).providers.instagram, undefined);

  await confirmSocialLoginHandoff(handoff, { homeDirectory });
  assert.equal((await readSocialSessions({ homeDirectory })).providers.instagram.browserSpec, 'chrome:Profile 2');
});

test('new account handoff prefers Firefox when Chromium cookie encryption may block extraction', async (t) => {
  const homeDirectory = await temporaryHome(t);
  const handoff = await beginSocialLoginHandoff({
    url: 'https://www.instagram.com/reel/example/',
    homeDirectory,
    detectBrowsersImpl: async () => ['chrome', 'edge', 'firefox'],
    detectBrowserProfilesImpl: async () => ['chrome:Default', 'edge:Default', 'firefox:C:\\Profiles\\default-release'],
    openLoginImpl: async () => ({ opened: true, url: 'https://www.instagram.com/accounts/login/' }),
  });
  assert.equal(handoff.browserSpec, 'firefox:C:\\Profiles\\default-release');
  assert.equal(handoff.alternatives[1], 'chrome:Default');
});

test('automatic recovery does not retry a linked Chromium profile before detected Firefox', async (t) => {
  const homeDirectory = await temporaryHome(t);
  await linkSocialSession({ provider: 'instagram', browserSpec: 'chrome:Default', homeDirectory });
  const handoff = await beginSocialLoginHandoff({
    url: 'https://www.instagram.com/reel/example/',
    homeDirectory,
    detectBrowsersImpl: async () => ['chrome', 'firefox'],
    detectBrowserProfilesImpl: async () => ['chrome:Default', 'firefox:C:\\Profiles\\default-release'],
    openLoginImpl: async () => ({ opened: true, url: 'https://www.instagram.com/accounts/login/' }),
  });
  assert.equal(handoff.browserSpec, 'firefox:C:\\Profiles\\default-release');
});

test('authentication failures include Instagram no-format responses but not network failures', () => {
  assert.equal(isSocialAuthenticationFailure(new Error('No video formats found')), true);
  assert.equal(isSocialAuthenticationFailure(new Error('Login required; cookies expired')), true);
  assert.equal(isSocialAuthenticationFailure(new Error('DNS lookup timed out')), false);
  assert.equal(isSocialAuthenticationFailure(new Error('Network timeout. Official Instagram login: ytconv login instagram')), false);
  assert.equal(supportsAutomaticSocialLogin({ platform: 'win32', termux: false }), true);
  assert.equal(supportsAutomaticSocialLogin({ platform: 'linux', termux: true }), false);
});

test('terminal recovery opens official login, retries with that profile, then persists it', async (t) => {
  const homeDirectory = await temporaryHome(t);
  const retrySpecs = [];
  const recovered = await recoverSocialLoginInTerminal({
    url: 'https://www.instagram.com/reel/example/',
    error: new Error('No video formats found'),
    interactive: true,
    homeDirectory,
    waitForConfirmationImpl: async () => {},
    detectBrowsersImpl: async () => ['firefox'],
    detectBrowserProfilesImpl: async () => ['firefox:default-release'],
    openLoginImpl: async () => ({ opened: true, url: 'https://www.instagram.com/accounts/login/' }),
    retry: async (cookieConfig) => {
      retrySpecs.push(cookieConfig.spec);
      return 0;
    },
  });

  assert.equal(recovered.result, 0);
  assert.deepEqual(retrySpecs, ['firefox:default-release']);
  assert.equal((await readSocialSessions({ homeDirectory })).providers.instagram.browserSpec, 'firefox:default-release');
});

test('failed verification never saves an unproven browser session', async (t) => {
  const homeDirectory = await temporaryHome(t);
  await assert.rejects(recoverSocialLoginInTerminal({
    url: 'https://www.instagram.com/p/private/',
    error: new Error('Login required'),
    interactive: true,
    homeDirectory,
    waitForConfirmationImpl: async () => {},
    detectBrowsersImpl: async () => ['edge'],
    detectBrowserProfilesImpl: async () => ['edge:Default'],
    openLoginImpl: async () => ({ opened: true, url: 'https://www.instagram.com/accounts/login/' }),
    retry: async () => { throw new Error('Browser session could not be decrypted'); },
  }), /could not be decrypted/u);
  assert.equal((await readSocialSessions({ homeDirectory })).providers.instagram, undefined);
});

test('browser profile discovery prefers Chromium last-used profile', async (t) => {
  const homeDirectory = await temporaryHome(t);
  const root = path.join(homeDirectory, 'google-chrome');
  await fs.mkdir(path.join(root, 'Default'), { recursive: true });
  await fs.mkdir(path.join(root, 'Profile 2'), { recursive: true });
  await fs.writeFile(path.join(root, 'Local State'), JSON.stringify({
    profile: { last_used: 'Profile 2', info_cache: { Default: {}, 'Profile 2': {} } },
  }));

  const specs = await detectBrowserProfileSpecs({ browsers: ['chrome'], browserRoots: { chrome: [root] } });
  assert.deepEqual(specs.slice(0, 2), ['chrome:Profile 2', 'chrome:Default']);
});

test('unlink removes YTConv browser binding without requiring browser logout', async (t) => {
  const homeDirectory = await temporaryHome(t);
  await linkSocialSession({ provider: 'facebook', browserSpec: 'chrome', homeDirectory });
  await unlinkSocialSession({ provider: 'facebook', homeDirectory });
  const store = await readSocialSessions({ homeDirectory });
  assert.equal(store.providers.facebook, undefined);
});
