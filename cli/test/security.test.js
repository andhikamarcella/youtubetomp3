import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { nodeRuntimeSupported } from '../src/dependencies.js';
import { managedBrowserLaunchArgs } from '../src/managed-browser.js';
import {
  privateChildEnvironment,
  sanitizeTerminalText,
  styleError,
} from '../src/terminal-style.js';
import { releaseAssetDigest, verifyReleaseAssetBuffer } from '../src/verified-download.js';
import { terminalLayout } from '../src/ui.js';

test('terminal output removes ANSI, OSC, controls, and bidi overrides', () => {
  const unsafe = '\u001b[32mgreen\u001b[0m\u001b]8;;https://evil.invalid\u0007link\u001b]8;;\u0007\u202Etxt\u0000';
  assert.equal(sanitizeTerminalText(unsafe), 'greenlinktxt');
  assert.equal(styleError(unsafe, { stream: { isTTY: false }, env: {} }), 'greenlinktxt');
});

test('child browser environment removes package and repository tokens', () => {
  const result = privateChildEnvironment({
    PATH: '/bin', NPM_TOKEN: 'secret', GH_TOKEN: 'secret', GITHUB_TOKEN: 'secret', NODE_AUTH_TOKEN: 'secret',
  });
  assert.equal(result.PATH, '/bin');
  assert.equal(result.NO_COLOR, '1');
  assert.equal(result.FORCE_COLOR, '0');
  assert.equal(result.NPM_TOKEN, undefined);
  assert.equal(result.GH_TOKEN, undefined);
  assert.equal(result.GITHUB_TOKEN, undefined);
  assert.equal(result.NODE_AUTH_TOKEN, undefined);
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

test('terminal layout stacks controls and reduces decoration on small screens', () => {
  assert.equal(terminalLayout(120, 40).stackedControls, false);
  const narrow = terminalLayout(32, 12);
  assert.equal(narrow.stackedControls, true);
  assert.equal(narrow.tinyLogo, true);
  assert.equal(narrow.showShortcuts, false);
  assert.ok(narrow.panelWidth <= 30);
});

test('Node support excludes EOL-era runtime baselines', () => {
  assert.equal(nodeRuntimeSupported('20.19.0'), false);
  assert.equal(nodeRuntimeSupported('22.13.1'), false);
  assert.equal(nodeRuntimeSupported('22.14.0'), true);
  assert.equal(nodeRuntimeSupported('24.0.0'), true);
});
