import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pages = {
  home: await readFile(new URL("../public-ui/index.html", import.meta.url), "utf8"),
  dashboard: await readFile(new URL("../public-ui/admin-dashboard.html", import.meta.url), "utf8"),
  tickets: await readFile(new URL("../public-ui/admin-tickets.html", import.meta.url), "utf8"),
  cookies: await readFile(new URL("../public-ui/admin-cookies.html", import.meta.url), "utf8"),
  status: await readFile(new URL("../public-ui/ticket-status.html", import.meta.url), "utf8"),
  bridge: await readFile(new URL("../public-ui/tailwind-ui-bridge.js", import.meta.url), "utf8"),
};

test("homepage mendapat premium polish layer tanpa menghapus fitur utama", () => {
  assert.match(pages.home, /cdn\.tailwindcss\.com/);
  assert.match(pages.home, /preflight:\s*false/);
  assert.match(pages.home, /family=Inter:wght@400;500;600;700;800;900/);
  assert.match(pages.home, /font-family:\s*"Inter", "Segoe UI"/);
  assert.match(pages.home, /Homepage tidy pass/);
  assert.match(pages.home, /tailwind-ui-bridge\.js/);
  assert.match(pages.home, /Premium polish layer/);
  assert.match(pages.home, /ytconv-premium-surface|tool-card|history-card/);
  for (const id of ["publicTicketLookupForm", "emailForm", "forumAppealBtn", "convertBtn"]) {
    assert.match(pages.home, new RegExp(`id=["']${id}["']`));
  }
});

test("admin pages memakai premium panels dan tetap punya kontrol utama", () => {
  for (const page of [pages.dashboard, pages.tickets]) {
    assert.match(page, /premium-panel/);
    assert.match(page, /tailwind-ui-bridge\.js/);
  }
  assert.match(pages.cookies, /premium-card/);
  assert.match(pages.cookies, /tailwind-ui-bridge\.js/);
  for (const id of ["refreshBtn", "refreshAppealsBtn", "adminTicketsBtn"]) {
    assert.match(pages.dashboard, new RegExp(`id=["']${id}["']`));
  }
  for (const id of ["loginForm", "ticketRows", "appealRows", "refreshAppealsBtn"]) {
    assert.match(pages.tickets, new RegExp(`id=["']${id}["']`));
  }
  for (const id of ["loginView", "uploadView", "statusBox", "uploadBtn", "refreshStatusBtn"]) {
    assert.match(pages.cookies, new RegExp(`id=["']${id}["']`));
  }
});

test("ticket status tetap realtime dan mendapat visual hover polish", () => {
  assert.match(pages.status, /\.glass:hover/);
  assert.match(pages.status, /tailwind-ui-bridge\.js/);
  assert.match(pages.status, /ticket:subscribe/);
  assert.match(pages.status, /manualRefreshBtn/);
});

test("tailwind bridge terhubung ke JavaScript interaktif", () => {
  assert.match(pages.bridge, /dataset\.tailwindUi\s*=\s*'ready'/);
  assert.match(pages.bridge, /dataset\.tailwindConnected\s*=\s*'true'/);
  assert.match(pages.bridge, /tw-pressed/);
  assert.match(pages.bridge, /DOMContentLoaded/);
});

test("tailwind bridge mempercantik tombol dan panel tanpa mengganti fitur", () => {
  assert.match(pages.bridge, /tw-premium-button-polish/);
  assert.match(pages.bridge, /a\[class\*="bg-"\]/);
  assert.match(pages.bridge, /radial-gradient\(circle at var\(--tw-press-x/);
  assert.match(pages.bridge, /focus-visible/);
  assert.match(pages.bridge, /premium-panel/);
});

test("tailwind bridge memberi polish menyeluruh ke elemen umum", () => {
  assert.match(pages.bridge, /main > section/);
  assert.match(pages.bridge, /tbody tr:hover/);
  assert.match(pages.bridge, /::file-selector-button/);
  assert.match(pages.bridge, /::-webkit-scrollbar-thumb/);
  assert.match(pages.bridge, /text-wrap:\s*balance/);
});
