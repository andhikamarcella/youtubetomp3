import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const tempDir = await mkdtemp(join(tmpdir(), "ytconv-appeal-store-"));
const storePath = join(tempDir, "nested", "appeals.json");
process.env.APPEAL_STORE_PATH = storePath;
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

const {
  createAppeal,
  getAppeal,
  getAppealStoreBackend,
  listAppeals,
  updateAppeal,
} = await import(`../appeal_store.js?test=${Date.now()}`);

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("appeal disimpan persisten dan ID dinormalisasi", async () => {
  assert.equal(getAppealStoreBackend(), "file");
  const created = await createAppeal({
    appealId: "apl-persist-1",
    userId: "user-1",
    status: "pending",
    reason: "Saya mau appeal",
  });

  assert.equal(created.appealId, "APL-PERSIST-1");
  assert.equal((await getAppeal("apl-persist-1")).reason, "Saya mau appeal");

  const disk = JSON.parse(await readFile(storePath, "utf8"));
  assert.equal(disk.appeals["APL-PERSIST-1"].status, "pending");
});

test("update appeal concurrent tidak menghapus catatan review", async () => {
  await Promise.all([
    updateAppeal("APL-PERSIST-1", async (appeal) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      appeal.reviewNote = "Catatan admin";
      return appeal;
    }),
    updateAppeal("APL-PERSIST-1", (appeal) => {
      appeal.status = "accepted";
      appeal.statusLabel = "Diterima";
      return appeal;
    }),
  ]);

  const appeal = await getAppeal("APL-PERSIST-1");
  assert.equal(appeal.reviewNote, "Catatan admin");
  assert.equal(appeal.status, "accepted");
  assert.equal((await listAppeals()).length, 1);
});

test("appeal duplikat ditolak dan appeal tidak ada tetap null", async () => {
  await assert.rejects(
    createAppeal({ appealId: "APL-PERSIST-1" }),
    /appeal_already_exists/,
  );
  assert.equal(await getAppeal("APL-NOT-FOUND"), null);
  assert.equal(await updateAppeal("APL-NOT-FOUND", (appeal) => appeal), null);
});
