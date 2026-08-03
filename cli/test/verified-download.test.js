import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { ytDlpReleaseAsset } from '../src/binaries.js';
import {
  downloadVerifiedGitHubAsset,
  releaseAssetDigest,
  verifyReleaseAssetBuffer,
} from '../src/verified-download.js';

function digest(data) {
  return `sha256:${createHash('sha256').update(data).digest('hex')}`;
}

test('release assets require a valid SHA-256 digest and exact size', () => {
  const data = Buffer.from('verified engine');
  const asset = { name: 'engine', size: data.length, digest: digest(data) };
  assert.equal(releaseAssetDigest(asset), asset.digest.slice('sha256:'.length));
  assert.equal(verifyReleaseAssetBuffer(data, asset).data.equals(data), true);
  assert.throws(() => verifyReleaseAssetBuffer(Buffer.from('tampered engine'), asset), /size mismatch|SHA-256 verification/u);
  assert.throws(() => releaseAssetDigest({ name: 'engine' }), /did not provide a SHA-256 digest/u);
});

test('verified download rejects unexpected hosts and writes atomically with private mode', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-verified-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const destination = path.join(directory, 'engine');
  const data = Buffer.from('verified executable');
  const asset = {
    name: 'engine',
    size: data.length,
    digest: digest(data),
    browser_download_url: 'https://github.com/example/tools/releases/download/v1/engine',
  };
  const fetchImpl = async (url) => String(url).includes('/api.github.com/')
    ? new Response(JSON.stringify({ tag_name: 'v1', assets: [asset] }), { status: 200 })
    : new Response(data, { status: 200 });

  const result = await downloadVerifiedGitHubAsset({
    repository: 'example/tools', assetName: 'engine', destination, fetchImpl, silent: true,
  });
  assert.equal(result.path, destination);
  assert.equal((await fs.readFile(destination)).equals(data), true);
  if (process.platform !== 'win32') assert.equal((await fs.stat(destination)).mode & 0o077, 0);

  const malicious = { ...asset, browser_download_url: 'https://example.com/engine' };
  await assert.rejects(
    downloadVerifiedGitHubAsset({
      repository: 'example/tools', assetName: 'engine', destination: `${destination}-bad`, silent: true,
      fetchImpl: async () => new Response(JSON.stringify({ tag_name: 'v1', assets: [malicious] }), { status: 200 }),
    }),
    /unexpected release-asset URL/u,
  );
});

test('yt-dlp maps only official standalone assets for supported platforms', () => {
  assert.equal(ytDlpReleaseAsset({ platform: 'win32', architecture: 'arm64' }), 'yt-dlp_arm64.exe');
  assert.equal(ytDlpReleaseAsset({ platform: 'darwin', architecture: 'arm64' }), 'yt-dlp_macos');
  assert.equal(ytDlpReleaseAsset({ platform: 'linux', architecture: 'x64' }), 'yt-dlp_linux');
  assert.equal(ytDlpReleaseAsset({ platform: 'freebsd', architecture: 'x64' }), null);
});
