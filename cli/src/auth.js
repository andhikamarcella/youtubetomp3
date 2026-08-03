import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { sanitizeTerminalText } from './terminal-style.js';

const AUTH_SCHEMA_VERSION = 3;

export function authPaths(homeDirectory = os.homedir()) {
  const directory = path.join(homeDirectory, '.ytconv');
  return { directory, auth: path.join(directory, 'auth.json') };
}

function accountLabel(user = {}) {
  return user.displayName || user.display_name || user.id || 'local user';
}

function cleanText(value, maximumLength, fallback = '') {
  return sanitizeTerminalText(value, { allowNewlines: false, maximumLength }).trim() || fallback;
}

function safeTimestamp(value, fallback) {
  const parsed = new Date(value || '');
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : fallback;
}

function privateSession(value = {}) {
  const user = value.user && typeof value.user === 'object' ? value.user : {};
  const now = new Date().toISOString();
  const generatedId = `local-${randomUUID()}`;
  return {
    schemaVersion: AUTH_SCHEMA_VERSION,
    mode: 'local',
    user: {
      id: cleanText(user.id, 160, generatedId),
      displayName: cleanText(accountLabel(user), 120, 'local user'),
      role: 'local',
    },
    deviceName: cleanText(value.deviceName || `${os.hostname() || 'device'} (${process.platform})`, 160, 'device'),
    savedAt: safeTimestamp(value.savedAt, now),
    lastValidatedAt: safeTimestamp(value.lastValidatedAt, now),
  };
}

