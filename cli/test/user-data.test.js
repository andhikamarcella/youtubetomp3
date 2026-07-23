import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  appendHistory,
  handleUserDataCommand,
  readHistory,
  readUserConfig,
  resolveUserArguments,
  settingsToArgs,
  userDataPaths,
  validateSettings,
  writeUserConfig,
} from '../src/user-data.js';

async function temporaryHome() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-user-data-'));
}

test('validates settings and converts them to CLI arguments', () => {
  const settings = validateSettings({
    preset: 'music',
    audioQuality: '320',
    subtitles: 'false',
    sponsorBlock: 'mark',
    concurrentFragments: '4',
  });
  assert.equal(settings.subtitles, false);
  assert.deepEqual(settingsToArgs(settings), [
    '--preset', 'music', '--audio-quality', '320', '--no-subtitles',
    '--sponsorblock', 'mark', '--concurrent-fragments', '4',
  ]);
});

test('saved defaults and profiles are prepended while explicit options remain last', async () => {
  const homeDirectory = await temporaryHome();
  await writeUserConfig({
    schemaVersion: 1,
    defaults: { preset: 'music', audioQuality: '320' },
    activeProfile: 'mobile',
    profiles: { mobile: { settings: { preset: 'mobile', resolution: '720' } } },
  }, { homeDirectory });

  const resolved = await resolveUserArguments([
    'download', 'https://example.com/video', '--resolution', '1080',
  ], { homeDirectory });
  assert.equal(resolved.profile, 'mobile');
  assert.deepEqual(resolved.args.slice(-3), ['https://example.com/video', '--resolution', '1080']);
  assert.ok(resolved.args.includes('--preset'));
  await fs.rm(homeDirectory, { recursive: true, force: true });
});

test('--profile selects one profile and --no-config disables all saved settings', async () => {
  const homeDirectory = await temporaryHome();
  await writeUserConfig({
    schemaVersion: 1,
    defaults: { preset: 'music' },
    activeProfile: '',
    profiles: { hd: { settings: { preset: 'hd' } } },
  }, { homeDirectory });
  const selected = await resolveUserArguments(['--profile', 'hd', 'https://example.com/a'], { homeDirectory });
  assert.equal(selected.profile, 'hd');
  assert.deepEqual(selected.args.slice(0, 2), ['--preset', 'hd']);
  const clean = await resolveUserArguments(['--no-config', 'https://example.com/a'], { homeDirectory });
  assert.deepEqual(clean.args, ['https://example.com/a']);
  await fs.rm(homeDirectory, { recursive: true, force: true });
});

test('config and profile commands persist validated data', async () => {
  const homeDirectory = await temporaryHome();
  assert.equal((await handleUserDataCommand(['config', 'set', 'preset', 'music'], { homeDirectory })).exitCode, 0);
  assert.equal((await handleUserDataCommand(['profile', 'set', 'phone', 'preset=mobile', 'resolution=720'], { homeDirectory })).exitCode, 0);
  assert.equal((await handleUserDataCommand(['profile', 'use', 'phone'], { homeDirectory })).exitCode, 0);
  const config = await readUserConfig({ homeDirectory });
  assert.equal(config.defaults.preset, 'music');
  assert.equal(config.activeProfile, 'phone');
  assert.equal(config.profiles.phone.settings.resolution, '720');
  await fs.rm(homeDirectory, { recursive: true, force: true });
});

test('history excludes credentials and can be cleared', async () => {
  const homeDirectory = await temporaryHome();
  await appendHistory({
    version: '1.5.0-beta.2', command: 'download', urls: ['https://example.com/a'],
    preset: 'music', mode: 'audio', outputDirectory: '/tmp/out', profile: 'music', exitCode: 0,
    cookies: 'secret', token: 'secret',
  }, { homeDirectory });
  const rows = await readHistory({ homeDirectory, limit: 10 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cookies, undefined);
  assert.equal(rows[0].token, undefined);
  assert.equal(rows[0].profile, 'music');
  await handleUserDataCommand(['history', 'clear'], { homeDirectory });
  assert.deepEqual(await readHistory({ homeDirectory }), []);
  await fs.rm(homeDirectory, { recursive: true, force: true });
});

test('completion supports common shells and config path stays under the app directory', async () => {
  const homeDirectory = await temporaryHome();
  const paths = userDataPaths(homeDirectory);
  assert.equal(paths.config, path.join(homeDirectory, '.ytconv', 'config.json'));
  for (const shell of ['bash', 'zsh', 'fish', 'powershell']) {
    const result = await handleUserDataCommand(['completion', shell], { homeDirectory });
    assert.equal(result.handled, true);
    assert.equal(result.exitCode, 0);
  }
  await fs.rm(homeDirectory, { recursive: true, force: true });
});
