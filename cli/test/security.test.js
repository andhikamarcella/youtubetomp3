import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { nodeRuntimeSupported } from '../src/dependencies.js';
import { managedBrowserLaunchArgs } from '../src/managed-browser.js';
import {
  privateChildEnvironment,
  sanitizeTerminalText,
  scrubChildEnvironment,
  styleError,
} from '../src/terminal-style.js';
import { releaseAssetDigest, verifyReleaseAssetBuffer } from '../src/verified-download.js';
import { terminalLayout } from '../src/ui.js';

test('terminal output removes ANSI, OSC, controls, and bidi overrides', () => {
  const unsafe = '\u001b[32mgreen\u001b[0m\u001b]8;;https://evil.invalid\u0007link\u001b]8;;\u0007\u202Etxt\u0000';
  assert.equal(sanitizeTerminalText(unsafe), 'greenlinktxt');
  assert.equal(styleError(unsafe, { stream: { isTTY: false }, env: {} }), 'greenlinktxt');
});

test('every child environment removes package repository cloud and generic credentials', () => {
  const input = {
    PATH: '/bin', HOME: '/home/test', LANG: 'C.UTF-8',
    NPM_TOKEN: 'secret', GH_TOKEN: 'secret', GITHUB_TOKEN: 'secret', NODE_AUTH_TOKEN: 'secret',
    AWS_ACCESS_KEY_ID: 'secret', AZURE_CLIENT_SECRET: 'secret', GOOGLE_APPLICATION_CREDENTIALS: '/secret.json',
    SERVICE_PASSWORD: 'secret', API_KEY: 'secret', SESSION_COOKIE: 'secret', SSH_AUTH_SOCK: '/tmp/agent',
  };
  for (const result of [scrubChildEnvironment(input), privateChildEnvironment(input)]) {
    assert.equal(result.PATH, '/bin');
    assert.equal(result.HOME, '/home/test');
    assert.equal(result.LANG, 'C.UTF-8');
    assert.equal(result.NO_COLOR, '1');
    assert.equal(result.FORCE_COLOR, '0');
    for (const name of Object.keys(input).filter((name) => !['PATH', 'HOME', 'LANG'].includes(name))) {
      assert.equal(result[name], undefined, name);
    }
  }
});

test('managed Chromium bridge is loopback-only and isolates background features', () => {
  const args = managedBrowserLaunchArgs({ userDataDirectory: '/tmp/profile', url: 'https://www.instagram.com/' });
  assert.ok(args.includes('--remote-debugging-address=127.0.0.1'));
  assert.ok(args.includes('--remote-debugging-port=0'));
  assert.ok(args.includes('--disable-extensions'));
  assert.ok(args.includes('--disable-sync'));
});

test('release assets require an exact SHA-256 digest and declared size', () => {
  const data = Buffer.from('verified-engine');
  const digest = createHash('sha256').update(data).digest('hex');
  const asset = { name: 'engine', size: data.length, digest: `sha256:${digest}` };
  assert.equal(releaseAssetDigest(asset), digest);
  assert.equal(verifyReleaseAssetBuffer(data, asset).sha256, digest);
  assert.throws(() => verifyReleaseAssetBuffer(Buffer.from('modified-engine'), asset), /size mismatch|SHA-256/u);
  assert.throws(() => releaseAssetDigest({ name: 'engine' }), /did not provide a SHA-256/u);
});

test('terminal layout reduces decoration while remaining inside small screens', () => {
  const desktop = terminalLayout(120, 40);
  assert.equal(desktop.compactLogo, false);
  assert.equal(desktop.tinyLogo, false);
  assert.equal(desktop.showShortcuts, true);
  assert.ok(desktop.panelWidth <= 118);

  const narrow = terminalLayout(32, 12);
  assert.equal(narrow.compactLogo, true);
  assert.equal(narrow.tinyLogo, true);
  assert.equal(narrow.showShortcuts, false);
  assert.equal(narrow.showDetails, false);
  assert.ok(narrow.panelWidth <= 30);
});

test('Node support excludes EOL-era runtime baselines', () => {
  assert.equal(nodeRuntimeSupported('20.19.0'), false);
  assert.equal(nodeRuntimeSupported('22.13.1'), false);
  assert.equal(nodeRuntimeSupported('22.14.0'), true);
  assert.equal(nodeRuntimeSupported('24.0.0'), true);
});
