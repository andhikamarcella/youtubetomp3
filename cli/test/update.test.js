import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {
  checkForUpdate,
  compareVersions,
  releaseChannel,
  runSelfUpdate,
  selfUpdateInvocation,
  updateCommand,
} from '../src/update.js';

test('compares stable and prerelease semantic versions', () => {
  assert.equal(compareVersions('1.2.3', '1.2.2'), 1);
  assert.equal(compareVersions('1.2.2', '1.2.3'), -1);
  assert.equal(compareVersions('v1.2.3', '1.2.3'), 0);
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.5.0-beta.2', '1.5.0-beta.1'), 1);
  assert.equal(compareVersions('1.5.0', '1.5.0-beta.9'), 1);
});

test('chooses latest for stable and beta for prereleases', () => {
  assert.equal(releaseChannel('1.3.0'), 'latest');
  assert.equal(releaseChannel('1.5.0-beta.1'), 'beta');
  assert.equal(updateCommand('1.5.0-beta.1'), 'npm install -g ytconv@beta --force');
  assert.equal(updateCommand('1.3.0'), 'npm install -g ytconv@latest --force');
});

test('reports an available beta registry update', async () => {
  const cacheFile = path.join(os.tmpdir(), `ytconv-update-${Date.now()}-${Math.random()}.json`);
  let requestedUrl = '';
  const result = await checkForUpdate({
    currentVersion: '1.5.0-beta.1', force: true, cacheFile,
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return { ok: true, json: async () => ({ version: '1.5.0-beta.2' }) };
    },
  });
  assert.match(requestedUrl, /\/beta$/u);
  assert.equal(result.checked, true);
  assert.equal(result.available, true);
  assert.equal(result.latestVersion, '1.5.0-beta.2');
  assert.equal(result.channel, 'beta');
});

test('preferred beta updater runs npm-cli.js through current Node', () => {
  const invocation = selfUpdateInvocation({
    currentVersion: '1.5.0-beta.1',
    platform: 'win32', env: {}, execPath: 'C:\\Program Files\\nodejs\\node.exe',
    npmCliPath: 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
  });
  assert.equal(invocation.command, 'C:\\Program Files\\nodejs\\node.exe');
  assert.equal(invocation.strategy, 'node-npm-cli');
  assert.deepEqual(invocation.args, [
    'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
    'install', '-g', 'ytconv@beta', '--force',
  ]);
});

test('Windows beta fallback uses cmd.exe instead of npm.cmd', () => {
  const invocation = selfUpdateInvocation({
    currentVersion: '1.5.0-beta.1',
    platform: 'win32', env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
    execPath: 'node.exe', npmCliPath: '',
  });
  assert.equal(invocation.command, 'C:\\Windows\\System32\\cmd.exe');
  assert.equal(invocation.strategy, 'windows-cmd-fallback');
  assert.deepEqual(invocation.args, ['/d', '/s', '/c', 'npm install -g ytconv@beta --force']);
});

test('self-update returns strategy and success', () => {
  let captured;
  const result = runSelfUpdate({
    currentVersion: '1.5.0-beta.1',
    platform: 'win32', env: {}, execPath: 'node.exe', npmCliPath: 'npm-cli.js',
    spawnSyncImpl(command, args, options) {
      captured = { command, args, options };
      return { status: 0, error: null };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.strategy, 'node-npm-cli');
  assert.equal(result.command, 'npm install -g ytconv@beta --force');
  assert.equal(captured.command, 'node.exe');
  assert.equal(captured.options.stdio, 'inherit');
});
