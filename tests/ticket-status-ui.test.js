import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public-ui/ticket-status.html", import.meta.url), "utf8");
const home = await readFile(new URL("../public-ui/index.html", import.meta.url), "utf8");

test("halaman menyediakan pencarian tiket dan state utama", () => {
  for (const id of ["lookupForm", "lookupInput", "emptyState", "loadingState", "notFoundState", "ticketContent"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("halaman mendukung realtime, polling fallback, dan refresh saat kembali aktif", () => {
  assert.match(html, /ticket:subscribe/);
  assert.match(html, /ticket:updated/);
  assert.match(html, /ticket:chat/);
  assert.match(html, /setInterval\(\(\) => refreshTicket/);
  assert.match(html, /visibilitychange/);
});

test("ticket terbaru disimpan dan dapat dibuka kembali", () => {
  assert.match(html, /ytconv_recent_tickets_v1/);
  assert.match(html, /rememberTicket\(ticket\)/);
  assert.match(home, /localStorage\.setItem\(recentKey/);
});

test("homepage menyediakan cek status tiket publik di sebelah Email Bantuan", () => {
  assert.match(home, /Email Bantuan[\s\S]{0,500}Cek Status Tiket/);
  for (const id of ["ticketLookupModal", "publicTicketLookupForm", "publicTicketLookupInput", "publicRecentTicketList"]) {
    assert.match(home, new RegExp(`id=["']${id}["']`));
  }
  assert.match(home, /initPublicTicketLookup\(\)/);
  assert.match(home, /window\.location\.assign\(buildTicketStatusLink\(ticketId\)\)/);
});

test("homepage menyediakan tiket cepat saat downloader helper gagal", () => {
  assert.match(home, /id=["']downloaderHelperTicketBtn["']/);
  assert.match(home, /data-ticket-preset=["']downloader-helper["']/);
  assert.match(home, /applyDownloaderHelperPreset/);
  assert.match(home, /Silakan upload screenshot error downloader helper/);
});

test("homepage memakai ID tiket kanonik dari respons server", () => {
  assert.match(home, /canonicalTicketId\s*=\s*String\(result\?\.ticketId/);
  assert.match(home, /ticketId:\s*canonicalTicketId/);
  assert.match(home, /crypto\.getRandomValues/);
});

test("data ticket dirender dengan textContent dan node DOM, bukan template HTML mentah", () => {
  assert.match(html, /message\.textContent = item\.message/);
  assert.match(html, /note\.textContent = item\.note/);
  assert.match(html, /span\.textContent = label/);
  assert.doesNotMatch(html, /history\.innerHTML\s*=/);
  assert.doesNotMatch(html, /chatHistoryEl\.innerHTML\s*=/);
});

test("fitur tambahan tersedia", () => {
  for (const id of ["copyIdBtn", "shareBtn", "manualRefreshBtn", "chatForm", "proofSubmitBtn", "connectionBadge"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});
