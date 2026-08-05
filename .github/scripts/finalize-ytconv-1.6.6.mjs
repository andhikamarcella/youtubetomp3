import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const releaseBranch = 'release/ytconv-1.6.6-socket-hardening';

async function filesUnder(relativeDirectory) {
  const output = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) output.push(target);
    }
  }
  await visit(path.join(root, relativeDirectory));
  return output;
}

async function rewrite(absolutePath) {
  let before;
  try {
    before = await fs.readFile(absolutePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  const after = before
    .replaceAll('release/ytconv-1.6.6-packages', releaseBranch)
    .replaceAll('release\\/ytconv-1\\.6\\.5-packages', 'release\\/ytconv-1\\.6\\.6-socket-hardening')
    .replaceAll('1\\.6\\.5', '1\\.6\\.6');
  if (after !== before) await fs.writeFile(absolutePath, after, 'utf8');
}

const directories = [
  'cli/src', 'cli/bin', 'cli/scripts', 'cli/ish', 'cli/test', 'cli/docs',
  'packaging', 'android-app',
];
for (const directory of directories) {
  for (const file of await filesUnder(directory)) await rewrite(file);
}
for (const relative of [
  'cli/package.json', 'cli/README.md', 'cli/SECURITY.md', 'flake.nix',
  '.github/workflows/ytconv-cli.yml', '.github/workflows/ytconv-packages.yml',
]) {
  await rewrite(path.join(root, relative));
}

console.log('Finalized YTConv 1.6.6 release links and escaped assertions.');
