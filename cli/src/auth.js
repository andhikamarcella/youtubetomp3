import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const DEFAULT_API_BASE = 'https://ytconv.onrender.com';
const REQUEST_TIMEOUT_MS = 20_000;
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function apiBase() {
  return String(process.env.YTCONV_API_BASE || DEFAULT_API_BASE).replace(/\/+$/u, '');
}

export function authPaths(homeDirectory = os.homedir()) {
  const directory = path.join(homeDirectory, '.ytconv');
  return {
    directory,
    auth: path.join(directory, 'auth.json'),
  };
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

export async function readAuthSession({ homeDirectory = os.homedir() } = {}) {
  const value = await readJson(authPaths(homeDirectory).auth);
  if (!value || typeof value.accessToken !== 'string' || !value.accessToken) return null;
  return value;
}

export async function writeAuthSession(value, { homeDirectory = os.homedir() } = {}) {
  const target = authPaths(homeDirectory);
  await fs.mkdir(target.directory, { recursive: true });
  const temporary = `${target.auth}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporary, target.auth);
  if (process.platform !== 'win32') await fs.chmod(target.auth, 0o600).catch(() => {});
  return target.auth;
}

export async function clearAuthSession({ homeDirectory = os.homedir() } = {}) {
  await fs.rm(authPaths(homeDirectory).auth, { force: true });
}

async function requestJson(endpoint, { method = 'GET', token = '', body, timeout = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${apiBase()}${endpoint}`, {
      method,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        'user-agent': `ytconv-cli/${process.env.npm_package_version || 'unknown'}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    if (!response.ok) {
      const error = new Error(payload?.error || payload?.message || `YTConv account server returned HTTP ${response.status}.`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload || {};
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('YTConv account server timed out. Check the connection and try again.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function openBrowser(url) {
  const candidates = process.platform === 'win32'
    ? [['cmd.exe', ['/d', '/s', '/c', 'start', '', url]]]
    : process.platform === 'darwin'
      ? [['open', [url]]]
      : process.env.TERMUX_VERSION
        ? [['termux-open-url', [url]], ['xdg-open', [url]]]
        : [['xdg-open', [url]], ['gio', ['open', url]]];

  for (const [command, args] of candidates) {
    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
      child.once('error', () => {});
      child.unref();
      return true;
    } catch {
      // Continue to the next opener. The URL is always printed as a fallback.
    }
  }
  return false;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function accountLabel(user = {}) {
  return user.displayName || user.display_name || user.email || user.id || 'YTConv user';
}

function supportsColor() {
  return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && process.env.FORCE_COLOR !== '0';
}

function tone(code, value) {
  return supportsColor() ? `\u001b[${code}m${value}\u001b[0m` : String(value);
}

function authCard({ title, lines = [], accent = '36' }) {
  const width = Math.max(58, ...lines.map((line) => Array.from(String(line)).length + 4));
  const horizontal = '─'.repeat(width - 2);
  const rows = [
    tone(accent, `╭${horizontal}╮`),
    tone(accent, `│ ${title.padEnd(width - 4)} │`),
    tone(accent, `├${horizontal}┤`),
    ...lines.map((line) => tone(accent, `│ ${String(line).padEnd(width - 4)} │`)),
    tone(accent, `╰${horizontal}╯`),
  ];
  console.log(`\n${rows.join('\n')}`);
}

export function applyAuthEnvironment(session, env = process.env) {
  const user = session?.user || {};
  env.YTCONV_AUTH_TOKEN = session?.accessToken || '';
  env.YTCONV_AUTH_MODE = session?.mode || 'cloud';
  env.YTCONV_USER_ID = user.id || '';
  env.YTCONV_USER_EMAIL = user.email || '';
  env.YTCONV_ACCOUNT_LABEL = accountLabel(user);
  return env;
}

export function authHelpText() {
  return [
    '',
    'Account commands:',
    '  ytconv login              Sign in, then return to the CLI automatically',
    '  ytconv login --local      Use a private profile stored only on this device',
    '  ytconv login --cloud-only Require cloud login; disable local fallback',
    '  ytconv auth status        Show the active account and device',
    '  ytconv logout             Revoke the current device session',
    '',
    `Account server: ${apiBase()}`,
    'If the account server is unavailable, interactive login safely falls back to a local CLI profile.',
  ].join('\n');
}

async function localProfileDetails({ localName = '', localEmail = '' } = {}) {
  const fallbackName = localName.trim() || os.userInfo().username || os.hostname() || 'YTConv user';
  if (!process.stdin.isTTY || !process.stdout.isTTY || localName.trim()) {
    return { displayName: fallbackName, email: localEmail.trim() };
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await prompt.question(`Display name [${fallbackName}]: `)).trim();
    return { displayName: answer || fallbackName, email: localEmail.trim() };
  } finally {
    prompt.close();
  }
}

export async function loginLocally({
  version = 'unknown',
  homeDirectory = os.homedir(),
  localName = '',
  localEmail = '',
  reason = '',
} = {}) {
  if (reason) console.log(tone('33', `\nCloud sign-in is unavailable (${reason}).`));
  console.log('Continuing with a private local CLI profile. No browser or web account is required.');
  const profile = await localProfileDetails({ localName, localEmail });
  const savedAt = new Date().toISOString();
  const localId = `local-${randomUUID()}`;
  const session = {
    schemaVersion: 2,
    mode: 'local',
    accessToken: `local:${randomUUID()}`,
    tokenId: 'local-device',
    user: {
      id: localId,
      email: profile.email,
      displayName: profile.displayName,
      role: 'local',
    },
    deviceName: `${os.hostname() || 'device'} (${process.platform} ${process.arch})`,
    apiBase: null,
    cliVersion: version,
    savedAt,
    lastValidatedAt: savedAt,
    expiresAt: null,
  };
  const target = await writeAuthSession(session, { homeDirectory });
  authCard({
    title: 'YTConv local profile ready',
    accent: '32',
    lines: [
      `Account  ${accountLabel(session.user)}`,
      'Mode     Local CLI fallback',
      `Saved    ${target}`,
    ],
  });
  return { exitCode: 0, session, mode: 'local' };
}

async function loginWithDevice({ version = 'unknown', homeDirectory = os.homedir() } = {}) {
  const deviceName = `${os.hostname() || 'device'} (${process.platform} ${process.arch})`;
  const device = await requestJson('/api/cli-auth/device', {
    method: 'POST',
    body: {
      deviceName,
      platform: process.env.TERMUX_VERSION ? 'termux' : process.platform,
      cliVersion: version,
    },
  });

  if (!device.deviceCode || !device.userCode || !device.verificationUri) {
    throw new Error('The YTConv account server returned an incomplete login response.');
  }

  const verificationUrl = device.verificationUriComplete || `${device.verificationUri}?code=${encodeURIComponent(device.userCode)}`;
  authCard({
    title: 'YTConv secure device login',
    lines: [
      `Code     ${device.userCode}`,
      `Device   ${deviceName}`,
      'Status   Waiting for browser approval',
    ],
  });
  console.log(`\nOpen this link and sign in:\n${verificationUrl}\n`);
  if (openBrowser(verificationUrl)) console.log('A browser window was requested. Finish login there, then return here.');
  else console.log('The browser could not be opened automatically. Copy the link into any browser.');
  console.log('Waiting for approval... Press Ctrl+C to cancel.');

  const interval = Math.max(2, Number(device.interval) || 4) * 1000;
  const expiresAt = Date.now() + Math.min(LOGIN_TIMEOUT_MS, Math.max(60, Number(device.expiresIn) || 600) * 1000);
  let dots = 0;
  while (Date.now() < expiresAt) {
    await sleep(interval);
    try {
      const token = await requestJson('/api/cli-auth/token', {
        method: 'POST',
        body: { deviceCode: device.deviceCode },
      });
      if (!token.accessToken) throw new Error('The account server approved login without returning a token.');
      const savedAt = new Date().toISOString();
      const session = {
        schemaVersion: 1,
        accessToken: token.accessToken,
        tokenId: token.tokenId || '',
        user: token.user || {},
        deviceName,
        apiBase: apiBase(),
        savedAt,
        lastValidatedAt: savedAt,
        expiresAt: token.expiresAt || null,
      };
      const target = await writeAuthSession(session, { homeDirectory });
      authCard({
        title: 'Login complete',
        accent: '32',
        lines: [
          `Account  ${accountLabel(session.user)}`,
          'Mode     Cloud account',
          `Saved    ${target}`,
          'Next     Returning to YTConv CLI',
        ],
      });
      return { exitCode: 0, session, mode: 'cloud' };
    } catch (error) {
      if ([400, 404, 428, 429].includes(error?.status)) {
        dots = (dots + 1) % 4;
        process.stdout.write(`\rWaiting for browser approval${'.'.repeat(dots).padEnd(3, ' ')}`);
        continue;
      }
      if ([403, 410].includes(error?.status)) throw new Error(error.message || 'The device login expired or was denied.');
      throw error;
    }
  }
  throw new Error('The device login expired. Run `ytconv login` and try again.');
}

function cloudFallbackReason(error) {
  if (Number(error?.status) === 404 || Number(error?.status) === 405) return 'login endpoint not deployed';
  if ([500, 502, 503, 504].includes(Number(error?.status))) return `account server HTTP ${error.status}`;
  return error instanceof Error ? error.message : String(error);
}

export async function login(options = {}) {
  if (options.preferLocal) return loginLocally(options);
  try {
    return await loginWithDevice(options);
  } catch (error) {
    if (options.allowLocalFallback === false) throw error;
    return loginLocally({ ...options, reason: cloudFallbackReason(error) });
  }
}

export async function validateAuthSession({ homeDirectory = os.homedir(), quiet = false } = {}) {
  const session = await readAuthSession({ homeDirectory });
  if (!session) return { ok: false, reason: 'missing' };
  if (session.mode === 'local' || String(session.accessToken).startsWith('local:')) {
    const updated = { ...session, mode: 'local', lastValidatedAt: new Date().toISOString() };
    await writeAuthSession(updated, { homeDirectory });
    return { ok: true, session: updated, offline: true };
  }
  try {
    const current = await requestJson('/api/cli-auth/me', { token: session.accessToken });
    const updated = {
      ...session,
      user: current.user || session.user || {},
      tokenId: current.tokenId || session.tokenId || '',
      expiresAt: current.expiresAt || session.expiresAt || null,
      lastValidatedAt: new Date().toISOString(),
      apiBase: apiBase(),
    };
    await writeAuthSession(updated, { homeDirectory });
    return { ok: true, session: updated };
  } catch (error) {
    if ([401, 403, 410].includes(error?.status)) await clearAuthSession({ homeDirectory });
    if (!quiet) throw error;
    return { ok: false, reason: error?.status === 401 ? 'expired' : 'unreachable', error };
  }
}

export async function requireAuthenticatedSession(options = {}) {
  const result = await validateAuthSession(options);
  if (result.ok) return result.session;
  throw new Error([
    'A YTConv profile is required before downloading or converting media.',
    'Run: ytconv login',
    'Local-only fallback: ytconv login --local',
    `Login page: ${apiBase()}/cli-login`,
  ].join('\n'));
}

export async function logout({ homeDirectory = os.homedir() } = {}) {
  const session = await readAuthSession({ homeDirectory });
  if (session?.accessToken && session.mode !== 'local' && !String(session.accessToken).startsWith('local:')) {
    await requestJson('/api/cli-auth/logout', { method: 'POST', token: session.accessToken }).catch(() => {});
  }
  await clearAuthSession({ homeDirectory });
  console.log(session?.mode === 'local'
    ? 'YTConv local profile was removed from this device.'
    : 'YTConv account was signed out on this device.');
  return 0;
}

export async function printAuthStatus({ homeDirectory = os.homedir() } = {}) {
  const result = await validateAuthSession({ homeDirectory, quiet: true });
  if (!result.ok) {
    console.log('Not signed in. Run: ytconv login');
    return 1;
  }
  const { session } = result;
  console.log('YTConv account');
  console.log(`Status      signed in`);
  console.log(`Mode        ${session.mode === 'local' ? 'local CLI fallback' : 'cloud account'}`);
  console.log(`Account     ${accountLabel(session.user)}`);
  if (session.user?.email) console.log(`Email       ${session.user.email}`);
  if (session.user?.role) console.log(`Role        ${session.user.role}`);
  console.log(`Device      ${session.deviceName || '-'}`);
  console.log(`Token       ${session.tokenId || '-'}`);
  console.log(`API         ${session.mode === 'local' ? 'not required' : session.apiBase || apiBase()}`);
  if (session.expiresAt) console.log(`Expires     ${session.expiresAt}`);
  return 0;
}

function normalizedAuthCommand(argv = []) {
  const first = String(argv[0] || '').toLowerCase();
  if (first === 'login' || first === 'signin' || first === 'sign-in') return 'login';
  if (first === 'logout' || first === 'signout' || first === 'sign-out') return 'logout';
  if (first === 'whoami') return 'status';
  if (first !== 'auth' && first !== 'account') return '';
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
  if (command === 'help') { console.log(authHelpText()); return { handled: true, exitCode: 0 }; }
  if (command === 'login') {
    const result = await login({
      ...options,
      preferLocal: argv.includes('--local'),
      allowLocalFallback: !argv.includes('--cloud-only'),
    });
    return { handled: true, action: 'login', exitCode: result.exitCode, session: result.session };
  }
  if (command === 'logout') return { handled: true, action: 'logout', exitCode: await logout(options) };
  if (command === 'status') return { handled: true, action: 'status', exitCode: await printAuthStatus(options) };
  console.error(authHelpText());
  return { handled: true, exitCode: 2 };
}
