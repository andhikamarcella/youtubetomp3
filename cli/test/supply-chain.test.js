import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildDownloadArgs } from '../src/downloader.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');

function javascriptFiles(directory) {
  const values = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) values.push(...javascriptFiles(fullPath));
    else if (entry.name.endsWith('.js')) values.push(fullPath);
  }
  return values;
}

test('1.6.6 publishes recognized license types and no lifecycle install hooks', () => {
  assert.equal(manifest.version, '1.6.6');
  assert.equal(manifest.license, 'ISC');
  assert.equal(manifest.scripts.preinstall, undefined);
  assert.equal(manifest.scripts.install, undefined);
  assert.equal(manifest.scripts.postinstall, undefined);
  assert.equal(fs.existsSync(path.join(root, 'scripts', 'postinstall.js')), false);
  assert.match(license, /^ISC License\r?\n/u);
  assert.match(license, /Permission to use, copy, modify, and\/or distribute/u);
});

test('TypeScript badge is backed by real declarations exports and type checking', () => {
  assert.equal(manifest.main, './src/index.js');
  assert.equal(manifest.types, './types/index.d.ts');
  assert.equal(manifest.exports['.'].types, './types/index.d.ts');
  assert.equal(manifest.exports['.'].import, './src/index.js');
  assert.equal(fs.existsSync(path.join(root, 'src', 'index.js')), true);
  assert.equal(fs.existsSync(path.join(root, 'types', 'index.d.ts')), true);
  assert.equal(manifest.scripts.typecheck, 'tsc --noEmit -p tsconfig.json');
  assert.deepEqual(manifest.devDependencies, {
    '@types/node': '22.20.1',
    typescript: '5.9.3',
  });
});

test('published JavaScript rejects dangerous dynamic shell patterns', () => {
  const directories = ['bin', 'src', 'scripts']
    .map((name) => path.join(root, name))
    .filter((directory) => fs.existsSync(directory));
  const forbidden = [
    [/\bchild_process\.exec\s*\(/u, 'child_process.exec'],
    [/import\s*\{[^}]*\bexec\s*(?:,|\})[^}]*\}\s*from\s*['"]node:child_process['"]/su, 'exec import'],
    [/require\s*\(\s*['"](?:node:)?child_process['"]\s*\)\.exec\s*\(/u, 'required child_process.exec'],
    [/\bshell\s*:\s*true\b/u, 'shell: true'],
    [/\beval\s*\(/u, 'eval'],
    [/\bnew\s+Function\s*\(/u, 'new Function'],
    [/\benv\s*:\s*process\.env\b/u, 'unfiltered process.env'],
  ];
  for (const file of directories.flatMap(javascriptFiles)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const [pattern, label] of forbidden) {
      assert.doesNotMatch(source, pattern, `${label} in ${path.relative(root, file)}`);
    }
  }
});

test('ordinary public YouTube MP4 args contain no cookie source', () => {
  const args = buildDownloadArgs({
    url: 'https://www.youtube.com/watch?v=BaW_jenozKc',
    mode: 'video',
    resolution: '720',
    videoFormat: 'auto',
    audioFormat: 'mp3',
    audioQuality: 'best',
    cookieConfig: { kind: 'none' },
    playlist: false,
    outputDirectory: root,
    subtitles: false,
    subtitleOnly: false,
    sponsorBlockMode: 'off',
    archivePath: '',
    retrySleep: 'linear=1::2',
  });
  assert.equal(args.includes('--cookies'), false);
  assert.equal(args.includes('--cookies-from-browser'), false);
  assert.deepEqual(args.slice(args.indexOf('--merge-output-format'), args.indexOf('--merge-output-format') + 4), [
    '--merge-output-format', 'mp4', '--recode-video', 'mp4',
  ]);
});

test('README exposes versioned Socket TypeScript ISC packaging and security documentation', () => {
  assert.match(readme, /badge\.socket\.dev\/npm\/package\/ytconv\/1\.6\.6/u);
  assert.match(readme, /types-TypeScript/u);
  assert.match(readme, /License-ISC/u);
  assert.match(readme, /npm installation free of `preinstall`, `install`, and `postinstall` hooks/iu);
  assert.match(readme, /docs\/PACKAGES\.md/u);
  assert.equal(fs.existsSync(path.join(root, 'SECURITY.md')), true);
});
