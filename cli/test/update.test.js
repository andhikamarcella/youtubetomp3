import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  checkForUpdate,
  clearUpdateCache,
  compareVersions,
  automaticUpdateEnabled,
  maybeAutoUpdate,
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

test('clearing update cache preserves archive files', async () => {
  const homeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-cache-test-'));
  const appDirectory = path.join(homeDirectory, '.ytconv');
  const archiveDirectory = path.join(appDirectory, 'archives');
  const archiveFile = path.join(archiveDirectory, 'yt-dlp-audio-mp3-320.txt');
  await fs.mkdir(archiveDirectory, { recursive: true });
  await fs.writeFile(archiveFile, 'youtube abc123\n', 'utf8');
  for (const name of ['update-check.json', 'update-check-latest.json', 'update-check-beta.json']) {
    await fs.writeFile(path.join(appDirectory, name), '{}\n', 'utf8');
  }

  await clearUpdateCache('', { homeDirectory });

  await assert.doesNotReject(() => fs.access(archiveFile));
  for (const name of ['update-check.json', 'update-check-latest.json', 'update-check-beta.json']) {
    await assert.rejects(() => fs.access(path.join(appDirectory, name)));
  }
  await fs.rm(homeDirectory, { recursive: true, force: true });
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

test('automatic updates run only for interactive user sessions', () => {
  assert.equal(automaticUpdateEnabled({ argv: [], env: {}, interactive: true }), true);
  assert.equal(automaticUpdateEnabled({ argv: [], env: {}, interactive: false }), false);
  assert.equal(automaticUpdateEnabled({ argv: ['--no-update-check'], env: {}, interactive: true }), false);
  assert.equal(automaticUpdateEnabled({ argv: [], env: { CI: '1' }, interactive: true }), false);
  assert.equal(automaticUpdateEnabled({ argv: [], env: { YTCONV_AUTO_UPDATE: '0' }, interactive: true }), false);
});

test('automatic update installs an available stable version', async () => {
  let installed = false;
  const result = await maybeAutoUpdate({
    currentVersion: '1.5.6',
    argv: [],
    env: {},
    interactive: true,
    checkImpl: async () => ({ checked: true, available: true, latestVersion: '1.5.8' }),
    runImpl: ({ currentVersion }) => {
      installed = currentVersion === '1.5.6';
      return { ok: true, strategy: 'test', command: 'npm install -g ytconv@latest --force' };
    },
  });
  assert.equal(result.updated, true);
  assert.equal(installed, true);
});
