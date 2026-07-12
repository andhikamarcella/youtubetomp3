import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

process.env.PORT = '0';
const mod = await import('../index.js');
const { buildAiModelsResponse, server: startedServer } = mod;
if (startedServer?.unref) startedServer.unref();
after(async () => {
  if (startedServer?.listening) await new Promise((resolve) => startedServer.close(resolve));
});

const server = await readFile(new URL('../index.js', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public-ui/sw.js', import.meta.url), 'utf8');
const home = await readFile(new URL('../public-ui/index.html', import.meta.url), 'utf8');
const bridge = await readFile(new URL('../public-ui/tailwind-ui-bridge.js', import.meta.url), 'utf8');
const emergency = await readFile(new URL('../public-ui/mobile-header-emergency.js', import.meta.url), 'utf8');
const forumEmergency = await readFile(new URL('../public-ui/forum-interaction-emergency.js', import.meta.url), 'utf8');
const modalPolish = await readFile(new URL('../public-ui/modal-accessibility-polish.js', import.meta.url), 'utf8');
const prepareUi = await readFile(new URL('../scripts/prepare_mobile_header.mjs', import.meta.url), 'utf8');

test('AI models response exposes public modes without requiring provider secrets', () => {
  const payload = buildAiModelsResponse({ advanced: true });
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.modes.map((mode) => mode.id), ['auto', 'fast', 'smart']);
  assert.ok(Array.isArray(payload.providers));
  assert.ok(payload.advanced);
  assert.doesNotMatch(JSON.stringify(payload), /API_KEY|SECRET|Bearer/i);
});

test('server implements forum report/block moderation and filtered broadcasts', () => {
  assert.match(server, /app\.post\('\/api\/forum\/report'/);
  assert.match(server, /app\.post\('\/api\/forum\/block'/);
  assert.match(server, /socket\.on\("forum:report"/);
  assert.match(server, /socket\.on\("forum:blockUser"/);
  assert.match(server, /isForumBlockedBy\(member\.userId, userId\)/);
  assert.match(server, /admin:forumReport/);
});

test('voice signaling requires consent and active call participants', () => {
  assert.match(server, /microphone_consent_required/);
  assert.match(server, /const activeCalls = new Map\(\)/);
  assert.match(server, /activeCalls\.set\(callId/);
  assert.match(server, /endSocketCalls\(socket\.id, "disconnected"\)/);
});

test('PWA service worker refreshes interaction and modal assets instead of serving stale cached copies', () => {
  assert.match(sw, /const APP_VERSION = 'v4\.0\.8'/);
  assert.match(sw, /ytconv-ui-\$\{APP_VERSION\}/);
  assert.match(sw, /ALWAYS_NETWORK_PATHS/);
  assert.match(sw, /resolveToScopePath\('tailwind-ui-bridge\.js'\)/);
  assert.match(sw, /resolveToScopePath\('mobile-header-emergency\.js'\)/);
  assert.match(sw, /resolveToScopePath\('forum-interaction-emergency\.js'\)/);
  assert.match(sw, /resolveToScopePath\('modal-accessibility-polish\.js'\)/);
  assert.match(sw, /cache: 'no-store'/);
  assert.match(sw, /CLEAR_CACHE/);
  assert.match(sw, /SKIP_WAITING/);
  assert.match(sw, /resolveToScopePath\('data-request\.html'\)/);
  assert.match(sw, /resolveToScopePath\('public\/jobs\/'\)/);
});

test('mobile header remains tappable above transparent overlays', () => {
  assert.match(bridge, /const MOBILEBAR_Z = 2147483647/);
  assert.match(bridge, /cleanupOrphanBackdrops/);
  assert.match(bridge, /\.modal-backdrop/);
  assert.match(bridge, /pointInside\(drawerButton, x, y\)/);
  assert.match(bridge, /pointInside\(themeButton, x, y\)/);
  assert.match(bridge, /dataset\.mobileHeaderFix = 'v4'/);
});

test('mobile controls perform one stable action after the finger is released', () => {
  assert.match(prepareUi, /const version = '4\.0\.8'/);
  assert.match(prepareUi, /mobile-header-emergency\.js\?v=\$\{version\}/);
  assert.match(prepareUi, /tailwind-ui-bridge\.js\?v=\$\{version\}/);
  assert.match(prepareUi, /forum-interaction-emergency\.js\?v=\$\{version\}/);
  assert.match(prepareUi, /modal-accessibility-polish\.js\?v=\$\{version\}/);
  assert.match(prepareUi, /\$\{emergencyTag\}\\n  \$\{bridgeTag\}\\n  \$\{forumTag\}\\n  \$\{modalTag\}/);
  assert.match(emergency, /const VERSION = 'v6'/);
  assert.match(emergency, /__ytconvMobileHeaderFallbackInstalledV4 = true/);
  assert.match(emergency, /TAP_MOVE_TOLERANCE_PX = 18/);
  assert.match(emergency, /const beginPress = \(event\) =>/);
  assert.match(emergency, /const finishPress = \(event\) =>/);
  assert.match(emergency, /window\.addEventListener\('pointerup', finishPress, true\)/);
  assert.match(emergency, /window\.addEventListener\('touchend', finishPress/);
  assert.match(emergency, /const captureClick = \(event\) =>/);
  assert.match(emergency, /SYNTHETIC_CLICK_WINDOW_MS/);
  assert.match(emergency, /dataset\.mobileHeaderEmergency = VERSION/);
});

test('forum modal is portaled above its backdrop and Google login taps remain interactive on mobile', () => {
  assert.match(forumEmergency, /const FORUM_MODAL_Z = '2147483200'/);
  assert.match(forumEmergency, /const FORUM_BACKDROP_Z = '2147482000'/);
  assert.match(forumEmergency, /globalModalManagerActive/);
  assert.match(forumEmergency, /if \(!globalModalManagerActive\(\)\)/);
  assert.match(forumEmergency, /modal\.parentElement !== body/);
  assert.match(forumEmergency, /body\.appendChild\(modal\)/);
  assert.match(forumEmergency, /dataset\.forumModalPortal = 'body'/);
  assert.match(forumEmergency, /#googleSignInBtn, #forumGoogleLoginBtn/);
  assert.match(forumEmergency, /neutralizeBlockersOverButton/);
  assert.match(forumEmergency, /current\.button\.click\(\)/);
  assert.match(forumEmergency, /window\.addEventListener\('pointerup', finishTap, true\)/);
});

test('all dialogs use a subtle backdrop, reliable close controls, and accessible focus management', () => {
  assert.match(modalPolish, /const MODAL_Z = 2147483550/);
  assert.match(modalPolish, /const BACKDROP_Z = 2147483000/);
  assert.match(modalPolish, /--ytconv-dialog-scrim: rgba\(15, 23, 42, \.22\)/);
  assert.match(modalPolish, /body > \.modal\.ytconv-modal-polished/);
  assert.match(modalPolish, /\.ytconv-modal-polished \.btn-close/);
  assert.match(modalPolish, /button\.setAttribute\('aria-label', 'Tutup dialog'\)/);
  assert.match(modalPolish, /event\.key === 'Escape'/);
  assert.match(modalPolish, /event\.key !== 'Tab'/);
  assert.match(modalPolish, /element\.inert = true/);
  assert.match(modalPolish, /previouslyFocused/);
  assert.match(modalPolish, /prefers-reduced-motion: reduce/);
  assert.match(modalPolish, /forced-colors: active/);
});

test('support ticket and community dialogs receive matching user-friendly surfaces without replacing handlers', () => {
  assert.match(modalPolish, /ytconv-modal-community/);
  assert.match(modalPolish, /ytconv-modal-support/);
  assert.match(modalPolish, /#googleSignInBtn, #forumGoogleLoginBtn/);
  assert.match(modalPolish, /Ceritakan kendalanya dengan jelas/);
  assert.match(modalPolish, /Bergabung dengan aman/);
  assert.match(modalPolish, /button\[type="submit"\]/);
  assert.match(modalPolish, /data-bs-dismiss/);
  assert.match(modalPolish, /window\.bootstrap\?\.Modal/);
});

test('rewards remain isolated behind the rewards route instead of becoming primary converter UI', () => {
  assert.match(home, /data-route-path="\/rewards"/);
  assert.match(home, /body\.route-home #assistantFab/);
  assert.match(server, /"\/rewards"/);
});
