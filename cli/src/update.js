import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const REGISTRY_BASE = 'https://registry.npmjs.org/ytconv';
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 4_000;
const MANIFEST_VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

function parseVersion(version) {
  const normalized = String(version ?? '').trim().replace(/^v/iu, '');
  const [core, prerelease = ''] = normalized.split('-', 2);
  const numbers = core.split('.').map((part) => Number.parseInt(part, 10) || 0).slice(0, 3);
  while (numbers.length < 3) numbers.push(0);
  const pre = prerelease ? prerelease.split('.').map((part) => (/^\d+$/u.test(part) ? Number(part) : part)) : [];
  return { numbers, pre };
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = a.numbers[index] - b.numbers[index];
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  if (!a.pre.length && !b.pre.length) return 0;
  if (!a.pre.length) return 1;
  if (!b.pre.length) return -1;
  const count = Math.max(a.pre.length, b.pre.length);
  for (let index = 0; index < count; index += 1) {
    const leftPart = a.pre[index];
    const rightPart = b.pre[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    if (typeof leftPart === 'number' && typeof rightPart === 'number') return leftPart > rightPart ? 1 : -1;
    if (typeof leftPart === 'number') return -1;
    if (typeof rightPart === 'number') return 1;
    return String(leftPart).localeCompare(String(rightPart)) > 0 ? 1 : -1;
  }
  return 0;
}

export function releaseChannel(currentVersion = MANIFEST_VERSION) {
  return String(currentVersion).includes('-') ? 'beta' : 'latest';
}

export function defaultCacheFile(currentVersion = MANIFEST_VERSION, homeDirectory = os.homedir()) {
  return path.join(homeDirectory, '.ytconv', `update-check-${releaseChannel(currentVersion)}.json`);
}

export async function clearUpdateCache(cacheFile = '', { homeDirectory = os.homedir() } = {}) {
  if (cacheFile) {
    await fsp.rm(cacheFile, { force: true }).catch(() => {});
    return cacheFile;
  }

  const directory = path.join(homeDirectory, '.ytconv');
  const targets = [
    path.join(directory, 'update-check.json'),
    path.join(directory, 'update-check-latest.json'),
    path.join(directory, 'update-check-beta.json'),
  ];
  await Promise.all(targets.map((target) => fsp.rm(target, { force: true }).catch(() => {})));
  return targets.join(', ');
}

async function readCache(cacheFile, ttlMs, channel) {
  try {
    const payload = JSON.parse(await fsp.readFile(cacheFile, 'utf8'));
    if (!payload?.latestVersion || !payload?.checkedAt || payload.channel !== channel) return null;
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
    // Cache failures must never stop YTConv.
  }
}

async function fetchLatestVersion({ fetchImpl, timeoutMs, channel }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${REGISTRY_BASE}/${channel}`, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'ytconv-update-check' },
    });
    if (!response.ok) throw new Error(`npm registry HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload?.version) throw new Error('The npm registry did not return a version.');
    return String(payload.version);
  } finally {
    clearTimeout(timer);
  }
}

