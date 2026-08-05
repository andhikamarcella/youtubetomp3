import fs from 'node:fs/promises';
import path from 'node:path';

const SKIP = new Set(['.git', 'node_modules', '.next', '.cache', 'coverage', 'vendor']);

export async function walk(root, options = {}) {
  const maxDepth = options.maxDepth ?? 6;
  const results = [];

  async function visit(directory, depth) {
    if (depth > maxDepth) return;
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, depth + 1);
      else if (entry.isFile()) results.push(absolute);
    }
  }

  await visit(root, 0);
  return results;
}

export function relative(cwd, file) {
  return path.relative(cwd, file).split(path.sep).join('/');
}

export async function atomicWrite(file, content) {
  const temporary = `${file}.shipforge-tmp-${process.pid}`;
  await fs.writeFile(temporary, content, 'utf8');
  await fs.rename(temporary, file);
}
