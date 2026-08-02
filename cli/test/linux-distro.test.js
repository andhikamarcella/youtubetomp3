import test from 'node:test';
import assert from 'node:assert/strict';
import { installPlanFor, packageManagerFor, parseOsRelease } from '../src/linux-distro.js';

test('parses quoted os-release data', () => {
  const value = parseOsRelease('ID="ubuntu"\nID_LIKE="debian"\nPRETTY_NAME="Ubuntu 24.04 LTS"\n');
  assert.equal(value.ID, 'ubuntu');
  assert.equal(value.ID_LIKE, 'debian');
  assert.equal(value.PRETTY_NAME, 'Ubuntu 24.04 LTS');
});

test('maps major distro families to their package managers', () => {
  assert.equal(packageManagerFor({ id: 'ubuntu', idLike: 'debian' }), 'apt');
  assert.equal(packageManagerFor({ id: 'fedora' }), 'dnf');
  assert.equal(packageManagerFor({ id: 'cachyos', idLike: 'arch' }), 'pacman');
  assert.equal(packageManagerFor({ id: 'opensuse-tumbleweed', idLike: 'suse' }), 'zypper');
  assert.equal(packageManagerFor({ id: 'alpine' }), 'apk');
  assert.equal(packageManagerFor({ id: 'void' }), 'xbps');
  assert.equal(packageManagerFor({ id: 'gentoo' }), 'emerge');
  assert.equal(packageManagerFor({ id: 'nixos' }), 'nix');
});

test('prefers an actually available package manager', () => {
  assert.equal(packageManagerFor({ id: 'unknown', available: ['pacman'] }), 'pacman');
  assert.equal(packageManagerFor({ id: 'unknown', available: ['brew'] }), 'brew');
});

test('install plans include Node, Python, and FFmpeg where applicable', () => {
  assert.match(installPlanFor('apt'), /nodejs/u);
  assert.match(installPlanFor('apt'), /python3/u);
  assert.match(installPlanFor('apt'), /ffmpeg/u);
  assert.match(installPlanFor('pacman'), /ffmpeg/u);
  assert.match(installPlanFor('nix'), /nodejs_22/u);
});
