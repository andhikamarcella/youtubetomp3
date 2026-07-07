import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const privacy = await readFile(new URL('../public-ui/privacy.html', import.meta.url), 'utf8');
const terms = await readFile(new URL('../public-ui/terms.html', import.meta.url), 'utf8');
const copyright = await readFile(new URL('../public-ui/copyright.html', import.meta.url), 'utf8');
const dataRequest = await readFile(new URL('../public-ui/data-request.html', import.meta.url), 'utf8');
const cookies = await readFile(new URL('../public-ui/cookies.html', import.meta.url), 'utf8');
const guidelines = await readFile(new URL('../public-ui/community-guidelines.html', import.meta.url), 'utf8');
const sitemap = await readFile(new URL('../public-ui/sitemap.xml', import.meta.url), 'utf8');
const status = await readFile(new URL('../public-ui/status.html', import.meta.url), 'utf8');
const server = await readFile(new URL('../index.js', import.meta.url), 'utf8');

test('privacy and terms reflect real product data processors without affiliation claims', () => {
  for (const text of ['Firebase', 'Cloudinary', 'Google', 'tiket', 'forum', 'Analytics']) {
    assert.match(privacy, new RegExp(text, 'i'));
  }
  assert.match(privacy, /tidak berafiliasi resmi/i);
  assert.match(terms, /konten yang kamu miliki/i);
  assert.match(terms, /domain publik/i);
  assert.match(terms, /tidak berafiliasi resmi/i);
});

test('copyright wording avoids automatic fair-use claims and includes takedown workflow', () => {
  assert.match(copyright, /tidak menyatakan bahwa penggunaan pribadi selalu legal/i);
  assert.match(copyright, /konten milik sendiri/i);
  assert.match(copyright, /laporan pelanggaran/i);
  assert.match(copyright, /Repeat-infringer policy/i);
  assert.doesNotMatch(copyright, /otomatis\s+fair use/i);
});

test('data request and policy pages are implemented as public routes', () => {
  assert.match(dataRequest, /fetch\('\/api\/data-request'/);
  assert.match(dataRequest, /Permintaan Data/);
  assert.match(cookies, /Cookie YouTube.*tidak pernah ditampilkan/i);
  assert.match(guidelines, /Pedoman Komunitas/);
  for (const route of ['/cookies', '/data-request', '/community-guidelines']) {
    assert.match(sitemap, new RegExp(`https://ytconv\\.up\\.railway\\.app${route}`));
    assert.match(server, new RegExp(`app\\.get\\("${route}"`));
  }
});

test('public status uses live API status and renders service objects safely', () => {
  assert.match(status, /fetch\('\/api\/status/);
  assert.match(status, /Versi Aplikasi/);
  assert.match(status, /not_configured \(fitur opsional belum aktif\)/);
  assert.match(server, /app\.get\("\/api\/status"/);
  assert.match(server, /buildPublicStatus/);
});
