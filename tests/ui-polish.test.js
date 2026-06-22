import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pages = {
  home: await readFile(new URL("../public-ui/index.html", import.meta.url), "utf8"),
  appMain: await readFile(new URL("../public-ui/app-main.js", import.meta.url), "utf8"),
  dashboard: await readFile(new URL("../public-ui/admin-dashboard.html", import.meta.url), "utf8"),
  tickets: await readFile(new URL("../public-ui/admin-tickets.html", import.meta.url), "utf8"),
  cookies: await readFile(new URL("../public-ui/admin-cookies.html", import.meta.url), "utf8"),
  status: await readFile(new URL("../public-ui/ticket-status.html", import.meta.url), "utf8"),
  bridge: await readFile(new URL("../public-ui/tailwind-ui-bridge.js", import.meta.url), "utf8"),
};

test("homepage mendapat premium polish layer tanpa menghapus fitur utama", () => {
  assert.doesNotMatch(pages.home, /cdn\.tailwindcss\.com/);
  assert.match(pages.home, /tailwind-lite\.css/);
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

test("tailwind bridge memakai sans font dan glow interaktif", () => {
  assert.match(pages.bridge, /font-family:\s*Inter, "Segoe UI", system-ui/);
  assert.match(pages.bridge, /tw-glow-orb/);
  assert.match(pages.bridge, /ensureGlowOrb/);
  assert.match(pages.bridge, /--tw-glow-x/);
  assert.match(pages.bridge, /pointermove/);
  assert.match(pages.bridge, /rgba\(99, 102, 241, \.24\)/);
  assert.match(pages.bridge, /box-shadow: 0 28px 80px/);
});


test("homepage mengurangi render blocking untuk skor performance", () => {
  assert.doesNotMatch(pages.home, /cdn\.tailwindcss\.com/);
  assert.match(pages.home, /href="\.\/tailwind-lite\.css"/);
  assert.match(pages.home, /<script src="\.\/app-main\.js" defer><\/script>/);
  assert.match(pages.home, /rel="apple-touch-icon" href="\.\/icons\/icon\.svg"/);
  assert.doesNotMatch(pages.home, /rel="apple-touch-icon"[\s\S]{0,120}data:image\/png/);
  assert.match(pages.home, /rel="preload" as="style"[\s\S]{0,220}bootstrap@5\.3\.3/);
});


test("homepage menunda script berat dan menguatkan SEO", () => {
  assert.match(pages.home, /rel="canonical" href="https:\/\/ytconv\.up\.railway\.app\/"/);
  assert.match(pages.home, /name="robots" content="index,follow/);
  assert.match(pages.home, /__ytconvDeferredScripts/);
  assert.match(pages.home, /content-visibility: auto/);
  assert.match(pages.home, /modal-backdrop[\s\S]{0,220}background: rgba\(3, 7, 18, \.82\)/);
  assert.match(pages.home, /font-family: "Inter", "Segoe UI", system-ui/);
  assert.match(pages.home, /requestIdleCallback\(run, \{ timeout: 6500 \}\)/);
  assert.doesNotMatch(pages.home, /<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/howler\/2\.2\.4\/howler\.min\.js"/);
  assert.doesNotMatch(pages.home, /<script src="https:\/\/accounts\.google\.com\/gsi\/client"/);
  assert.match(pages.home, /aria-label="Cari pertanyaan FAQ"/);
  assert.match(pages.home, /aria-label="Pilih model AI Navigator"/);
});


test("homepage memindahkan JavaScript utama ke asset cacheable", () => {
  assert.match(pages.home, /<script src="\.\/app-main\.js" defer><\/script>/);
  assert.match(pages.appMain, /canonicalTicketId\s*=\s*String\(result\?\.ticketId/);
  assert.match(pages.appMain, /faqTabContent && !faqTabContent\.dataset\.collapseFallbackBound/);
  assert.match(pages.home, /href="\.\/tailwind-lite\.css"/);
});


test("AI Navigator dan backdrop modal tetap rapi", () => {
  assert.match(pages.home, /\.assistant-quick-suggestions \{[\s\S]{0,220}scroll-snap-type: inline mandatory/);
  assert.match(pages.home, /\.assistant-suggestion-chip \{[\s\S]{0,700}scroll-snap-align: start/);
  assert.match(pages.home, /\.assistant-panel \.assistant-messages \{[\s\S]{0,180}max-height: clamp\(12rem, 40vh, 22rem\)/);
  assert.match(pages.home, /body \.modal-backdrop \{[\s\S]{0,180}pointer-events: auto !important/);
  assert.match(pages.home, /body \.modal-backdrop\.show \{[\s\S]{0,180}backdrop-filter: blur\(5px\)/);
});


test("homepage memakai classic professional Web3 UI pass", () => {
  assert.match(pages.home, /<body class="ytc-classic-pro">/);
  assert.match(pages.home, /Classic professional Web3 UI pass/);
  assert.match(pages.home, /--ytc-classic-page: #eef1f6/);
  assert.match(pages.home, /linear-gradient\(90deg, #020617, #ef4444, #f59e0b, #6366f1, #020617\)/);
  assert.match(pages.home, /body\.ytc-classic-pro \.app-section/);
  assert.match(pages.home, /body\.ytc-classic-pro \.assistant-suggestion-chip/);
});


test("Lite mode hanya dipilih dari settings dan tetap memakai Basic flow", () => {
  assert.match(pages.home, /id="settingsLiteModeBtn"[^>]+data-settings-mode="lite"/);
  assert.match(pages.home, /id="settingsModeBadge"/);
  assert.match(pages.home, /class="lite-mode-preview/);
  assert.doesNotMatch(pages.home, /id="selectLiteMode"/);
  assert.match(pages.appMain, /Lite is intentionally enabled from Settings only/);
  assert.match(pages.appMain, /const isBasic = mode === 'basic' \|\| isLite/);
  assert.match(pages.appMain, /settingsModeButtons\.forEach/);
  assert.match(pages.appMain, /aria-pressed/);
});
