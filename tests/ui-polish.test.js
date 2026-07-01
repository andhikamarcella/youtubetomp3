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
  for (const id of ["ticketPrevBtn", "ticketNextBtn", "appealPrevBtn", "appealNextBtn"]) {
    assert.match(pages.tickets, new RegExp(`id=["']${id}["']`));
  }
  assert.match(pages.tickets, /deleteTicketRow/);
  assert.match(pages.tickets, /deleteAppealRow/);
  for (const id of ["loginView", "uploadView", "statusBox", "uploadBtn", "refreshStatusBtn"]) {
    assert.match(pages.cookies, new RegExp(`id=["']${id}["']`));
  }
  assert.match(pages.dashboard, /grid grid-cols-2 gap-2 w-full sm:flex/);
  assert.match(pages.dashboard, /grid sm:grid-cols-2 xl:grid-cols-5 gap-2/);
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
  assert.match(pages.bridge, /background-image: none !important/);
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

test("tailwind bridge memakai Helvetica dan no-glass ringan", () => {
  assert.match(pages.bridge, /font-family:\s*Helvetica, Arial, sans-serif/);
  assert.match(pages.bridge, /tw-glow-orb/);
  assert.match(pages.bridge, /display: none !important/);
  assert.match(pages.bridge, /backdrop-filter: none !important/);
  assert.match(pages.bridge, /box-shadow: none !important/);
  assert.match(pages.bridge, /transition: background-color \.16s ease/);
});

test("homepage memperbaiki light mode, AI navigator, Google Safari, dan default MP3", () => {
  assert.match(pages.home, /body\.ui-overlay-open \.assistant-fab/);
  assert.match(pages.home, /\.assistant-fab[\s\S]*touch-action: none/);
  assert.match(pages.home, /\.assistant-toggle[\s\S]*overscroll-behavior: contain/);
  assert.match(pages.home, /evt\.preventDefault\(\);[\s\S]*const deltaX = evt\.clientX - assistantFabDragSession\.startX/);
  assert.match(pages.home, /\.btn-close::before/);
  assert.match(pages.home, /#serverTimeBadge/);
  assert.match(pages.home, /theme-switching/);
  assert.match(pages.home, /itp_support:\s*true/);
  assert.match(pages.home, /google-safari-fallback/);
  assert.match(pages.home, /authReady/);
  assert.match(pages.home, /FORUM_LOGIN_REDIRECT_ATTEMPTED_KEY/);
  assert.match(pages.home, /signInWithPopup\(auth, provider\)/);
  assert.match(pages.home, /shouldFallbackToForumRedirect/);
  assert.match(pages.home, /forum-login-card/);
  assert.match(pages.home, /<option value="mp3" selected>MP3 \(re-encode, fleksibel\)<\/option>/);
  assert.match(pages.home, /<option value="320" selected>320 kbps \(Lebih besar, beda tipis\)<\/option>/);
  assert.match(pages.home, /<option value="44100" selected>44\.1 kHz<\/option>/);
});
