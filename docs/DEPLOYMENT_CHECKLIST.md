# Deployment Checklist

## Before deploy

- Run `npm install --ignore-scripts --no-audit --no-fund` or the CI install step.
- Run `npm test` and confirm all tests pass.
- Run `npm run build` and confirm syntax/build passes.
- Confirm required Railway variables are configured with real secret values in Railway only, not committed.
- Confirm `/data` Railway volume is attached if cookies/output/cache metadata must persist.

## Required environment groups

- Admin/session: `ADMIN_USER_HASH`, `ADMIN_PASS_HASH`, `ADMIN_JWT_SECRET`, `SESSION_SECRET`.
- Downloads: `SIGNED_DOWNLOADS`, `DOWNLOAD_TOKEN_SECRET`.
- Security: `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, `CORS_ORIGINS`, `ALLOWED_HOSTS`, `FORCE_HTTPS`.
- Storage: `OUTPUT_DIR`, `TEMP_DIR`, `CACHE_DIR`, `COOKIES_PATH`, `COOKIE_STORE_PATH`.
- Optional providers: `DATABASE_URL`, `REDIS_URL`, `CLOUDINARY_URL`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, AI provider keys.

## Railway smoke tests after deploy

- `GET /`
- `GET /api/health`
- `GET /status`
- `GET /robots.txt`
- `GET /sitemap.xml`
- `GET /manifest.json`
- `GET /admin/dashboard` should redirect when logged out.
- Admin login should set an HttpOnly cookie and load dashboard data.
- `GET /api/health/full` should require admin auth or `HEALTHCHECK_SECRET`.

## Rollback

- Keep the previous Railway deployment available for rollback.
- Do not roll forward if tests/build fail.
- Rotate secrets if a deployment accidentally logs or exposes sensitive configuration.