export async function checkForUpdate({
  currentVersion = MANIFEST_VERSION,
  force = false,
  fetchImpl = globalThis.fetch,
  cacheFile = defaultCacheFile(currentVersion),
  ttlMs = DEFAULT_TTL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (process.env.YTCONV_NO_UPDATE_CHECK === '1') {
    return { checked: false, disabled: true, currentVersion, latestVersion: currentVersion, available: false };
  }

  const channel = releaseChannel(currentVersion);
  if (!force) {
    const cached = await readCache(cacheFile, ttlMs, channel);
    if (cached) {
      return {
        checked: true,
        cached: true,
        channel,
        currentVersion,
        latestVersion: cached.latestVersion,
        available: compareVersions(cached.latestVersion, currentVersion) > 0,
      };
    }
  }

  if (typeof fetchImpl !== 'function') {
    return { checked: false, channel, currentVersion, latestVersion: currentVersion, available: false, error: 'The Fetch API is not available.' };
  }

  try {
    const latestVersion = await fetchLatestVersion({ fetchImpl, timeoutMs, channel });
    await writeCache(cacheFile, { latestVersion, checkedAt: Date.now(), channel });
    return {
      checked: true,
      cached: false,
      channel,
      currentVersion,
      latestVersion,
      available: compareVersions(latestVersion, currentVersion) > 0,
    };
  } catch (error) {
    return {
      checked: false,
      channel,
      currentVersion,
      latestVersion: currentVersion,
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function updateCommand(currentVersion = MANIFEST_VERSION) {
  return `npm install -g ytconv@${releaseChannel(currentVersion)} --force`;
}

function updateArguments(currentVersion = MANIFEST_VERSION) {
  return ['install', '-g', `ytconv@${releaseChannel(currentVersion)}`, '--force'];
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
  currentVersion = MANIFEST_VERSION,
  platform = process.platform,
  env = process.env,
  execPath = process.execPath,
  npmCliPath = findNpmCli({ env, execPath }),
} = {}) {
  const args = updateArguments(currentVersion);
  if (npmCliPath) {
    return {
      command: execPath,
      args: [npmCliPath, ...args],
      strategy: 'node-npm-cli',
    };
  }

  if (platform === 'win32') {
    return {
      command: env.ComSpec || env.COMSPEC || 'cmd.exe',
      args: ['/d', '/s', '/c', updateCommand(currentVersion)],
      strategy: 'windows-cmd-fallback',
    };
  }

  return { command: 'npm', args, strategy: 'npm-path-fallback' };
}

export function runSelfUpdate({
  currentVersion = MANIFEST_VERSION,
  platform = process.platform,
  env = process.env,
  execPath = process.execPath,
  npmCliPath,
  spawnSyncImpl = spawnSync,
} = {}) {
  const invocation = selfUpdateInvocation({ currentVersion, platform, env, execPath, npmCliPath });
  const result = spawnSyncImpl(invocation.command, invocation.args, {
    stdio: 'inherit',
    windowsHide: true,
    env,
  });

  if (result.error || result.status !== 0) {
    const detail = result.error?.message || `exit code ${result.status ?? 'unknown'}`;
    return { ok: false, command: updateCommand(currentVersion), strategy: invocation.strategy, error: new Error(detail) };
  }

  return { ok: true, command: updateCommand(currentVersion), strategy: invocation.strategy };
}

export function automaticUpdateEnabled({
  argv = process.argv.slice(2),
  env = process.env,
  interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY),
} = {}) {
  if (!interactive || env.CI || env.YTCONV_SKIP_AUTO_UPDATE_ONCE === '1') return false;
  if (env.YTCONV_AUTO_UPDATE === '0' || env.YTCONV_NO_UPDATE_CHECK === '1') return false;
  if (argv.includes('--no-update-check')) return false;
  const first = String(argv[0] || '').toLowerCase();
  if (first === 'update' || argv.includes('--update')) return false;
  return true;
}

export async function maybeAutoUpdate({
  currentVersion = MANIFEST_VERSION,
  argv = process.argv.slice(2),
  env = process.env,
  interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY),
  checkImpl = checkForUpdate,
  runImpl = runSelfUpdate,
} = {}) {
  if (!automaticUpdateEnabled({ argv, env, interactive })) {
    return { attempted: false, updated: false, reason: 'disabled' };
  }

  const updateInfo = await checkImpl({ currentVersion });
  if (!updateInfo.available) {
    return {
      attempted: false,
      updated: false,
      reason: updateInfo.checked ? 'current' : 'offline',
      updateInfo,
    };
  }

  console.log(`YTConv ${currentVersion} → ${updateInfo.latestVersion}: updating automatically...`);
  const result = runImpl({ currentVersion, env });
  if (!result.ok) {
    return { attempted: true, updated: false, reason: 'failed', updateInfo, result };
  }
  return { attempted: true, updated: true, reason: 'updated', updateInfo, result };
}
