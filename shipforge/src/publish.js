import fs from 'node:fs/promises';
import path from 'node:path';
import { run } from './process.js';

async function collectAssets(cwd, paths) {
  const assets = [];
  for (const item of paths ?? []) {
    const absolute = path.resolve(cwd, item);
    try {
      const stat = await fs.stat(absolute);
      if (stat.isFile()) assets.push(absolute);
      else if (stat.isDirectory()) {
        const entries = await fs.readdir(absolute, { withFileTypes: true });
        for (const entry of entries) if (entry.isFile()) assets.push(path.join(absolute, entry.name));
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  return assets.sort();
}

export async function publishNpm(cwd, config, options = {}) {
  const npmDirectory = path.resolve(cwd, config.npm?.directory ?? '.');
  const args = ['publish', '--access', 'public', '--tag', config.npm?.tag ?? 'latest', '--provenance'];
  if (options.dryRun) args.push('--dry-run');
  return run('npm', args, { cwd: npmDirectory });
}

export async function publishGitHub(cwd, version, config, options = {}) {
  const tag = `${config.tagPrefix ?? 'v'}${version}`;
  const repositoryArgs = config.github?.repository ? ['--repo', config.github.repository] : [];
  const existing = await run('gh', ['release', 'view', tag, ...repositoryArgs], { cwd, capture: true, allowFailure: true });
  const assets = await collectAssets(cwd, config.releaseAssets);
  const createOptions = [...repositoryArgs, '--title', `Release ${tag}`, '--generate-notes'];
  const editOptions = [...repositoryArgs, '--title', `Release ${tag}`];
  if (config.github?.draft) { createOptions.push('--draft'); editOptions.push('--draft'); }
  if (config.github?.prerelease) { createOptions.push('--prerelease'); editOptions.push('--prerelease'); }

  if (options.dryRun) {
    return { code: 0, stdout: `Would ${existing.code === 0 ? 'update' : 'create'} ${tag} with ${assets.length} assets.`, stderr: '' };
  }
  if (existing.code === 0) {
    await run('gh', ['release', 'edit', tag, ...editOptions], { cwd });
    if (assets.length) await run('gh', ['release', 'upload', tag, ...assets, '--clobber', ...repositoryArgs], { cwd });
  } else {
    await run('gh', ['release', 'create', tag, ...assets, ...createOptions], { cwd });
  }
  return { code: 0, stdout: `Published GitHub Release ${tag}.`, stderr: '' };
}

export async function verifyNpm(cwd, packageName, version) {
  const result = await run('npm', ['view', `${packageName}@${version}`, 'version', '--json'], { cwd, capture: true, allowFailure: true });
  return { ok: result.code === 0 && result.stdout.replace(/["\s]/gu, '') === version, output: result.stdout || result.stderr };
}

export async function verifyGitHub(cwd, version, config) {
  const tag = `${config.tagPrefix ?? 'v'}${version}`;
  const args = ['release', 'view', tag, '--json', 'tagName,isDraft,isPrerelease,url'];
  if (config.github?.repository) args.push('--repo', config.github.repository);
  const result = await run('gh', args, { cwd, capture: true, allowFailure: true });
  return { ok: result.code === 0, output: result.stdout || result.stderr };
}
