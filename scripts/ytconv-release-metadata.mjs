#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function option(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

const packagePath = path.resolve(option('--package', 'cli/package.json'));
const tarballPath = path.resolve(option('--tarball'));
const outputPath = path.resolve(option('--output', `ytconv-release-metadata.json`));
const unpackedSize = Number(option('--unpacked-size', '0'));
const expectedPath = option('--verify');

if (!option('--tarball')) throw new Error('--tarball is required');

const manifest = JSON.parse(await fs.readFile(packagePath, 'utf8'));
const tarball = await fs.readFile(tarballPath);
const sha256 = crypto.createHash('sha256').update(tarball).digest('hex');
const sha512 = crypto.createHash('sha512').update(tarball).digest('base64');

const metadata = {
  schemaVersion: 1,
  package: manifest.name,
  version: manifest.version,
  publisher: manifest.publisher,
  author: manifest.author,
  license: manifest.license,
  lastUpdated: manifest.releaseDate,
  installer: {
    type: manifest.installer?.type || 'Tarball',
    url: manifest.installer?.url,
    sha256,
    sha512Integrity: `sha512-${sha512}`,
    packedSize: tarball.byteLength,
    unpackedSize,
  },
  dependencies: manifest.dependencies || {},
  optionalDependencies: manifest.optionalDependencies || {},
  releaseNotes: manifest.releaseNotes,
  releaseNotesUrl: manifest.releaseNotesUrl,
};

if (expectedPath) {
  const expected = JSON.parse(await fs.readFile(path.resolve(expectedPath), 'utf8'));
  if (JSON.stringify(expected) !== JSON.stringify(metadata)) {
    console.error('Generated release metadata does not match the committed release record.');
    console.error(JSON.stringify(metadata, null, 2));
    process.exitCode = 1;
  }
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
console.log(outputPath);
