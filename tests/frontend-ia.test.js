import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public-ui/index.html', import.meta.url), 'utf8');
const server = await readFile(new URL('../index.js', import.meta.url), 'utf8');

test('public homepage navigation uses focused production routes', () => {
  for (const route of ['/', '/studio', '/support', '/rewards']) {
    assert.match(html, new RegExp(`data-route-path="${route === '/' ? '/' : route}"`));
  }
  assert.match(html, /data-route-modal="community"/);
  assert.match(html, /data-route-modal="account"/);
  assert.match(html, /ROUTE_TO_SECTION/);
});

test('public settings no longer expose admin login or admin cookies shortcut', () => {
  assert.doesNotMatch(html, /<h6 class="mb-3">Login Admin<\/h6>/);
  assert.doesNotMatch(html, /href="\.\/admin-cookies\.html"/);
  assert.match(html, /adminLoginForm/); // JS remains defensive for older cached markup.
});

test('easy mode copy replaces unprofessional gaptek wording', () => {
  assert.match(html, />Mode Mudah</);
  assert.doesNotMatch(html, /Mode Saya Gaptek/);
  assert.doesNotMatch(html, /Gaptek Mode aktif/);
});

test('secondary app routes are registered for refresh-safe navigation', () => {
  assert.match(server, /const publicAppRoutes = \["\/studio", "\/history", "\/assistant", "\/community", "\/support", "\/account", "\/rewards"/);
  assert.match(server, /sendPublicPage\(res, "index\.html"/);
});
