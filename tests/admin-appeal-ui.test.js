import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tickets = await readFile(new URL("../public-ui/admin-tickets.html", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../public-ui/admin-dashboard.html", import.meta.url), "utf8");
const index = await readFile(new URL("../index.js", import.meta.url), "utf8");

test("admin tickets appeal auto-refresh mempertahankan data terakhir", () => {
  assert.match(tickets, /appealLoadPromise/);
  assert.match(tickets, /data terakhir tetap aman/);
  assert.match(tickets, /allAppeals\.length/);
  assert.match(tickets, /cache:\s*'no-store'/);
});

test("admin dashboard auto-refresh tidak menghapus appeal saat error", () => {
  assert.match(dashboard, /loadStatsPromise/);
  assert.match(dashboard, /cache tetap tampil/);
  assert.match(dashboard, /auto-refresh tidak menghapus data/);
});

test("server appeal memakai persistent store Firestore\/file", () => {
  assert.match(index, /from "\.\/appeal_store\.js"/);
  assert.match(index, /await createAppeal\(appeal\)/);
  assert.match(index, /await listAppeals\(\)/);
  assert.match(index, /await updateStoredAppeal/);
  assert.match(index, /APL-\$\{nanoid\(12\)\.toUpperCase\(\)\}/);
});
