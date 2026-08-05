import fs from 'node:fs/promises';
import path from 'node:path';
import { walk, relative } from './fs-utils.js';

const detectors = [
  {
    type: 'npm',
    names: new Set(['package.json']),
    detect(content) {
      try {
        const parsed = JSON.parse(content);
        return typeof parsed.version === 'string' ? parsed.version : null;
      } catch { return null; }
    }
  },
  {
    type: 'npm-lock',
    names: new Set(['package-lock.json', 'npm-shrinkwrap.json']),
    detect(content) {
      try {
        const parsed = JSON.parse(content);
        return typeof parsed.version === 'string' ? parsed.version : parsed.packages?.['']?.version ?? null;
      } catch { return null; }
    }
  },
  {
    type: 'cargo',
    names: new Set(['Cargo.toml']),
    detect(content) {
      return /^version\s*=\s*["']([^"']+)["']/mu.exec(content)?.[1] ?? null;
    }
  },
  {
    type: 'python',
    names: new Set(['pyproject.toml']),
    detect(content) {
      return /^version\s*=\s*["']([^"']+)["']/mu.exec(content)?.[1] ?? null;
    }
  },
  {
    type: 'android-gradle',
    names: new Set(['build.gradle', 'build.gradle.kts']),
    detect(content) {
      return /versionName\s*(?:=\s*)?["']([^"']+)["']/u.exec(content)?.[1] ?? null;
    }
  },
  {
    type: 'snap',
    names: new Set(['snapcraft.yaml', 'snapcraft.yml']),
    detect(content) {
      return /^version:\s*["']?([^\s"']+)["']?/mu.exec(content)?.[1] ?? null;
    }
  },
  {
    type: 'alpine',
    names: new Set(['APKBUILD']),
    detect(content) {
      return /^pkgver=([^\s#]+)/mu.exec(content)?.[1] ?? null;
    }
  }
];

export async function scanProject(cwd) {
  const files = await walk(cwd);
  const found = [];
  for (const file of files) {
    const name = path.basename(file);
    for (const detector of detectors) {
      if (!detector.names.has(name)) continue;
      const content = await fs.readFile(file, 'utf8');
      const version = detector.detect(content);
      if (version) found.push({ type: detector.type, path: relative(cwd, file), absolute: file, version });
    }
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}
