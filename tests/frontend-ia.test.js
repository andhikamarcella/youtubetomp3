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

test('mobile clean drawer keeps feature shortcuts available', () => {
  const drawerMatch = html.match(/<nav class="ytclean-nav" aria-label="Layanan utama">([\s\S]*?)<\/nav>/);
  assert.ok(drawerMatch, 'clean mobile drawer nav exists');
  const drawer = drawerMatch[1];
  for (const label of ['Saweria / Rewards', 'FAQ / Bantuan', 'Komunitas', 'Profil', 'About']) {
    assert.match(drawer, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(drawer, /data-section-target="saweria"/);
  assert.match(drawer, /data-section-target="faq"/);
  assert.match(drawer, /data-bs-target="#forumModal"/);
  assert.match(drawer, /data-bs-target="#profileModal"/);
  assert.match(drawer, /data-bs-target="#aboutModal"/);
});

test('clean UI boots with skeleton and scrollable sidebar', () => {
  assert.match(html, /<body class="ytclean-booting">/);
  assert.match(html, /ytclean-boot-skeleton/);
  assert.match(html, /body\.ytclean-booting > :not\(\.ytclean-boot-skeleton\)/);
  assert.match(html, /overflow-y: auto;/);
  assert.match(html, /max-height: 100dvh;/);
});

test('forum Google login uses delegated listener and visible Firebase errors', () => {
  assert.match(html, /document\.addEventListener\('click', \(event\) => \{/);
  assert.match(html, /closest\('#forumGoogleLoginBtn, #googleSignInBtn'\)/);
  assert.match(html, /Tombol Google ditekan/);
  assert.match(html, /Firebase Google Login Error/);
  assert.match(html, /window\.alert\(`\$\{code\}\\n\$\{message\}`\)/);
  assert.match(html, /auth\/operation-not-allowed/);
  assert.match(html, /ytconv\.onrender\.com/);
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
