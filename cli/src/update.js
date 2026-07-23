import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const REGISTRY_URL = 'https://registry.npmjs.org/ytconv/latest';
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 4_000;
const UPDATE_ARGUMENTS = ['install', '-g', 'ytconv@latest', '--force'];

function numericParts(version) {
  return String(version ?? '')
    .trim()
    .replace(/^v/iu, '')
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
    .slice(0, 3);
}

export function compareVersions(left, right) {
  const a = numericParts(left);
  const b = numericParts(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

export function defaultCacheFile() {
  return path.join(os.homedir(), '.ytconv', 'update-check.json');
}

export async function clearUpdateCache(cacheFile = defaultCacheFile()) {
  await fsp.rm(cacheFile, { force: true }).catch(() => {});
  return cacheFile;
}

async function readCache(cacheFile, ttlMs) {
  try {
    const payload = JSON.parse(await fsp.readFile(cacheFile, 'utf8'));
    if (!payload?.latestVersion || !payload?.checkedAt) return null;
    if (Date.now() - Number(payload.checkedAt) > ttlMs) return null;
    return payload;
  } catch {
    return null;
  }
}

async function writeCache(cacheFile, payload) {
  try {
    await fsp.mkdir(path.dirname(cacheFile), { recursive: true });
    await fsp.writeFile(cacheFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  } catch {
    // Cache failure must never stop YTConv.
  }
}

async function fetchLatestVersion({ fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(REGISTRY_URL, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'ytconv-update-check' },
    });
    if (!response.ok) throw new Error(`npm registry HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload?.version) throw new Error('npm registry tidak mengirim versi terbaru.');
    return String(payload.version);
  } finally {
    clearTimeout(timer);
  }
}

export async function checkForUpdate({
  currentVersion,
  force = false,
  fetchImpl = globalThis.fetch,
  cacheFile = defaultCacheFile(),
  ttlMs = DEFAULT_TTL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (process.env.YTCONV_NO_UPDATE_CHECK === '1') {
    return { checked: false, disabled: true, currentVersion, latestVersion: currentVersion, available: false };
  }

  if (!force) {
    const cached = await readCache(cacheFile, ttlMs);
    if (cached) {
      return {
        checked: true,
        cached: true,
        currentVersion,
        latestVersion: cached.latestVersion,
        available: compareVersions(cached.latestVersion, currentVersion) > 0,
      };
    }
  }

  if (typeof fetchImpl !== 'function') {
    return { checked: false, currentVersion, latestVersion: currentVersion, available: false, error: 'Fetch API tidak tersedia.' };
  }

  try {
    const latestVersion = await fetchLatestVersion({ fetchImpl, timeoutMs });
    await writeCache(cacheFile, { latestVersion, checkedAt: Date.now() });
    return {
      checked: true,
      cached: false,
      currentVersion,
      latestVersion,
      available: compareVersions(latestVersion, currentVersion) > 0,
    };
  } catch (error) {
    return {
      checked: false,
      currentVersion,
      latestVersion: currentVersion,
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function updateCommand(version = 'latest') {
  return `npm install -g ytconv@${version} --force`;
}

function npmCliCandidates({ env = process.env, execPath = process.execPath } = {}) {
  const nodeDirectory = path.dirname(execPath);
  return [
    env.npm_execpath,
    path.join(nodeDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDirectory, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.join(nodeDirectory, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    '/usr/lib/node_modules/npm/bin/npm-cli.js',
    '/usr/local/lib/node_modules/npm/bin/npm-cli.js',
  ].filter(Boolean);
}

export function findNpmCli(options = {}) {
  return npmCliCandidates(options).find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) || '';
}

export function selfUpdateInvocation({
  platform = process.platform,
  env = process.env,
  execPath = process.execPath,
  npmCliPath = findNpmCli({ env, execPath }),
} = {}) {
  if (npmCliPath) {
    return {
      command: execPath,
      args: [npmCliPath, ...UPDATE_ARGUMENTS],
      strategy: 'node-npm-cli',
    };
  }

  if (platform === 'win32') {
    return {
      command: env.ComSpec || env.COMSPEC || 'cmd.exe',
      args: ['/d', '/s', '/c', updateCommand()],
      strategy: 'windows-cmd-fallback',
    };
  }

  return { command: 'npm', args: [...UPDATE_ARGUMENTS], strategy: 'npm-path-fallback' };
}

export function runSelfUpdate({
  platform = process.platform,
  env = process.env,
  execPath = process.execPath,
  npmCliPath,
  spawnSyncImpl = spawnSync,
} = {}) {
  const invocation = selfUpdateInvocation({ platform, env, execPath, npmCliPath });
  const result = spawnSyncImpl(invocation.command, invocation.args, {
    stdio: 'inherit',
    windowsHide: true,
    env,
  });

  if (result.error || result.status !== 0) {
    const detail = result.error?.message || `exit code ${result.status ?? 'unknown'}`;
    return { ok: false, command: updateCommand(), strategy: invocation.strategy, error: new Error(detail) };
  }

  return { ok: true, command: updateCommand(), strategy: invocation.strategy };
}
