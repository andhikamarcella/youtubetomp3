import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const publishedDirectories = ['bin', 'src', 'scripts', 'types', 'ish', 'docs']
  .map((name) => path.join(root, name))
  .filter((directory) => fs.existsSync(directory));
const allowedRuntimePackages = new Set([
  'commander', 'figlet', 'ink', 'isexe', 'react', 'which', 'ws',
]);

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

function runtimeJavaScriptFiles() {
  return ['bin', 'src', 'scripts']
    .map((name) => path.join(root, name))
    .filter((directory) => fs.existsSync(directory))
    .flatMap(walk)
    .filter((file) => file.endsWith('.js'));
}

function importSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /(?:^|\n)\s*import(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]/gu,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/gu,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

function isInternalSpecifier(specifier) {
  return specifier.startsWith('node:')
    || specifier.startsWith('./')
    || specifier.startsWith('../')
    || specifier.startsWith('file:');
}

function packageName(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

test('1.7.0 has an exact allowlisted production npm dependency surface', () => {
  assert.equal(manifest.version, '1.7.0');
  assert.deepEqual(new Set(Object.keys(manifest.dependencies)), allowedRuntimePackages);
  assert.deepEqual(manifest.optionalDependencies ?? {}, {});
  assert.deepEqual(manifest.peerDependencies ?? {}, {});
  assert.equal(manifest.securityCapabilities.telemetry, false);

  for (const [name, version] of Object.entries(manifest.dependencies)) {
    assert.match(version, /^\d+\.\d+\.\d+$/u, `${name} must be exact`);
    assert.equal(lock.packages[''].dependencies[name], version);
    assert.equal(lock.packages[`node_modules/${name}`].version, version);
    assert.match(lock.packages[`node_modules/${name}`].integrity, /^sha512-/u);
  }

  for (const file of runtimeJavaScriptFiles()) {
    const source = fs.readFileSync(file, 'utf8');
    const external = importSpecifiers(source)
      .filter((specifier) => !isInternalSpecifier(specifier))
      .map(packageName);
    for (const dependency of external) {
      assert.equal(allowedRuntimePackages.has(dependency), true,
        `unapproved runtime import in ${path.relative(root, file)}: ${dependency}`);
    }
  }
});

test('requested identity and executable-discovery dependencies are used by their intended modules', () => {
  assert.match(fs.readFileSync(path.join(root, 'src', 'branding.js'), 'utf8'), /from ['"]figlet['"]/u);
  assert.match(fs.readFileSync(path.join(root, 'src', 'command-program.js'), 'utf8'), /from ['"]commander['"]/u);
  const ui = fs.readFileSync(path.join(root, 'src', 'ui.js'), 'utf8');
  assert.match(ui, /from ['"]react['"]/u);
  assert.match(ui, /from ['"]ink['"]/u);
  const resolver = fs.readFileSync(path.join(root, 'src', 'command-path.js'), 'utf8');
  assert.match(resolver, /from ['"]which['"]/u);
  assert.match(resolver, /from ['"]isexe['"]/u);
  const browser = fs.readFileSync(path.join(root, 'src', 'managed-browser.js'), 'utf8');
  assert.match(browser, /globalThis\.WebSocket|from ['"]ws['"]/u);
});

test('published package contains no minified bundles source maps or native executable payloads', () => {
  const files = publishedDirectories.flatMap(walk);
  const forbiddenNames = [
    /(?:^|\.)min\.(?:c?js|mjs)$/iu,
    /\.(?:c?js|mjs)\.map$/iu,
    /\.(?:exe|dll|dylib|so|node|wasm|jar|class)$/iu,
  ];
  for (const file of files) {
    const relative = path.relative(root, file);
    for (const pattern of forbiddenNames) assert.doesNotMatch(relative, pattern, relative);
    const stats = fs.statSync(file);
    assert.ok(stats.size < 2_000_000, `unexpectedly large published file: ${relative}`);
  }
});

test('runtime JavaScript rejects debug and dynamic-code primitives', () => {
  const forbidden = [
    [/\bdebugger\s*;/u, 'debugger statement'],
    [/\beval\s*\(/u, 'eval'],
    [/\bnew\s+Function\s*\(/u, 'new Function'],
    [/\bWebAssembly\.(?:compile|instantiate)\s*\(/u, 'dynamic WebAssembly'],
    [/\bshell\s*:\s*true\b/u, 'shell execution'],
    [/\bexecSync\s*\(/u, 'execSync'],
    [/\bexec\s*\(/u, 'exec'],
  ];
  for (const file of runtimeJavaScriptFiles()) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [pattern, label] of forbidden) {
      assert.doesNotMatch(source, pattern, `${label} in ${path.relative(root, file)}`);
    }
  }
});

test('security capability metadata describes the unavoidable downloader boundaries', () => {
  const capabilities = manifest.securityCapabilities;
  assert.match(capabilities.network, /user-requested media\/provider URLs/iu);
  assert.match(capabilities.childProcesses, /argument arrays/iu);
  assert.match(capabilities.childProcesses, /shell execution is disabled/iu);
  assert.match(capabilities.filesystem, /User-selected output/iu);
  assert.match(capabilities.environment, /Secrets are stripped/iu);
});
