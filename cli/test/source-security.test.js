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

test('terminal UI uses only the approved identity stack and sanitizes untrusted text', () => {
  const ui = fs.readFileSync(path.join(root, 'src', 'ui.js'), 'utf8');
  const branding = fs.readFileSync(path.join(root, 'src', 'branding.js'), 'utf8');
  const commands = fs.readFileSync(path.join(root, 'src', 'command-program.js'), 'utf8');
  assert.match(ui, /from ['"]react['"]/u);
  assert.match(ui, /from ['"]ink['"]/u);
  assert.match(ui, /sanitizeTerminalText/u);
  assert.match(branding, /from ['"]figlet['"]/u);
  assert.match(commands, /from ['"]commander['"]/u);
  assert.doesNotMatch(`${ui}\n${branding}\n${commands}`, /from ['"](?:chalk|ora|blessed|enquirer|inquirer)['"]/u);
});

test('executable discovery uses which and isexe without enabling a shell', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'command-path.js'), 'utf8');
  assert.match(source, /from ['"]which['"]/u);
  assert.match(source, /from ['"]isexe['"]/u);
  assert.doesNotMatch(source, /node:child_process|\bshell\s*:/u);
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
