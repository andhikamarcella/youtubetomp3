import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { resolveCommandPath } from '../src/command-path.js';

test('resolves an executable without invoking a shell', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-command-path-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const fileName = process.platform === 'win32' ? 'safe-tool.cmd' : 'safe-tool';
  const executable = path.join(directory, fileName);
  const content = process.platform === 'win32' ? '@exit /b 0\r\n' : '#!/bin/sh\nexit 0\n';
  await fs.writeFile(executable, content, { mode: 0o755 });
  const resolved = await resolveCommandPath('safe-tool', {
    environment: { PATH: directory },
    platform: process.platform,
    currentDirectory: directory,
  });
  if (process.platform === 'win32') {
    assert.equal(resolved?.toLowerCase(), executable.toLowerCase());
  } else {
    assert.equal(resolved, executable);
  }
});

test('does not resolve a non-executable file on POSIX', {
  skip: process.platform === 'win32',
}, async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-command-path-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'not-executable'), 'data', { mode: 0o644 });
  assert.equal(await resolveCommandPath('not-executable', {
    environment: { PATH: directory }, platform: process.platform, currentDirectory: directory,
  }), null);
});

test('does not search the working directory when PATH is empty', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-command-path-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const fileName = process.platform === 'win32' ? 'local-tool.cmd' : 'local-tool';
  const executable = path.join(directory, fileName);
  await fs.writeFile(executable, 'exit', { mode: 0o755 });
  assert.equal(await resolveCommandPath('local-tool', {
    environment: { PATH: '' }, platform: process.platform, currentDirectory: directory,
  }), null);
});

test('rejects null-byte command names', async () => {
  assert.equal(await resolveCommandPath('bad\0name', {
    environment: { PATH: '' }, platform: process.platform,
  }), null);
});
