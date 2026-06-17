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
  assert.match(index, /persistedTickets = await listTickets\(\)/);
  assert.match(index, /stats memakai cache karena store gagal/);
  assert.match(dashboard, /deleteTicketFromDashboard/);
  assert.match(dashboard, /deleteAppealFromDashboard/);
});

test("server appeal memakai persistent store Firestore\/file", () => {
  assert.match(index, /from "\.\/appeal_store\.js"/);
  assert.match(index, /await createAppeal\(appeal\)/);
  assert.match(index, /await listAppeals\(\)/);
  assert.match(index, /await updateStoredAppeal/);
  assert.match(index, /deleteAppeal/);
  assert.match(index, /app\.delete\("\/api\/admin\/appeals\/:appealId"/);
  assert.match(index, /app\.delete\("\/api\/admin\/tickets\/:ticketId"/);
  assert.match(index, /APL-\$\{nanoid\(12\)\.toUpperCase\(\)\}/);
});

test("server AI prompt mengetahui update tiket dan admin terbaru", () => {
  assert.match(index, /Ticket support sekarang persistent/);
  assert.match(index, /Downloader helper gagal/);
  assert.match(index, /pagination dan delete/);
});
