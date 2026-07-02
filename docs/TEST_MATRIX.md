# Test Matrix

## Automated tests currently available

- Node unit/integration tests under `tests/*.test.js`.
- Current baseline: `npm test` passes 68 tests.
- Build/syntax check: `npm run build` executes `node --check index.js`.

## Added/updated regression coverage

- Unauthenticated admin dashboard access redirects to `/admin/login` and includes a request ID.

## Manual/credential-required matrix

The following cannot be fully verified without production-like credentials and browser automation:

- Live YouTube/Shorts/Music/playlist/livestream/age-restricted/region-blocked conversion matrix.
- Cloudinary upload/delete with a real cloud account.
- Firebase login/profile/forum with production Firebase project.
- Turnstile valid-token path using production Cloudflare keys.
- Full browser matrix: Chromium, Firefox, WebKit, iPhone Safari, Chrome Android, Samsung Internet.
- Voice-call signaling with microphone permission and multi-client rooms.

## Required future automation

- Playwright smoke tests for converter, admin login/logout, routes, mobile menu, status/changelog/legal pages.
- axe accessibility scan for homepage/admin/ticket/status pages.
- Security regression tests for CSRF, Socket.IO authorization, upload spoofing, and formula injection.
