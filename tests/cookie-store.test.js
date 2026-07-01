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

test("upload disimpan ke runtime path aman tanpa mengekspos isi di metadata", async () => {
  assert.equal(store.getCookieStoreBackend(), "volume");
  const saved = await store.saveCookies(sampleCookies);
  assert.equal(saved.bytes, Buffer.byteLength(sampleCookies));
  assert.equal(await readFile(cookiesPath, "utf8"), sampleCookies);

  const persistent = JSON.parse(await readFile(storePath, "utf8"));
  assert.equal(persistent.content, undefined);
  assert.equal(typeof persistent.hash, "string");
  assert.equal(persistent.sizeBytes, saved.sizeBytes);
  assert.equal((await stat(cookiesPath)).mode & 0o777, 0o600);
});

test("status tidak menampilkan path/hash/content cookies", async () => {
  const status = await store.getCookiesStatus();
  assert.equal(status.exists, true);
  assert.equal(status.sizeBytes, Buffer.byteLength(sampleCookies));
  assert.equal(status.storage, "volume");
  assert.equal(status.content, undefined);
  assert.equal(status.hash, undefined);
});

test("status refresh mendeteksi file cookies meski metadata hilang", async () => {
  await rm(storePath, { force: true });
  const status = await store.getCookiesStatus();
  assert.equal(status.exists, true);
  assert.equal(status.sizeBytes, Buffer.byteLength(sampleCookies));
  assert.equal(status.health, "unknown");

  const repairedMeta = JSON.parse(await readFile(storePath, "utf8"));
  assert.equal(repairedMeta.exists, true);
  assert.equal(repairedMeta.sizeBytes, status.sizeBytes);
  assert.equal(repairedMeta.content, undefined);
});

test("status refresh menandai missing jika metadata lama ada tapi file runtime hilang", async () => {
  await rm(cookiesPath, { force: true });
  const missing = await store.getCookiesStatus();
  assert.equal(missing.exists, false);
  assert.equal(missing.health, "missing");
  await store.saveCookies(sampleCookies);
});

test("instance baru membaca upload yang sama setelah refresh atau restart", async () => {
  const restarted = await import(`../cookie_store.js?restart=${Date.now()}`);
  const status = await restarted.initializeCookiesStore();
  assert.equal(status.exists, true);
  assert.equal((await restarted.readCookies()).content, sampleCookies);
  restarted.stopCookiesSync();
});

test("file cookies lama dibaca sebagai sumber utama tanpa menyimpan raw content ke metadata", async () => {
  const legacyDir = await mkdtemp(join(tmpdir(), "ytconv-cookie-legacy-"));
  const legacyCookiesPath = join(legacyDir, "cookies.txt");
  const legacyStorePath = join(legacyDir, "data", "cookies-store.json");
  await writeFile(legacyCookiesPath, sampleCookies, "utf8");

  process.env.COOKIES_PATH = legacyCookiesPath;
  process.env.COOKIE_STORE_PATH = legacyStorePath;
  const legacyStore = await import(`../cookie_store.js?legacy=${Date.now()}`);
  const status = await legacyStore.initializeCookiesStore();
  assert.equal(status.exists, true);
  await assert.rejects(readFile(legacyStorePath, "utf8"));
  legacyStore.stopCookiesSync();
  await rm(legacyDir, { recursive: true, force: true });
});

test("upload kosong dan non-Netscape ditolak tanpa menghapus cookies", async () => {
  await assert.rejects(store.saveCookies("   \n"), /cookies_empty/);
  await assert.rejects(store.saveCookies("not cookies"), /cookies_invalid_netscape_format/);
  assert.equal((await store.readCookies()).content, sampleCookies);
});
