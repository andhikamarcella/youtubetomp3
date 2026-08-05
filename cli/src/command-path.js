import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function pathImplementation(platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

function windowsExtensions(environment) {
  const configured = String(environment.PATHEXT || '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.startsWith('.') ? value : `.${value}`);
  return unique(['', ...configured, ...configured.map((value) => value.toLowerCase())]);
}

async function executableFile(candidate, platform) {
  try {
    const stats = await fs.stat(candidate);
    if (!stats.isFile()) return false;
    if (platform === 'win32') return true;
    await fs.access(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function candidateNames(name, platform, environment, pathApi) {
  if (platform !== 'win32' || pathApi.extname(name)) return [name];
  return windowsExtensions(environment).map((extension) => `${name}${extension}`);
}

export async function resolveCommandPath(names, {
  environment = process.env,
  platform = process.platform,
  currentDirectory = process.cwd(),
} = {}) {
  const requested = Array.isArray(names) ? names : [names];
  const pathApi = pathImplementation(platform);
  const delimiter = platform === 'win32' ? ';' : ':';
  const searchPath = String(environment.PATH || environment.Path || environment.path || '');
  const directories = unique(searchPath.split(delimiter).map((directory) => directory.trim()).filter(Boolean));

  for (const rawName of requested) {
    const name = String(rawName || '').trim();
    if (!name || name.includes('\0')) continue;
    const explicitPath = pathApi.isAbsolute(name) || name.includes('/') || name.includes('\\');
    const bases = explicitPath ? [''] : directories;
    for (const base of bases) {
      for (const candidateName of candidateNames(name, platform, environment, pathApi)) {
        const candidate = explicitPath
          ? pathApi.resolve(currentDirectory, candidateName)
          : pathApi.join(base, candidateName);
        if (await executableFile(candidate, platform)) return candidate;
      }
    }
  }
  return null;
}
