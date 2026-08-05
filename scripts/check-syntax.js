import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['bin', 'src', 'test', 'scripts'];
const files = [];

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(absolute);
  }
}

for (const root of roots) {
  try {
    await walk(root);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit',
    shell: false,
    windowsHide: true
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
