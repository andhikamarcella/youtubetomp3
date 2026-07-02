# Security Review

## Improvements in this pass

- Admin HTML routes are now protected server-side: `/admin`, `/admin/dashboard`, `/admin/tickets`, `admin-dashboard.html`, `admin-tickets.html`, and `admin-cookies.html` redirect unauthenticated users to `/admin/login`.
- The new admin login page posts credentials to the existing server-side `/admin/login` endpoint and does not receive or store an admin bearer token.
- Admin pages can rely on the signed HttpOnly admin cookie after refresh/direct navigation, avoiding Web Storage token dependency.
- A regression test verifies unauthenticated `/admin/dashboard` access redirects and receives `x-request-id`.

## Existing controls observed

- Security headers and CORS middleware exist in `src/lib/security.js`.
- Turnstile verification exists in `src/lib/turnstile.js` and protected endpoints call server-side verification.
- URL validation/SSRF protection exists in `src/lib/urlSafety.js` and is covered by tests.
- Signed download token helpers exist in `src/lib/signedDownload.js` and are covered by tests.
- Cookies API returns metadata/status only; cookie content download is disabled.

## Open security work

- Add CSRF tokens for all cookie-session admin POST/DELETE/PATCH actions.
- Authenticate/authorize Socket.IO events by role/session, especially admin and private room events.
- Add upload magic-byte validation, image re-encoding, EXIF stripping, and malware scanning hook.
- Add lint/secret-scan CI gates.
