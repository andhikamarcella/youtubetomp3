import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { randomBytes, randomInt } from 'node:crypto';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import { privateChildEnvironment } from './terminal-style.js';
import { resolveCommandPath } from './command-path.js';

const MANAGED_BROWSERS = new Set([
  'chrome',
  'edge',
  'brave',
  'chromium',
  'opera',
  'vivaldi',
  'whale',
]);

const PROVIDER_COOKIE_DOMAINS = Object.freeze({
  youtube: ['youtube.com', 'google.com'],
  instagram: ['instagram.com'],
  facebook: ['facebook.com'],
  tiktok: ['tiktok.com'],
  x: ['x.com', 'twitter.com'],
  pinterest: ['pinterest.com'],
  reddit: ['reddit.com'],
  threads: ['threads.com', 'threads.net', 'instagram.com'],
  twitch: ['twitch.tv'],
  soundcloud: ['soundcloud.com'],
  vimeo: ['vimeo.com'],
  tumblr: ['tumblr.com'],
  flickr: ['flickr.com', 'yahoo.com'],
  pixiv: ['pixiv.net'],
});

const PROVIDER_AUTH_COOKIES = Object.freeze({
  youtube: [/^SAPISID$/u, /^__Secure-[13]PSID$/u, /^SID$/u],
  instagram: [/^sessionid$/u, /^ds_user_id$/u],
  facebook: [/^c_user$/u, /^xs$/u],
  tiktok: [/^sessionid(?:_ss)?$/u, /^sid_tt$/u],
  x: [/^auth_token$/u, /^ct0$/u],
  pinterest: [/^_pinterest_sess$/u],
  reddit: [/^reddit_session$/u, /^token_v2$/u],
  threads: [/^sessionid$/u, /^ds_user_id$/u],
  twitch: [/^auth-token$/u, /^login$/u],
  soundcloud: [/^oauth_token$/u],
  vimeo: [/^vimeo$/u, /^vuid$/u],
  tumblr: [/^pfs$/u],
  flickr: [/^cookie_session$/u, /^flickr_session$/u],
  pixiv: [/^PHPSESSID$/u],
});

function splitBrowserSpec(browserSpec = '') {
  const value = String(browserSpec || '').trim();
  const separator = value.indexOf(':');
  return {
    browser: (separator < 0 ? value : value.slice(0, separator)).toLowerCase(),
    profile: separator < 0 ? '' : value.slice(separator + 1),
  };
}

function safeSegment(value, fallback) {
  const safe = String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/gu, '-').replace(/^-+|-+$/gu, '');
  return safe || fallback;
}

export function supportsManagedBrowser(browserSpec = '') {
  return MANAGED_BROWSERS.has(splitBrowserSpec(browserSpec).browser);
}

export function managedBrowserReference(browserSpec = '') {
  const { browser } = splitBrowserSpec(browserSpec);
  return `${browser}:YTConv Managed`;
}

export function managedBrowserPaths({
  provider,
  browserSpec,
  homeDirectory = os.homedir(),
} = {}) {
  const { browser } = splitBrowserSpec(browserSpec);
  const directory = path.join(
    homeDirectory,
    '.ytconv',
    'browser-profiles',
    safeSegment(provider, 'social'),
    safeSegment(browser, 'chromium'),
  );
  return {
    directory,
    userDataDirectory: directory,
    activePortFile: path.join(directory, 'DevToolsActivePort'),
  };
}

