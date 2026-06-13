import assert from "node:assert/strict";
import { access, chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const tempDir = await mkdtemp(join(tmpdir(), "ytconv-cookie-store-"));
const cookiesPath = join(tempDir, "runtime", "cookies.txt");
const storePath = join(tempDir, "persistent", "cookies-store.json");
process.env.COOKIES_PATH = cookiesPath;
process.env.COOKIE_STORE_PATH = storePath;
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

const store = await import(`../cookie_store.js?test=${Date.now()}`);

const sampleCookies = [
  "# Netscape HTTP Cookie File",
  ".youtube.com\tTRUE\t/\tTRUE\t2147483647\tSID\ttest-secret",
  "",
].join("\n");

test.after(async () => {
  store.stopCookiesSync();
  await chmod(tempDir, 0o700).catch(() => {});
  await rm(tempDir, { recursive: true, force: true });
});

test("upload disimpan ke store persisten dan salinan runtime", async () => {
  assert.equal(store.getCookieStoreBackend(), "file");
  const saved = await store.saveCookies(sampleCookies);
  assert.equal(saved.bytes, Buffer.byteLength(sampleCookies));
  assert.equal(await readFile(cookiesPath, "utf8"), sampleCookies);

  const persistent = JSON.parse(await readFile(storePath, "utf8"));
  assert.equal(persistent.content, sampleCookies);
  assert.equal(persistent.hash, saved.hash);
  assert.equal((await stat(cookiesPath)).mode & 0o777, 0o600);
});

test("status selalu berasal dari store dan memulihkan file runtime yang hilang", async () => {
  await rm(cookiesPath, { force: true });
  await assert.rejects(access(cookiesPath));

  const status = await store.getCookiesStatus();
  assert.equal(status.exists, true);
  assert.equal(status.bytes, Buffer.byteLength(sampleCookies));
  assert.equal(status.backend, "file");
  assert.equal(await readFile(cookiesPath, "utf8"), sampleCookies);
});

test("instance baru membaca upload yang sama setelah refresh atau restart", async () => {
  const restarted = await import(`../cookie_store.js?restart=${Date.now()}`);
  const status = await restarted.initializeCookiesStore();
  assert.equal(status.exists, true);
  assert.equal((await restarted.readCookies()).content, sampleCookies);
  restarted.stopCookiesSync();
});

test("file cookies lama dimigrasikan ke store saat belum ada record", async () => {
  const legacyDir = await mkdtemp(join(tmpdir(), "ytconv-cookie-legacy-"));
  const legacyCookiesPath = join(legacyDir, "cookies.txt");
  const legacyStorePath = join(legacyDir, "data", "cookies-store.json");
  await writeFile(legacyCookiesPath, sampleCookies, "utf8");

  process.env.COOKIES_PATH = legacyCookiesPath;
  process.env.COOKIE_STORE_PATH = legacyStorePath;
  const legacyStore = await import(`../cookie_store.js?legacy=${Date.now()}`);
  const status = await legacyStore.initializeCookiesStore();
  assert.equal(status.exists, true);
  assert.equal(JSON.parse(await readFile(legacyStorePath, "utf8")).content, sampleCookies);
  legacyStore.stopCookiesSync();
  await rm(legacyDir, { recursive: true, force: true });
});

test("upload kosong ditolak tanpa menghapus cookies yang sudah tersimpan", async () => {
  await assert.rejects(store.saveCookies("   \n"), /cookies_empty/);
  assert.equal((await store.readCookies()).content, sampleCookies);
});
