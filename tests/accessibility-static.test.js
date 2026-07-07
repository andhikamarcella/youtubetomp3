import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const home = await readFile(new URL('../public-ui/index.html', import.meta.url), 'utf8');
const status = await readFile(new URL('../public-ui/status.html', import.meta.url), 'utf8');
const privacy = await readFile(new URL('../public-ui/privacy.html', import.meta.url), 'utf8');

test('homepage has keyboard and screen-reader landmarks for converter flow', () => {
  assert.match(home, /href="#mainContent"/);
  assert.match(home, /<main id="mainContent"/);
  assert.match(home, /<label[^>]+for="basic-url"/);
  assert.match(home, /<input[^>]+(?:id="basic-url"[^>]+type="url"|type="url"[^>]+id="basic-url")/);
  assert.match(home, /aria-live="polite"/);
  assert.match(home, /id="logs"[^>]+aria-live="polite"/);
});

test('public status and policy pages expose semantic content and viewport metadata', () => {
  for (const html of [status, privacy]) {
    assert.match(html, /<meta name="viewport"/);
    assert.match(html, /<main|<body/);
    assert.doesNotMatch(html, /<img(?![^>]+alt=)/i);
  }
});