async function readJson(file) {
  try {
    const value = JSON.parse(await fs.readFile(file, 'utf8'));
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

export async function writeAuthSession(value, { homeDirectory = os.homedir() } = {}) {
  const paths = authPaths(homeDirectory);
  await fs.mkdir(paths.directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') await fs.chmod(paths.directory, 0o700).catch(() => {});
  const temporary = `${paths.auth}.${process.pid}.${randomUUID()}.tmp`;
  const sanitized = privateSession(value);
  await fs.writeFile(temporary, `${JSON.stringify(sanitized, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  if (process.platform !== 'win32') await fs.chmod(temporary, 0o600).catch(() => {});
  await fs.rename(temporary, paths.auth);
  if (process.platform !== 'win32') await fs.chmod(paths.auth, 0o600).catch(() => {});
  return sanitized;
}

export async function readAuthSession({ homeDirectory = os.homedir() } = {}) {
  const raw = await readJson(authPaths(homeDirectory).auth);
  if (!raw) return null;

  const isLocal = raw.mode === 'local' || String(raw.accessToken || '').startsWith('local:');
  if (!isLocal) {
    // Version 1.6.0 is CLI-only and intentionally removes legacy cloud bearer tokens.
    await clearAuthSession({ homeDirectory });
    return null;
  }

  const sanitized = privateSession(raw);
  if (raw.accessToken || raw.email || raw.apiBase || raw.expiresAt || raw.tokenId || raw.schemaVersion !== AUTH_SCHEMA_VERSION) {
    await writeAuthSession(sanitized, { homeDirectory });
  }
  return sanitized;
}

export async function clearAuthSession({ homeDirectory = os.homedir() } = {}) {
  await fs.rm(authPaths(homeDirectory).auth, { force: true });
}

function localNameFromEnvironment() {
  return process.env.USERNAME || process.env.USER || os.hostname() || 'local user';
}

export async function loginLocally({
  homeDirectory = os.homedir(),
  localName = '',
} = {}) {
  const fallback = String(localName || localNameFromEnvironment()).trim().slice(0, 120) || 'local user';
  const session = await writeAuthSession({
    mode: 'local',
    user: { id: `local-${randomUUID()}`, displayName: fallback, role: 'local' },
    deviceName: `${os.hostname() || 'device'} (${process.platform} ${process.arch})`,
  }, { homeDirectory });

  console.log('YTConv local profile ready');
  console.log(`Account  ${accountLabel(session.user)}`);
  console.log('Mode     local CLI profile');
  console.log(`Saved    ${authPaths(homeDirectory).auth}`);
  return { exitCode: 0, mode: 'local', session };
}

export async function login(options = {}) {
  if (options.cloudOnly) {
    throw new Error('Cloud account login was removed in YTConv 1.6.0. Use a local profile or `ytconv login PROVIDER` for an official social-site login.');
  }
  return loginLocally(options);
}

export async function validateAuthSession({ homeDirectory = os.homedir() } = {}) {
  const session = await readAuthSession({ homeDirectory });
  if (!session) return { ok: false, reason: 'not-configured' };
  session.lastValidatedAt = new Date().toISOString();
  const updated = await writeAuthSession(session, { homeDirectory });
  return { ok: true, offline: true, session: updated };
}

export async function requireAuthenticatedSession(options = {}) {
  const result = await validateAuthSession(options);
  if (result.ok) return result.session;
  throw new Error('A local YTConv profile is not configured. Run: ytconv account login');
}

export function applyAuthEnvironment(session, env = process.env) {
  if (!session) return env;
  env.YTCONV_AUTH_MODE = 'local';
  env.YTCONV_ACCOUNT_LABEL = cleanText(accountLabel(session.user), 120, 'local user');
  env.YTCONV_USER_ID = cleanText(session.user?.id, 160);
  delete env.YTCONV_AUTH_TOKEN;
  delete env.YTCONV_USER_EMAIL;
  return env;
}

export function authHelpText() {
  return [
    'Optional local profile commands:',
    '  ytconv account login        Create a token-free local display profile',
    '  ytconv account status       Show the local profile',
    '  ytconv account logout       Remove the local profile',
    '',
    'Social-site login is separate: ytconv login instagram',
    'Passwords, OTP codes, and remote account tokens are never stored by this profile.',
  ].join('\n');
}

export async function logout({ homeDirectory = os.homedir() } = {}) {
  await clearAuthSession({ homeDirectory });
  console.log('The local YTConv profile was removed from this device.');
  return 0;
}

export async function printAuthStatus({ homeDirectory = os.homedir() } = {}) {
  const result = await validateAuthSession({ homeDirectory });
  if (!result.ok) {
    console.log('No local profile is configured. Run: ytconv account login');
    return 1;
  }
  console.log('YTConv local profile');
  console.log('Status      ready');
  console.log('Mode        local CLI profile');
  console.log(`Account     ${accountLabel(result.session.user)}`);
  console.log(`Device      ${result.session.deviceName}`);
  console.log('Remote token none');
  return 0;
}

function normalizedAuthCommand(argv = []) {
  const first = String(argv[0] || '').toLowerCase();
  if (!['auth', 'account'].includes(first)) return '';
  const action = String(argv[1] || 'status').toLowerCase();
  if (['login', 'signin', 'sign-in'].includes(action)) return 'login';
  if (['logout', 'signout', 'sign-out'].includes(action)) return 'logout';
  if (['status', 'whoami'].includes(action)) return 'status';
  if (['help', '--help', '-h'].includes(action)) return 'help';
  return 'unknown';
}

export async function handleAuthCommand(argv = [], options = {}) {
  const command = normalizedAuthCommand(argv);
  if (!command) return { handled: false, exitCode: 0 };
  if (command === 'help') {
    console.log(authHelpText());
    return { handled: true, exitCode: 0 };
  }
  if (command === 'login') {
    const result = await login({ ...options, cloudOnly: argv.includes('--cloud-only') });
    return { handled: true, action: 'login', exitCode: result.exitCode, session: result.session };
  }
  if (command === 'logout') return { handled: true, action: 'logout', exitCode: await logout(options) };
  if (command === 'status') return { handled: true, action: 'status', exitCode: await printAuthStatus(options) };
  console.error(authHelpText());
  return { handled: true, exitCode: 2 };
}
