# Test Matrix

## Automated tests currently available

- Node unit/integration tests under `tests/*.test.js`.
- Current baseline: `npm test` passes the full Node test suite.
- Build/syntax check: `npm run build` executes `node --check index.js`.
- Lint/typecheck scripts perform dependency-free syntax and script-surface checks.
- Security regression suite covers admin auth/CSRF denial, protected health/metrics, sensitive endpoint guardrails, Socket.IO auth patterns, and upload spoofing/size rejection.
- E2E smoke suite starts the server and directly requests public routes/PWA assets/admin protection/health.
- Static accessibility suite checks converter landmarks, skip link, labels, aria-live regions, viewport metadata, and image alt regressions.
- CI runs install, lint, typecheck, tests, security tests, E2E smoke, accessibility checks, build, high-severity audit, and secret scan.

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
- Browser-backed Playwright/axe tests for CSRF, Socket.IO authorization, upload spoofing, and formula injection.
