import fs from 'node:fs/promises';
import path from 'node:path';

export const CONFIG_NAME = 'shipforge.config.json';

export const defaultConfig = {
  schemaVersion: 1,
  tagPrefix: 'v',
  changelog: 'CHANGELOG.md',
  checksumDirectory: 'dist',
  releaseAssets: ['dist'],
  checks: ['npm test'],
  npm: {
    enabled: true,
    directory: '.',
    tag: 'latest'
  },
  github: {
    enabled: true,
    repository: null,
    draft: false,
    prerelease: false
  }
};

export async function loadConfig(cwd) {
  const file = path.join(cwd, CONFIG_NAME);
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return {
      ...defaultConfig,
      ...parsed,
      npm: { ...defaultConfig.npm, ...(parsed.npm ?? {}) },
      github: { ...defaultConfig.github, ...(parsed.github ?? {}) }
    };
  } catch (error) {
    if (error?.code === 'ENOENT') return structuredClone(defaultConfig);
    throw new Error(`Cannot read ${CONFIG_NAME}: ${error.message}`);
  }
}

export async function writeDefaultConfig(cwd, { force = false } = {}) {
  const file = path.join(cwd, CONFIG_NAME);
  if (!force) {
    try {
      await fs.access(file);
      throw new Error(`${CONFIG_NAME} already exists. Use --force to replace it.`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  await fs.writeFile(file, `${JSON.stringify(defaultConfig, null, 2)}\n`, 'utf8');
  return file;
}
