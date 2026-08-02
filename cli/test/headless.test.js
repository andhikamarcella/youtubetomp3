import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectUrls } from '../src/headless.js';

test('batch reader ignores comments, blanks, and duplicate links', async () => {
  const target = path.join(os.tmpdir(), `ytconv-links-${Date.now()}.txt`);
  await fs.writeFile(target, '# list\nhttps://example.com/a\n\nhttps://example.com/a\nhttps://example.com/b\n');
  const urls = await collectUrls({ batchFile: target });
  assert.deepEqual(urls, ['https://example.com/a', 'https://example.com/b']);
  await fs.rm(target, { force: true });
});

test('batch reader rejects malformed links early', async () => {
  await assert.rejects(() => collectUrls({ initialUrl: 'not-a-url' }), /Invalid URL/u);
});
