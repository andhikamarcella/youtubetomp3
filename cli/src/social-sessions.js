import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { detectSocialPlatform, socialPlatformLabel } from './social-platforms.js';

const SCHEMA_VERSION = 1;

const PROVIDERS = Object.freeze({
  youtube: { label: 'YouTube / Google', loginUrl: 'https://accounts.google.com/ServiceLogin?service=youtube' },
  instagram: { label: 'Instagram', loginUrl: 'https://www.instagram.com/accounts/login/' },
  facebook: { label: 'Facebook', loginUrl: 'https://www.facebook.com/login/' },
  tiktok: { label: 'TikTok', loginUrl: 'https://www.tiktok.com/login' },
  x: { label: 'X / Twitter', loginUrl: 'https://x.com/i/flow/login' },
  pinterest: { label: 'Pinterest', loginUrl: 'https://www.pinterest.com/login/' },
  reddit: { label: 'Reddit', loginUrl: 'https://www.reddit.com/login/' },
  threads: { label: 'Threads / Instagram', loginUrl: 'https://www.threads.com/login' },
  twitch: { label: 'Twitch', loginUrl: 'https://www.twitch.tv/login' },
  soundcloud: { label: 'SoundCloud', loginUrl: 'https://soundcloud.com/signin' },
  vimeo: { label: 'Vimeo', loginUrl: 'https://vimeo.com/log_in' },
  tumblr: { label: 'Tumblr', loginUrl: 'https://www.tumblr.com/login' },
  flickr: { label: 'Flickr', loginUrl: 'https://identity.flickr.com/login' },
  pixiv: { label: 'Pixiv', loginUrl: 'https://accounts.pixiv.net/login' },
});

const ALIASES = Object.freeze({
  twitter: 'x',
  google: 'youtube',
  yt: 'youtube',
  fb: 'facebook',
  ig: 'instagram',
});

export const SOCIAL_LOGIN_PROVIDERS = Object.freeze(Object.keys(PROVIDERS));

export function normalizeSocialProvider(value = '') {
  const normalized = String(value).trim().toLowerCase();
  const provider = ALIASES[normalized] || normalized;
  return provider in PROVIDERS ? provider : '';
}

export function socialProviderDetails(value = '') {
  const provider = normalizeSocialProvider(value);
  if (!provider) return null;
  return { key: provider, ...PROVIDERS[provider] };
}

export function socialSessionPaths(homeDirectory = os.homedir()) {
  const directory = path.join(homeDirectory, '.ytconv');
  return {
    directory,
    sessions: path.join(directory, 'social-sessions.json'),
  };
}

function emptyStore() {
  return { schemaVersion: SCHEMA_VERSION, providers: {} };
}

export async function readSocialSessions({ homeDirectory = os.homedir() } = {}) {
  try {
    const payload = JSON.parse(await fs.readFile(socialSessionPaths(homeDirectory).sessions, 'utf8'));
    return {
      schemaVersion: SCHEMA_VERSION,
      providers: payload?.providers && typeof payload.providers === 'object' ? payload.providers : {},
    };
  } catch {
    return emptyStore();
  }
}

export async function writeSocialSessions(value, { homeDirectory = os.homedir() } = {}) {
  const target = socialSessionPaths(homeDirectory);
  await fs.mkdir(target.directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') await fs.chmod(target.directory, 0o700).catch(() => {});
  const temporary = `${target.sessions}.${process.pid}.${randomUUID()}.tmp`;
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    providers: value?.providers && typeof value.providers === 'object' ? value.providers : {},
  };
  await fs.writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  try {
    await fs.rename(temporary, target.sessions);
    if (process.platform !== 'win32') await fs.chmod(target.sessions, 0o600).catch(() => {});
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
  return target.sessions;
}

function normalizeBrowserSpec(browserSpec = '') {
  const spec = String(browserSpec).trim();
  if (!/^[a-z0-9-]+(?::[^,\r\n]{1,160})?$/iu.test(spec)) {
    throw new Error('Browser must be chrome, edge, firefox, or browser:profile.');
  }
  const separator = spec.indexOf(':');
  if (separator < 0) return spec.toLowerCase();
  return `${spec.slice(0, separator).toLowerCase()}:${spec.slice(separator + 1)}`;
}

export async function linkSocialSession({
  provider,
  browserSpec,
  sessionMode = 'browser-profile',
  verified = false,
  homeDirectory = os.homedir(),
} = {}) {
  const details = socialProviderDetails(provider);
  if (!details) throw new Error(`Unknown social provider: ${provider || '-'}.`);
  const spec = normalizeBrowserSpec(browserSpec);
  const store = await readSocialSessions({ homeDirectory });
  store.providers[details.key] = {
    provider: details.key,
    label: details.label,
    browserSpec: spec,
    linkedAt: new Date().toISOString(),
    sessionMode,
    verifiedAt: verified ? new Date().toISOString() : null,
    storage: 'browser-os-encrypted',
  };
  const target = await writeSocialSessions(store, { homeDirectory });
  return { session: store.providers[details.key], target };
}

export async function unlinkSocialSession({
  provider,
  all = false,
  homeDirectory = os.homedir(),
} = {}) {
  const store = await readSocialSessions({ homeDirectory });
  if (all) store.providers = {};
  else {
    const normalized = normalizeSocialProvider(provider);
    if (!normalized) throw new Error('Specify the social provider to unlink, for example: ytconv logout instagram');
    delete store.providers[normalized];
  }
  await writeSocialSessions(store, { homeDirectory });
  return store;
}

export async function socialSessionForUrl(url, { homeDirectory = os.homedir() } = {}) {
  const provider = detectSocialPlatform(url);
  if (!(provider in PROVIDERS)) return null;
  const store = await readSocialSessions({ homeDirectory });
  const session = store.providers[provider];
  return session?.browserSpec ? session : null;
}

export async function socialSessionForProvider(provider, options = {}) {
  const normalized = normalizeSocialProvider(provider);
  if (!normalized) return null;
  const store = await readSocialSessions(options);
  return store.providers[normalized] || null;
}

export function socialLoginHint(value = '') {
  const provider = normalizeSocialProvider(value) || detectSocialPlatform(value);
  if (!(provider in PROVIDERS)) return '';
  return `Official ${socialPlatformLabel(provider)} login: ytconv login ${provider}`;
}
