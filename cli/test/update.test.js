import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {
  checkForUpdate,
  compareVersions,
  runSelfUpdate,
  selfUpdateInvocation,
  updateCommand,
} from '../src/update.js';

test('compares semantic versions numerically', () => {
  assert.equal(compareVersions('0.5.6', '0.5.5'), 1);
  assert.equal(compareVersions('0.5.5', '0.5.6'), -1);
  assert.equal(compareVersions('v1.2.3', '1.2.3'), 0);
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
});

test('reports an available registry update', async () => {
  const cacheFile = path.join(os.tmpdir(), `ytconv-update-${Date.now()}-${Math.random()}.json`);
  const result = await checkForUpdate({
    currentVersion: '0.5.5',
    force: true,
    cacheFile,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ version: '0.5.6' }),
    }),
  });

  assert.equal(result.checked, true);
  assert.equal(result.available, true);
  assert.equal(result.latestVersion, '0.5.6');
});

test('reports current package as latest', async () => {
  const cacheFile = path.join(os.tmpdir(), `ytconv-current-${Date.now()}-${Math.random()}.json`);
  const result = await checkForUpdate({
    currentVersion: '0.5.6',
    force: true,
    cacheFile,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ version: '0.5.6' }),
    }),
  });

  assert.equal(result.checked, true);
  assert.equal(result.available, false);
});

test('shows the same simple update command on supported platforms', () => {
  assert.equal(updateCommand({ platform: 'win32' }), 'npm install -g ytconv@latest');
  assert.equal(updateCommand({ platform: 'android' }), 'npm install -g ytconv@latest');
});

test('Windows updater invokes npm through cmd.exe instead of spawning npm.cmd directly', () => {
  const invocation = selfUpdateInvocation({
    platform: 'win32',
    env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
  });

  assert.equal(invocation.command, 'C:\\Windows\\System32\\cmd.exe');
  assert.deepEqual(invocation.args, ['/d', '/s', '/c', 'npm install -g ytconv@latest']);
});

test('non-Windows updater invokes npm directly without a shell wrapper', () => {
  const invocation = selfUpdateInvocation({ platform: 'linux', env: {} });
  assert.equal(invocation.command, 'npm');
  assert.deepEqual(invocation.args, ['install', '-g', 'ytconv@latest']);
});

test('self-update returns success with the Windows-safe invocation', () => {
  let captured;
  const result = runSelfUpdate({
    platform: 'win32',
    env: { ComSpec: 'cmd.exe' },
    spawnSyncImpl(command, args, options) {
      captured = { command, args, options };
      return { status: 0, error: null };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(captured.command, 'cmd.exe');
  assert.deepEqual(captured.args, ['/d', '/s', '/c', 'npm install -g ytconv@latest']);
  assert.equal(captured.options.windowsHide, true);
  assert.equal(captured.options.stdio, 'inherit');
});
