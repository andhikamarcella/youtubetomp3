import process from 'node:process';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { detectBrowserProfileSpecs, detectSystemBrowsers } from './cookies.js';
import { detectSocialPlatform } from './social-platforms.js';
import {
  SOCIAL_LOGIN_PROVIDERS,
  linkSocialSession,
  normalizeSocialProvider,
  readSocialSessions,
  socialProviderDetails,
  socialSessionForProvider,
  unlinkSocialSession,
} from './social-sessions.js';

const BROWSER_LABELS = Object.freeze({
  chrome: 'Google Chrome',
  edge: 'Microsoft Edge',
  firefox: 'Mozilla Firefox',
  brave: 'Brave',
  chromium: 'Chromium',
  opera: 'Opera',
  vivaldi: 'Vivaldi',
  safari: 'Safari',
  whale: 'Naver Whale',
});

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index < 0) return '';
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${name} requires a value.`);
  return value;
}

function splitBrowserSpec(browserSpec = '') {
  const separator = browserSpec.indexOf(':');
  if (separator < 0) return { browser: browserSpec.toLowerCase(), profile: '' };
  return {
    browser: browserSpec.slice(0, separator).toLowerCase(),
    profile: browserSpec.slice(separator + 1),
  };
}

function browserProfileArgs(browser, profile) {
  if (!profile) return [];
  if (browser === 'firefox') {
    return /[\\/]/u.test(profile) || /^[a-z]:/iu.test(profile)
      ? ['-profile', profile]
      : ['-P', profile];
  }
  if (browser === 'safari') return [];
  return [`--profile-directory=${profile}`];
}

function browserCommandCandidates(browserSpec, url, {
  platform = process.platform,
  termux = Boolean(process.env.TERMUX_VERSION),
} = {}) {
  const { browser, profile } = splitBrowserSpec(browserSpec);
  const executable = {
    chrome: platform === 'win32' ? 'chrome.exe' : 'google-chrome',
    edge: platform === 'win32' ? 'msedge.exe' : 'microsoft-edge',
    firefox: platform === 'win32' ? 'firefox.exe' : 'firefox',
    brave: platform === 'win32' ? 'brave.exe' : 'brave-browser',
    chromium: platform === 'win32' ? 'chromium.exe' : 'chromium',
    opera: platform === 'win32' ? 'opera.exe' : 'opera',
    vivaldi: platform === 'win32' ? 'vivaldi.exe' : 'vivaldi',
    safari: 'Safari',
    whale: platform === 'win32' ? 'whale.exe' : 'naver-whale',
  }[browser];
  const profileArgs = browserProfileArgs(browser, profile);

  if (platform === 'win32') {
    return [
      ['cmd.exe', ['/d', '/s', '/c', 'start', '', executable || '', ...profileArgs, url]],
      ['cmd.exe', ['/d', '/s', '/c', 'start', '', url]],
    ];
  }
  if (platform === 'darwin') {
    const application = BROWSER_LABELS[browser] || executable;
    return [
      ...(application ? [['open', ['-a', application, url, ...(profileArgs.length ? ['--args', ...profileArgs] : [])]]] : []),
      ['open', [url]],
    ];
  }
  if (termux) return [['termux-open-url', [url]], ['xdg-open', [url]]];
  return [
    ...(executable ? [[executable, [...profileArgs, url]]] : []),
    ['xdg-open', [url]],
    ['gio', ['open', url]],
  ];
}

function spawnDetached(command, args) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
      child.once('spawn', () => {
        child.unref();
        finish(true);
      });
      child.once('error', () => finish(false));
    } catch {
      finish(false);
    }
  });
}

export async function openOfficialSocialLogin({
  provider,
  browser,
  browserSpec,
  spawnImpl = spawnDetached,
  platform = process.platform,
  termux = Boolean(process.env.TERMUX_VERSION),
} = {}) {
  const details = socialProviderDetails(provider);
  if (!details) throw new Error(`Unknown social provider: ${provider || '-'}.`);
  const selected = browserSpec || browser;
  for (const [command, args] of browserCommandCandidates(selected, details.loginUrl, { platform, termux })) {
    if (await spawnImpl(command, args)) return { opened: true, url: details.loginUrl, command };
  }
  return { opened: false, url: details.loginUrl, command: '' };
}

async function chooseBrowser({ argv, detected, interactive }) {
  const requested = optionValue(argv, '--browser');
  const profile = optionValue(argv, '--profile');
  const withProfile = (browser) => (profile && !browser.includes(':') ? `${browser}:${profile}` : browser);
  if (requested) {
    const base = requested.split(':', 1)[0].toLowerCase();
    const requestedSpec = withProfile(requested);
    const detectedSpec = requested.includes(':') || profile
      ? requestedSpec
      : detected.find((candidate) => candidate === base || candidate.startsWith(`${base}:`)) || requestedSpec;
    if (!detected.some((candidate) => candidate === base || candidate.startsWith(`${base}:`))) {
      console.warn(`${BROWSER_LABELS[base] || base} was not detected in local profiles; YTConv will still try to open it.`);
    }
    return detectedSpec;
  }
  if (!detected.length) {
    throw new Error('No desktop browser was detected. Install Chrome, Edge, Firefox, Brave, or another supported browser.');
  }
  if (!interactive || detected.length === 1) return withProfile(detected[0]);

  console.log('\nChoose the browser where the account will sign in:');
  detected.forEach((browserSpec, index) => {
    const { browser, profile: detectedProfile } = splitBrowserSpec(browserSpec);
    console.log(`  ${index + 1}. ${BROWSER_LABELS[browser] || browser}${detectedProfile ? ` · ${detectedProfile}` : ''}`);
  });
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await prompt.question('Choice [1]: ')).trim();
    const index = answer ? Number.parseInt(answer, 10) - 1 : 0;
    if (!Number.isInteger(index) || !detected[index]) throw new Error('Invalid browser choice.');
    return withProfile(detected[index]);
  } finally {
    prompt.close();
  }
}

function socialHelpText() {
  return [
    'Official social-media login:',
    '  ytconv login instagram',
    '  ytconv login facebook --browser edge',
    '  ytconv login x --browser "chrome:Profile 1"',
    '  ytconv social status',
    '  ytconv logout instagram',
    '  ytconv social logout --all',
    '',
    `Supported: ${SOCIAL_LOGIN_PROVIDERS.join(', ')}`,
    '',
    'YTConv does not store passwords or raw cookies. Sessions remain in the browser',
    'under browser/OS encryption; YTConv stores only the browser/profile reference.',
  ].join('\n');
}

async function completeSocialLogin({
  provider,
  argv,
  homeDirectory,
  interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY),
  detectBrowsersImpl = detectSystemBrowsers,
  detectBrowserProfilesImpl = detectBrowserProfileSpecs,
  openLoginImpl = openOfficialSocialLogin,
} = {}) {
  const details = socialProviderDetails(provider);
  if (!details) throw new Error(`Unknown social provider. Choose: ${SOCIAL_LOGIN_PROVIDERS.join(', ')}`);
  if (process.env.TERMUX_VERSION) {
    throw new Error('Android isolates browser databases from Termux. Automatic browser login is available on Windows, macOS, and desktop Linux.');
  }

  const detectedBrowsers = await detectBrowsersImpl();
  const detectedProfiles = await detectBrowserProfilesImpl({ browsers: detectedBrowsers });
  const detected = detectedProfiles.length ? detectedProfiles : detectedBrowsers;
  const browserSpec = await chooseBrowser({ argv, detected, interactive });
  const opened = argv.includes('--no-open')
    ? { opened: false, url: details.loginUrl }
    : await openLoginImpl({ provider: details.key, browserSpec });

  console.log(`\nThe official ${details.label} login page is open:`);
  console.log(opened.url);
  console.log(`Browser YTConv will use: ${browserSpec}`);
  console.log('Complete sign-in, including OTP/2FA if the site requests it.');

  if (interactive && !argv.includes('--no-wait')) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      await prompt.question('After the account is signed in, return here and press Enter... ');
    } finally {
      prompt.close();
    }
  }

  const linked = await linkSocialSession({ provider: details.key, browserSpec, homeDirectory });
  console.log(`\n✓ ${details.label} is linked to YTConv on this device.`);
  console.log('Cookies remain in the browser and are not sent to a YTConv server.');
  console.log(`Saved reference: ${linked.target}`);
  console.log(`Try a download: ytconv download "${details.key.toUpperCase()}_URL"`);
  return { exitCode: 0, ...linked };
}

export function isSocialAuthenticationFailure(error) {
  const value = error instanceof Error ? error.message : String(error || '');
  if (/(?:dns|enotfound|econnreset|network|timed? out|timeout|certificate|proxy|429|too many requests|requested format is not available)/iu.test(value)) {
    return false;
  }
  return /(?:login|log in|sign in|authentication|cookies?|private|not authorized|members[ -]?only|age[ -]?restricted|no video formats found|empty media|returned no file)/iu.test(value);
}

export function supportsAutomaticSocialLogin({
  platform = process.platform,
  termux = Boolean(process.env.TERMUX_VERSION),
} = {}) {
  return !termux && ['win32', 'darwin', 'linux', 'freebsd', 'openbsd'].includes(platform);
}

export async function beginSocialLoginHandoff({
  url = '',
  provider = '',
  browserSpec = '',
  homeDirectory,
  detectBrowsersImpl = detectSystemBrowsers,
  detectBrowserProfilesImpl = detectBrowserProfileSpecs,
  openLoginImpl = openOfficialSocialLogin,
} = {}) {
  const details = socialProviderDetails(provider || detectSocialPlatform(url));
  if (!details) return null;
  if (!supportsAutomaticSocialLogin()) {
    throw new Error('This device isolates browser sessions from terminal apps. YTConv cannot claim that a mobile browser login is readable.');
  }

  const existing = await socialSessionForProvider(details.key, { homeDirectory });
  const detectedBrowsers = await detectBrowsersImpl();
  const detectedSpecs = await detectBrowserProfilesImpl({ browsers: detectedBrowsers });
  const preferredSpecs = [...detectedSpecs].sort((left, right) => {
    const leftFirefox = left.startsWith('firefox:') || left === 'firefox' ? 1 : 0;
    const rightFirefox = right.startsWith('firefox:') || right === 'firefox' ? 1 : 0;
    return rightFirefox - leftFirefox;
  });
  const alternatives = [...new Set([
    ...preferredSpecs,
    existing?.browserSpec,
    ...detectedBrowsers,
  ].filter(Boolean))];
  const selected = browserSpec || alternatives[0];
  if (!selected) {
    throw new Error('No supported desktop browser profile was detected. Install or open Chrome, Edge, Firefox, Brave, or another supported browser first.');
  }

  const opened = await openLoginImpl({ provider: details.key, browserSpec: selected });
  if (!opened.opened) {
    throw new Error(`YTConv could not open the official ${details.label} login page. Open ${details.loginUrl} manually, then retry.`);
  }

  return {
    provider: details.key,
    label: details.label,
    loginUrl: details.loginUrl,
    browserSpec: selected,
    alternatives,
    cookieConfig: {
      kind: 'browser',
      browser: splitBrowserSpec(selected).browser,
      spec: selected,
      provider: details.key,
      linked: false,
      label: `official ${details.label} login · ${selected}`,
    },
  };
}

export async function confirmSocialLoginHandoff(handoff, { homeDirectory } = {}) {
  if (!handoff?.provider || !handoff?.browserSpec) throw new Error('No social-login handoff is waiting for confirmation.');
  return linkSocialSession({
    provider: handoff.provider,
    browserSpec: handoff.browserSpec,
    homeDirectory,
  });
}

export async function recoverSocialLoginInTerminal({
  url,
  error,
  retry,
  interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY),
  homeDirectory,
  waitForConfirmationImpl,
  ...handoffOptions
} = {}) {
  if (!interactive || typeof retry !== 'function' || !isSocialAuthenticationFailure(error)) return null;
  const handoff = await beginSocialLoginHandoff({ url, homeDirectory, ...handoffOptions });
  if (!handoff) return null;

  console.log(`\n${handoff.label} needs a signed-in account for this URL.`);
  console.log(`YTConv opened the official login page in ${handoff.browserSpec}.`);
  console.log('Finish sign-in and any OTP/2FA in the browser. Passwords and OTP codes never enter YTConv.');
  if (waitForConfirmationImpl) await waitForConfirmationImpl();
  else {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      await prompt.question('Return here and press Enter to verify the session and retry... ');
    } finally {
      prompt.close();
    }
  }

  const result = await retry(handoff.cookieConfig);
  await confirmSocialLoginHandoff(handoff, { homeDirectory });
  console.log(`✓ ${handoff.label} session verified. Future matching links will use ${handoff.browserSpec} automatically.`);
  return { handoff, result };
}

async function printSocialStatus({ homeDirectory } = {}) {
  const store = await readSocialSessions({ homeDirectory });
  const sessions = Object.values(store.providers).filter((item) => item?.browserSpec);
  console.log('Social accounts linked on this device');
  if (!sessions.length) {
    console.log('No accounts are linked yet. Example: ytconv login instagram');
    return 0;
  }
  for (const session of sessions.sort((a, b) => a.provider.localeCompare(b.provider))) {
    console.log(`${String(session.label || session.provider).padEnd(22)} ${session.browserSpec} · browser/OS encrypted`);
  }
  console.log('\nYTConv does not store passwords, OTP codes, access tokens, or raw cookies.');
  return 0;
}

function socialCommand(argv = []) {
  const first = String(argv[0] || '').toLowerCase();
  const second = String(argv[1] || '').toLowerCase();
  if (first === 'login' && normalizeSocialProvider(second)) return { action: 'login', provider: second };
  if (first === 'logout' && (normalizeSocialProvider(second) || second === '--all')) {
    return { action: 'logout', provider: second };
  }
  if (first !== 'social' && first !== 'medsos') return null;
  const action = second || 'status';
  if (action === 'login') return { action, provider: argv[2] };
  if (action === 'logout') return { action, provider: argv[2] };
  if (action === 'status' || action === 'list') return { action: 'status' };
  if (['help', '--help', '-h'].includes(action)) return { action: 'help' };
  return { action: 'unknown' };
}

export async function handleSocialAuthCommand(argv = [], options = {}) {
  const command = socialCommand(argv);
  if (!command) return { handled: false, exitCode: 0 };
  if (command.action === 'help') {
    console.log(socialHelpText());
    return { handled: true, action: 'help', exitCode: 0 };
  }
  if (command.action === 'status') {
    return { handled: true, action: 'status', exitCode: await printSocialStatus(options) };
  }
  if (command.action === 'login') {
    const result = await completeSocialLogin({ ...options, provider: command.provider, argv });
    return { handled: true, action: 'login', exitCode: result.exitCode, session: result.session };
  }
  if (command.action === 'logout') {
    const all = command.provider === '--all' || argv.includes('--all');
    await unlinkSocialSession({ ...options, provider: command.provider, all });
    console.log(all ? 'All social-account links were removed from YTConv.' : `${socialProviderDetails(command.provider)?.label || command.provider} was unlinked from YTConv.`);
    console.log('The browser session was not deleted. Sign out from the site directly in the browser.');
    return { handled: true, action: 'logout', exitCode: 0 };
  }
  console.error(socialHelpText());
  return { handled: true, action: 'unknown', exitCode: 2 };
}

export { socialHelpText };
