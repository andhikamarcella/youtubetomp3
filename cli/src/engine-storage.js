import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const MAX_BINARY_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function engineDirectory({
  environment = process.env,
  homeDirectory = os.homedir(),
} = {}) {
  const configured = String(environment.YTCONV_ENGINE_DIR || '').trim();
  return path.resolve(configured || path.join(homeDirectory, '.ytconv', 'engines'));
}

export function enginePath(name, options = {}) {
  if (!/^[A-Za-z0-9_.-]+$/u.test(String(name || ''))) {
    throw new Error('An engine filename may contain only letters, numbers, dots, dashes, and underscores.');
  }
  return path.join(engineDirectory(options), name);
}

export async function engineFileStatus(filePath, {
  minimumBytes = 1,
  maximumAgeMs = MAX_BINARY_AGE_MS,
} = {}) {
  try {
    const stats = await fs.stat(filePath);
    const secureMode = process.platform === 'win32' || (stats.mode & 0o022) === 0;
    return {
      valid: stats.isFile() && stats.size >= minimumBytes && secureMode,
      fresh: Date.now() - stats.mtimeMs < maximumAgeMs,
      size: stats.size,
      secureMode,
    };
  } catch {
    return { valid: false, fresh: false, size: 0, secureMode: false };
  }
}
