import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { walk, relative } from './fs-utils.js';

async function sha256(file) {
  const hash = crypto.createHash('sha256');
  const handle = await fs.open(file, 'r');
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

export async function generateChecksums(directory, output = 'SHA256SUMS.txt') {
  const absoluteDirectory = path.resolve(directory);
  const outputPath = path.resolve(absoluteDirectory, output);
  const files = (await walk(absoluteDirectory, { maxDepth: 12 }))
    .filter((file) => path.resolve(file) !== outputPath)
    .sort();
  if (!files.length) throw new Error(`No files found in ${absoluteDirectory}`);
  const lines = [];
  for (const file of files) lines.push(`${await sha256(file)}  ${relative(absoluteDirectory, file)}`);
  await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
  return { outputPath, count: files.length, lines };
}
