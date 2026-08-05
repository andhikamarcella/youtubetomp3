import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function pathEntries(env = process.env) {
  const value = env.PATH || env.Path || env.path || '';
  return String(value).split(path.delimiter).map((entry) => entry.trim()).filter(Boolean);
}

function executableExtensions(candidate, { platform = process.platform, env = process.env } = {}) {
  if (platform !== 'win32' || path.extname(candidate)) return [''];
  const value = env.PATHEXT || '.COM;.EXE;.BAT;.CMD';
  return String(value).split(';').map((entry) => entry.trim()).filter(Boolean);
}

async function verifiedFile(candidate, platform) {
  try {
    const stats = await fs.stat(candidate);
    if (!stats.isFile()) return '';
    if (platform !== 'win32') await fs.access(candidate, fsConstants.X_OK);
    return candidate;
  } catch {
    return '';
  }
}

export async function resolveExecutable(candidates, {
  platform = process.platform,
  env = process.env,
  cwd = process.cwd(),
} = {}) {
  const names = Array.isArray(candidates) ? candidates : [candidates];
  for (const rawName of names) {
    const name = String(rawName || '').trim();
    if (!name) continue;
    const hasSeparator = name.includes('/') || name.includes('\\');
    if (path.isAbsolute(name) || hasSeparator) {
      const direct = await verifiedFile(path.resolve(cwd, name), platform);
      if (direct) return direct;
      continue;
    }
    for (const directory of pathEntries(env)) {
      for (const extension of executableExtensions(name, { platform, env })) {
        const resolved = await verifiedFile(path.join(directory, `${name}${extension}`), platform);
        if (resolved) return resolved;
      }
    }
  }
  return null;
}
