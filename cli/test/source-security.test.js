import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return entry.isFile() && /\.(?:js|py|sh|cmd|ps1)$/u.test(entry.name) ? [target] : [];
  });
}

test('runtime avoids shell execution, dynamic evaluation, and remote extractor components', () => {
  const source = ['bin', 'src', 'scripts', 'ish']
    .flatMap((directory) => sourceFiles(path.join(root, directory)))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');
  assert.doesNotMatch(source, /\bshell\s*:\s*true\b/u);
  assert.doesNotMatch(source, /\beval\s*\(|\bnew\s+Function\s*\(/u);
  assert.doesNotMatch(source, /['"]--remote-components['"]/u);
  assert.match(source, /--no-remote-components/u);
});

test('dependency-free terminal UI contains no external styling framework', () => {
  const ui = fs.readFileSync(path.join(root, 'src', 'ui.js'), 'utf8');
  assert.match(ui, /node:readline\/promises/u);
  assert.doesNotMatch(ui, /(?:from|import\s*\()\s*['"](?:ink|react|figlet)/u);
  assert.doesNotMatch(ui, /(?:color|borderColor)\s*:/u);
});

test('GitHub Actions are pinned to full commit SHAs', () => {
  const workflowDirectory = path.resolve(root, '..', '.github', 'workflows');
  for (const name of fs.readdirSync(workflowDirectory).filter((value) => value.endsWith('.yml'))) {
    const workflow = fs.readFileSync(path.join(workflowDirectory, name), 'utf8');
    for (const match of workflow.matchAll(/\buses:\s*([^\s#]+)/gu)) {
      const action = match[1];
      if (action.startsWith('./') || action.startsWith('docker://')) continue;
      assert.match(action, /@[a-f0-9]{40}$/u, `${name}: ${action}`);
    }
  }
});
