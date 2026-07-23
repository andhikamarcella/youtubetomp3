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
  assert.equal(compareVersions('1.2.3', '1.2.2'), 1);
  assert.equal(compareVersions('1.2.2', '1.2.3'), -1);
  assert.equal(compareVersions('v1.2.3', '1.2.3'), 0);
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
});

test('reports an available registry update', async () => {
  const cacheFile = path.join(os.tmpdir(), `ytconv-update-${Date.now()}-${Math.random()}.json`);
  const result = await checkForUpdate({
    currentVersion: '1.2.2', force: true, cacheFile,
    fetchImpl: async () => ({ ok: true, json: async () => ({ version: '1.2.3' }) }),
  });
  assert.equal(result.checked, true);
  assert.equal(result.available, true);
  assert.equal(result.latestVersion, '1.2.3');
});

test('update command is explicit and force-safe', () => {
  assert.equal(updateCommand(), 'npm install -g ytconv@latest --force');
  assert.equal(updateCommand('1.2.3'), 'npm install -g ytconv@1.2.3 --force');
});

test('preferred updater runs npm-cli.js through the current Node executable', () => {
  const invocation = selfUpdateInvocation({
    platform: 'win32', env: {}, execPath: 'C:\\Program Files\\nodejs\\node.exe',
    npmCliPath: 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
  });
  assert.equal(invocation.command, 'C:\\Program Files\\nodejs\\node.exe');
  assert.equal(invocation.strategy, 'node-npm-cli');
  assert.deepEqual(invocation.args, [
    'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
    'install', '-g', 'ytconv@latest', '--force',
  ]);
});

test('Windows fallback uses cmd.exe instead of spawning npm.cmd directly', () => {
  const invocation = selfUpdateInvocation({
    platform: 'win32', env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
    execPath: 'node.exe', npmCliPath: '',
  });
  assert.equal(invocation.command, 'C:\\Windows\\System32\\cmd.exe');
  assert.equal(invocation.strategy, 'windows-cmd-fallback');
  assert.deepEqual(invocation.args, ['/d', '/s', '/c', 'npm install -g ytconv@latest --force']);
});

test('self-update returns strategy and success', () => {
  let captured;
  const result = runSelfUpdate({
    platform: 'win32', env: {}, execPath: 'node.exe', npmCliPath: 'npm-cli.js',
    spawnSyncImpl(command, args, options) {
      captured = { command, args, options };
      return { status: 0, error: null };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.strategy, 'node-npm-cli');
  assert.equal(captured.command, 'node.exe');
  assert.equal(captured.options.stdio, 'inherit');
});