function windowsCandidates(browser, env) {
  const local = env.LOCALAPPDATA;
  const programFiles = env.ProgramFiles;
  const programFilesX86 = env['ProgramFiles(x86)'];
  const definitions = {
    chrome: [
      [local, 'Google', 'Chrome', 'Application', 'chrome.exe'],
      [programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'],
      [programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'],
      ['chrome.exe'],
    ],
    edge: [
      [programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
      [programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
      [local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'],
      ['msedge.exe'],
    ],
    brave: [
      [local, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'],
      [programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'],
      [programFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'],
      ['brave.exe'],
    ],
    chromium: [[local, 'Chromium', 'Application', 'chrome.exe'], ['chromium.exe'], ['chrome.exe']],
    opera: [[local, 'Programs', 'Opera', 'opera.exe'], [local, 'Programs', 'Opera GX', 'opera.exe'], ['opera.exe']],
    vivaldi: [[local, 'Vivaldi', 'Application', 'vivaldi.exe'], [programFiles, 'Vivaldi', 'Application', 'vivaldi.exe'], ['vivaldi.exe']],
    whale: [[programFiles, 'Naver', 'Naver Whale', 'Application', 'whale.exe'], [local, 'Naver', 'Naver Whale', 'Application', 'whale.exe'], ['whale.exe']],
  };
  return (definitions[browser] || [])
    .map((parts) => parts.length === 1 ? parts[0] : (parts[0] ? path.join(...parts) : ''))
    .filter(Boolean);
}

function macCandidates(browser) {
  const definitions = {
    chrome: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome'],
    edge: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'microsoft-edge'],
    brave: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', 'brave-browser'],
    chromium: ['/Applications/Chromium.app/Contents/MacOS/Chromium', 'chromium'],
    opera: ['/Applications/Opera.app/Contents/MacOS/Opera', 'opera'],
    vivaldi: ['/Applications/Vivaldi.app/Contents/MacOS/Vivaldi', 'vivaldi'],
    whale: ['/Applications/Whale.app/Contents/MacOS/Whale', 'whale'],
  };
  return definitions[browser] || [];
}

function unixCandidates(browser) {
  const definitions = {
    chrome: ['google-chrome-stable', 'google-chrome'],
    edge: ['microsoft-edge-stable', 'microsoft-edge'],
    brave: ['brave-browser', 'brave'],
    chromium: ['chromium', 'chromium-browser'],
    opera: ['opera'],
    vivaldi: ['vivaldi-stable', 'vivaldi'],
    whale: ['naver-whale-stable', 'naver-whale'],
  };
  return definitions[browser] || [];
}

async function executableExists(candidate, { environment = process.env, platform = process.platform } = {}) {
  if (!candidate) return '';
  return await resolveCommandPath(candidate, { environment, platform }) || '';
}

export async function resolveManagedBrowserExecutable({
  browserSpec,
  executable,
  platform = process.platform,
  env = process.env,
} = {}) {
  if (executable) {
    const resolved = await executableExists(executable, { environment: env, platform });
    if (resolved) return resolved;
    throw new Error(`The requested browser executable was not found: ${executable}`);
  }
  const { browser } = splitBrowserSpec(browserSpec);
  const candidates = platform === 'win32'
    ? windowsCandidates(browser, env)
    : platform === 'darwin'
      ? macCandidates(browser)
      : unixCandidates(browser);
  for (const candidate of candidates) {
    const resolved = await executableExists(candidate, { environment: env, platform });
    if (resolved) return resolved;
  }
  throw new Error(`YTConv could not locate ${browser || 'the selected Chromium browser'} for the secure login window.`);
}

export function managedBrowserLaunchArgs({
  userDataDirectory,
  url,
  headless = false,
} = {}) {
  const args = [
    `--user-data-dir=${userDataDirectory}`,
    '--profile-directory=Default',
    '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-mode',
    '--disable-component-update',
    '--disable-extensions',
    '--disable-sync',
    '--no-service-autorun',
  ];
  if (headless) args.push('--headless=new', '--disable-gpu');
  args.push(url || 'about:blank');
  return args;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function cdpCommand(webSocketDebuggerUrl, method, params = {}, { timeoutMs = 10_000 } = {}) {
  return new Promise((resolve, reject) => {
    let endpoint;
    try { endpoint = new URL(webSocketDebuggerUrl); } catch { endpoint = null; }
    if (!endpoint
      || endpoint.protocol !== 'ws:'
      || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) {
      reject(new Error('Refusing a browser bridge that is not bound to the local device.'));
      return;
    }
    const id = randomInt(1, 1_000_000_000);
    const socket = new WebSocket(webSocketDebuggerUrl, { perMessageDeflate: false });
    let settled = false;
    const timer = setTimeout(() => {
      socket.terminate();
      finish(() => reject(new Error(`The local browser did not answer ${method} within ${timeoutMs} ms.`)));
    }, timeoutMs);
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch { /* Already closed. */ }
      callback();
    };
    socket.once('open', () => socket.send(JSON.stringify({ id, method, params })));
    socket.on('message', (payload) => {
      let message;
      try { message = JSON.parse(payload.toString()); } catch { return; }
      if (message.id !== id) return;
      if (message.error) {
        finish(() => reject(new Error(message.error.message || `Browser command ${method} failed.`)));
      } else finish(() => resolve(message.result || {}));
    });
    socket.once('error', (error) => finish(() => reject(error)));
    socket.once('close', () => finish(() => reject(new Error(`The local browser closed before ${method} completed.`))));
  });
}

async function readActiveBrowser(paths) {
  let lines;
  try {
    lines = (await fs.readFile(paths.activePortFile, 'utf8')).trim().split(/\r?\n/u);
  } catch {
    return null;
  }
  const port = Number.parseInt(lines[0], 10);
  const webSocketPath = String(lines[1] || '').trim();
  if (!Number.isInteger(port) || port < 1 || !webSocketPath.startsWith('/')) return null;
  const webSocketDebuggerUrl = `ws://127.0.0.1:${port}${webSocketPath}`;
  try {
    await cdpCommand(webSocketDebuggerUrl, 'Browser.getVersion', {}, { timeoutMs: 1_500 });
    return { port, webSocketDebuggerUrl };
  } catch {
    return null;
  }
}

async function waitForActiveBrowser(paths, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const active = await readActiveBrowser(paths);
    if (active) return active;
    await delay(200);
  }
  throw new Error('The secure browser window opened, but its local session bridge did not become ready.');
}

export async function launchManagedBrowserSession({
  provider,
  browserSpec,
  url,
  homeDirectory = os.homedir(),
  executable,
  platform = process.platform,
  env = process.env,
  headless = false,
  spawnImpl = spawn,
} = {}) {
  if (!supportsManagedBrowser(browserSpec)) {
    throw new Error('The secure browser bridge requires Chrome, Edge, Brave, Chromium, Opera, Vivaldi, or Whale.');
  }
  const paths = managedBrowserPaths({ provider, browserSpec, homeDirectory });
  await fs.mkdir(paths.directory, { recursive: true, mode: 0o700 });
  if (platform !== 'win32') await fs.chmod(paths.directory, 0o700).catch(() => {});

  const existing = await readActiveBrowser(paths);
  if (existing) {
    if (url) await cdpCommand(existing.webSocketDebuggerUrl, 'Target.createTarget', { url });
    return { ...existing, ...paths, browserSpec, provider, reused: true };
  }

  await fs.rm(paths.activePortFile, { force: true });
  const command = await resolveManagedBrowserExecutable({ browserSpec, executable, platform, env });
  const args = managedBrowserLaunchArgs({ userDataDirectory: paths.userDataDirectory, url, headless });
  let child;
  try {
    child = spawnImpl(command, args, {
      detached: !headless,
      stdio: 'ignore',
      windowsHide: false,
      env: privateChildEnvironment(env),
    });
  } catch (error) {
    throw new Error(`The secure browser window could not start: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!child || typeof child.once !== 'function') {
    throw new Error('The secure browser window could not start.');
  }
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      callback();
    };
    child.once('spawn', () => finish(resolve));
    child.once('error', (error) => finish(() => reject(new Error(`The secure browser window could not start: ${error.message}`))));
  });
  if (!headless && typeof child.unref === 'function') child.unref();
  const active = await waitForActiveBrowser(paths);
  return { ...active, ...paths, browserSpec, provider, command, pid: child.pid, reused: false };
}

function normalizedDomain(value = '') {
  return String(value).toLowerCase().replace(/^\./u, '');
}

function cookieMatchesDomains(cookie, domains) {
  const cookieDomain = normalizedDomain(cookie?.domain);
  return domains.some((candidate) => cookieDomain === candidate || cookieDomain.endsWith(`.${candidate}`));
}

export function providerCookieDomains(provider) {
  return PROVIDER_COOKIE_DOMAINS[String(provider || '').toLowerCase()] || [];
}

export function hasProviderAuthentication(cookies, provider) {
  const patterns = PROVIDER_AUTH_COOKIES[String(provider || '').toLowerCase()] || [];
  if (!patterns.length) return cookies.length > 0;
  return cookies.some((cookie) => patterns.some((pattern) => pattern.test(String(cookie.name || ''))));
}

function netscapeField(value) {
  return String(value ?? '').replace(/[\t\r\n]/gu, '');
}

export function serializeNetscapeCookies(cookies = []) {
  const nowSeconds = Date.now() / 1000;
  const lines = ['# Netscape HTTP Cookie File', '# Generated locally by YTConv; deleted after this download.', ''];
  for (const cookie of cookies) {
    const expires = Number(cookie.expires);
    if (Number.isFinite(expires) && expires > 0 && expires <= nowSeconds) continue;
    const rawDomain = netscapeField(cookie.domain);
    if (!rawDomain || !cookie.name) continue;
    const includeSubdomains = rawDomain.startsWith('.') ? 'TRUE' : 'FALSE';
    const domain = cookie.httpOnly ? `#HttpOnly_${rawDomain}` : rawDomain;
    lines.push([
      domain,
      includeSubdomains,
      netscapeField(cookie.path || '/'),
      cookie.secure ? 'TRUE' : 'FALSE',
      Number.isFinite(expires) && expires > 0 ? Math.floor(expires) : 0,
      netscapeField(cookie.name),
      netscapeField(cookie.value),
    ].join('\t'));
  }
  return `${lines.join('\n')}\n`;
}

async function writeTemporaryCookieFile(cookies, provider) {
  try {
    const entries = await fs.readdir(os.tmpdir(), { withFileTypes: true });
    await Promise.all(entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('ytconv-session-'))
      .map(async (entry) => {
        const target = path.join(os.tmpdir(), entry.name);
        try {
          const stats = await fs.stat(target);
          if (Date.now() - stats.mtimeMs > 60 * 60 * 1000) {
            await fs.rm(target, { recursive: true, force: true });
          }
        } catch {
          // A concurrent YTConv process may already have removed it.
        }
      }));
  } catch {
    // Temporary-file creation below still provides the normal cleanup path.
  }
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-session-'));
  if (process.platform !== 'win32') await fs.chmod(directory, 0o700).catch(() => {});
  const cookiePath = path.join(directory, `${safeSegment(provider, 'social')}-${randomBytes(6).toString('hex')}.cookies.txt`);
  await fs.writeFile(cookiePath, serializeNetscapeCookies(cookies), { encoding: 'utf8', mode: 0o600 });
  if (process.platform !== 'win32') await fs.chmod(cookiePath, 0o600).catch(() => {});
  return { cookiePath, cleanupDirectory: directory };
}

export async function exportManagedBrowserCookies({
  session,
  provider,
  domains = providerCookieDomains(provider),
  requireAuthentication = true,
} = {}) {
  if (!session?.webSocketDebuggerUrl) throw new Error('The secure browser session is not connected.');
  if (!domains.length) throw new Error(`No cookie-domain policy is defined for ${provider || 'this provider'}.`);
  const result = await cdpCommand(session.webSocketDebuggerUrl, 'Storage.getCookies');
  const cookies = (Array.isArray(result.cookies) ? result.cookies : [])
    .filter((cookie) => cookieMatchesDomains(cookie, domains));
  if (!cookies.length || (requireAuthentication && !hasProviderAuthentication(cookies, provider))) {
    throw new Error(`The ${provider || 'social'} sign-in is not complete in the YTConv browser window. Finish sign-in there, then press Enter again.`);
  }
  const temporary = await writeTemporaryCookieFile(cookies, provider);
  return {
    kind: 'file',
    path: temporary.cookiePath,
    temporary: true,
    cleanupDirectory: temporary.cleanupDirectory,
    managedBrowser: true,
    managedSession: session,
    provider,
    label: `verified ${provider} browser session`,
  };
}

export async function prepareManagedCookieConfig(config, options = {}) {
  if (config?.kind !== 'managed-browser') return config;
  const session = await launchManagedBrowserSession({
    provider: config.provider,
    browserSpec: config.spec || config.browser,
    url: config.loginUrl || 'about:blank',
    homeDirectory: options.homeDirectory,
    executable: options.executable,
    headless: options.headless,
  });
  return exportManagedBrowserCookies({ session, provider: config.provider });
}

export async function disposePreparedCookieConfig(config) {
  if (config?.temporary && config.cleanupDirectory) {
    const base = path.basename(config.cleanupDirectory);
    if (base.startsWith('ytconv-session-')) {
      await fs.rm(config.cleanupDirectory, { recursive: true, force: true });
    }
  }
  await closeManagedBrowserSession(config?.managedSession);
}

export async function closeManagedBrowserSession(session) {
  if (!session?.webSocketDebuggerUrl) return;
  await cdpCommand(session.webSocketDebuggerUrl, 'Browser.close', {}, { timeoutMs: 3_000 }).catch(() => {});
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      await cdpCommand(session.webSocketDebuggerUrl, 'Browser.getVersion', {}, { timeoutMs: 500 });
      await delay(100);
    } catch {
      return;
    }
  }
}
