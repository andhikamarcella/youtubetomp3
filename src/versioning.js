import fs from 'node:fs/promises';
import path from 'node:path';
import { assertSemver, androidVersionCode } from './semver.js';
import { scanProject } from './scanner.js';
import { atomicWrite } from './fs-utils.js';

function updateJson(content, version, file) {
  const parsed = JSON.parse(content);
  parsed.version = version;
  if (path.basename(file) === 'package-lock.json') {
    if (parsed.packages?.['']) parsed.packages[''].version = version;
  }
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function replaceOne(content, pattern, replacement, label) {
  if (!pattern.test(content)) throw new Error(`Cannot locate ${label}`);
  return content.replace(pattern, replacement);
}

export async function updateVersionFile(entry, version) {
  const content = await fs.readFile(entry.absolute, 'utf8');
  switch (entry.type) {
    case 'npm':
    case 'npm-lock':
      return updateJson(content, version, entry.absolute);
    case 'cargo':
    case 'python':
      return replaceOne(content, /^version\s*=\s*["'][^"']+["']/mu, `version = "${version}"`, 'version field');
    case 'android-gradle': {
      const kotlinStyle = entry.absolute.endsWith('.kts') || /versionName\s*=\s*["']/u.test(content);
      const versionName = kotlinStyle ? `versionName = "${version}"` : `versionName "${version}"`;
      const versionCode = kotlinStyle ? `versionCode = ${androidVersionCode(version)}` : `versionCode ${androidVersionCode(version)}`;
      let next = replaceOne(content, /versionName\s*(?:=\s*)?["'][^"']+["']/u, versionName, 'Android versionName');
      if (/versionCode\s*(?:=\s*)?\d+/u.test(next)) {
        next = next.replace(/versionCode\s*(?:=\s*)?\d+/u, versionCode);
      }
      return next;
    }
    case 'snap':
      return replaceOne(content, /^version:\s*.*$/mu, `version: '${version}'`, 'Snap version');
    case 'alpine':
      return replaceOne(content, /^pkgver=.*$/mu, `pkgver=${version}`, 'Alpine pkgver');
    default:
      throw new Error(`Unsupported version file type: ${entry.type}`);
  }
}

export async function updateProjectVersion(cwd, version, options = {}) {
  assertSemver(version);
  const entries = await scanProject(cwd);
  const changed = [];
  for (const entry of entries) {
    if (entry.version === version) continue;
    const next = await updateVersionFile(entry, version);
    changed.push({ ...entry, from: entry.version, to: version });
    if (options.write) await atomicWrite(entry.absolute, next);
  }
  return changed;
}
