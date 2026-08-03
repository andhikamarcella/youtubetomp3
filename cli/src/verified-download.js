import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

const SHA256_DIGEST = /^sha256:([a-f0-9]{64})$/iu;
const MAX_RELEASE_ASSET_BYTES = 300 * 1024 * 1024;

export function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function releaseAssetDigest(asset = {}) {
  const match = String(asset.digest || '').match(SHA256_DIGEST);
  if (!match) throw new Error(`GitHub did not provide a SHA-256 digest for ${asset.name || 'the release asset'}.`);
  return match[1].toLowerCase();
}

export function verifyReleaseAssetBuffer(value, asset = {}, {
  minimumBytes = 1,
  maximumBytes = MAX_RELEASE_ASSET_BYTES,
} = {}) {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const declaredSize = Number(asset.size);
  if (data.length < minimumBytes) throw new Error(`${asset.name || 'Release asset'} is incomplete (${data.length} bytes).`);
  if (data.length > maximumBytes) throw new Error(`${asset.name || 'Release asset'} exceeds the ${maximumBytes}-byte safety limit.`);
  if (Number.isFinite(declaredSize) && declaredSize > 0 && data.length !== declaredSize) {
    throw new Error(`${asset.name || 'Release asset'} size mismatch: expected ${declaredSize}, received ${data.length}.`);
  }

  const expected = Buffer.from(releaseAssetDigest(asset), 'hex');
  const actual = createHash('sha256').update(data).digest();
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error(`${asset.name || 'Release asset'} failed SHA-256 verification.`);
  }
  return { data, sha256: actual.toString('hex') };
}

function releaseApiUrl(repository, release) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(String(repository || ''))) {
    throw new Error('A valid GitHub owner/repository is required for an engine download.');
  }
  return release === 'latest'
    ? `https://api.github.com/repos/${repository}/releases/latest`
    : `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(release)}`;
}

function timeoutSignal(milliseconds) {
  if (typeof globalThis.AbortSignal?.timeout === 'function') return globalThis.AbortSignal.timeout(milliseconds);
  return undefined;
}

async function fetchWithRetry(fetchImpl, url, options, {
  attempts = 3,
  label = 'download',
  timeoutMs = 30_000,
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, { ...options, signal: timeoutSignal(timeoutMs) });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim());
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error(`${label} failed after ${attempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export async function fetchGitHubRelease({
  repository,
  release = 'latest',
  fetchImpl = globalThis.fetch,
  timeoutMs = 30_000,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('The Fetch API is unavailable.');
  const response = await fetchWithRetry(fetchImpl, releaseApiUrl(repository, release), {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'ytconv-verified-engine-installer',
    },
  }, { label: 'GitHub release lookup', timeoutMs });
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.assets)) throw new Error('GitHub returned an invalid release response.');
  return payload;
}

function validateAssetUrl(asset, repository) {
  let parsed;
  try { parsed = new URL(asset.browser_download_url); } catch { throw new Error('GitHub returned an invalid release-asset URL.'); }
  const expectedPrefix = `/${repository}/releases/download/`.toLowerCase();
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || !parsed.pathname.toLowerCase().startsWith(expectedPrefix)) {
    throw new Error(`Refusing an unexpected release-asset URL for ${asset.name || 'the selected engine'}.`);
  }
}

export async function downloadVerifiedGitHubAsset({
  repository,
  release = 'latest',
  assetName,
  selectAsset,
  destination,
  minimumBytes = 1,
  executable = true,
  transform = (data) => data,
  maximumOutputBytes = MAX_RELEASE_ASSET_BYTES,
  fetchImpl = globalThis.fetch,
  silent = false,
} = {}) {
  const payload = await fetchGitHubRelease({ repository, release, fetchImpl });
  const assets = payload.assets;
  const asset = typeof selectAsset === 'function'
    ? selectAsset(assets)
    : assets.find((candidate) => candidate.name === assetName);
  if (!asset) throw new Error(`The required release asset ${assetName || ''} was not found in ${repository}.`.trim());
  releaseAssetDigest(asset);
  validateAssetUrl(asset, repository);

  if (!silent) console.log(`YTConv: downloading and verifying ${asset.name}...`);
  const response = await fetchWithRetry(fetchImpl, asset.browser_download_url, {
    redirect: 'follow',
    headers: { accept: 'application/octet-stream', 'user-agent': 'ytconv-verified-engine-installer' },
  }, { label: `${asset.name} download`, timeoutMs: 180_000 });
  const verified = verifyReleaseAssetBuffer(Buffer.from(await response.arrayBuffer()), asset, { minimumBytes });
  const output = Buffer.from(await transform(verified.data, asset));
  if (!output.length) throw new Error(`${asset.name} produced an empty executable.`);
  if (output.length > maximumOutputBytes) throw new Error(`${asset.name} expands beyond the ${maximumOutputBytes}-byte safety limit.`);

  await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temporary = `${destination}.${process.pid}.${randomUUID()}.download`;
  try {
    await fs.writeFile(temporary, output, { mode: executable ? 0o700 : 0o600 });
    if (process.platform !== 'win32') await fs.chmod(temporary, executable ? 0o700 : 0o600);
    await fs.rm(destination, { force: true });
    await fs.rename(temporary, destination);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }

  if (!silent) console.log(`YTConv: ${asset.name} passed SHA-256 verification.`);
  return {
    path: destination,
    asset: asset.name,
    sha256: verified.sha256,
    release: payload.tag_name || release,
    repository,
  };
}
