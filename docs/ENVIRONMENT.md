# YTConv Environment Variables

Do **not** commit real secrets. Rotate any token, API key, OAuth secret, database URL, Firebase service account, Cloudinary URL, or bearer token that has been pasted into chat, logs, screenshots, or a public issue.

Use `.env.example` as a safe template only. In Railway, configure values in the Variables tab and mount a persistent volume for `/data` when using server cookies and cached outputs.

## Required in production

- `PUBLIC_BASE_URL`, `NEXTAUTH_URL`, `WORKER_API_BASE`
- `SESSION_SECRET` or the legacy `USER_SESSION_SECRET`
- `ADMIN_USER_HASH`, `ADMIN_PASS_HASH`, `ADMIN_BEARER`, `ADMIN_JWT_SECRET`
- `TURNSTILE_SECRET_KEY` when `TURNSTILE_STRICT=true`
- `DOWNLOAD_TOKEN_SECRET` when `SIGNED_DOWNLOADS=true`
- `COOKIES_PATH=/data/cookies.txt` and `COOKIE_STORE_PATH=/data/cookies-meta.json` when `ENABLE_SERVER_COOKIES=true`

## Admin sessions

`ADMIN_BEARER` is kept server-side for service-to-service/admin API authorization and must not be embedded in frontend JavaScript. Browser admin login uses the username/password hashes to mint an HTTP-only `ADMIN_JWT_SECRET`-signed session cookie; admin pages may render their login shells, but dashboard/cookie/ticket data still comes only from protected `/api/admin/*` endpoints.

## Secret server-only variables

Keep these server-side only: `DATABASE_URL`, `NEXTAUTH_SECRET`, `SESSION_SECRET`, `COOKIE_SECRET`, `ENCRYPTION_KEY`, `JWT_SECRET`, `CSRF_SECRET`, admin hashes/tokens, `TURNSTILE_SECRET_KEY`, Google/Firebase service account values, Cloudinary URLs/API secrets, Spotify/Groq/Gemini/OAI keys, worker/internal secrets, cookie paths, signed-download secrets, SMTP credentials, and Sentry DSN.

## Public/client-safe variables

Only expose values that are intentionally public, such as `TURNSTILE_SITE_KEY`, Firebase web client config (`FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_STORAGE_BUCKET`), and `PUBLIC_BASE_URL`. Never expose service-account JSON or private API secrets.

## Converter and Railway storage

Use `/data` for persistent Railway volume data:

- `COOKIES_PATH=/data/cookies.txt`
- `COOKIE_STORE_PATH=/data/cookies-meta.json`
- `OUTPUT_DIR=/data/ytconv/outputs`
- `CACHE_DIR=/data/ytconv/cache`
- `TEMP_DIR=/tmp/ytconv-jobs`

`YTDLP_PATH`, `FFMPEG_PATH`, and `FFPROBE_PATH` may be empty if binaries are on `PATH`. Configure `YTDLP_JS_RUNTIME=deno` (default in Docker) for yt-dlp JavaScript challenge solving; use `auto` to fall back to Node >= 22 when Deno is unavailable.

## Security and abuse controls

Enable `RATE_LIMIT_ENABLED`, restrict `CORS_ORIGINS`, set `ALLOWED_HOSTS`, keep `FORCE_HTTPS=true`, and use `TURNSTILE_STRICT=true` in production. Dangerous media URLs are rejected when `BLOCK_PRIVATE_IP_URLS`, `BLOCK_LOCALHOST_URLS`, and `BLOCK_FILE_PROTOCOL` are enabled.

## Rate limit groups

All API routes can use the global limiter. High-risk public actions have dedicated knobs: `CONVERT_RATE_LIMIT_*`, `AUTH_RATE_LIMIT_*`, `TICKET_RATE_LIMIT_*`, `AI_RATE_LIMIT_*`, and `UPLOAD_RATE_LIMIT_*`. Keep upload/signature limits lower than general API limits because those routes can create Cloudinary-side cost and storage pressure.

## Maintenance mode

Maintenance JSON fields are parsed safely. Invalid JSON falls back to an empty list/object and does not crash the app. Keep text professional and use realistic ETA values; very large ETAs are shown as `TBD`.

## P3 observability, cache, moderation, and retention

All values below are safe placeholders. Keep secrets in Railway variables only.

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `MODERATION_ENABLED` | private | optional | Enables lightweight abuse/moderation guardrails. |
| `CACHE_ENABLED` | private | optional | Enables safe metadata/result cache behavior where implemented. |
| `ANALYTICS_ENABLED` | private/public-config | optional | Disabled by default; only non-sensitive events should be stored/sent. |
| `ANALYTICS_PROVIDER` | private | optional | Use `none` unless an approved privacy-friendly provider is configured. |
| `ANALYTICS_ENDPOINT` | private | optional | Endpoint for sanitized events; never include secrets in the URL. |
| `METADATA_CACHE_TTL_SECONDS` | private | optional | TTL for metadata cache keys based on URL hashes/domains. |
| `RESULT_CACHE_TTL_SECONDS` | private | optional | TTL for duplicate-result cache while output still exists. |
| `MAX_LINKS_PER_MESSAGE` | private | optional | Simple spam control for user-generated messages. |
| `SPAM_DUPLICATE_WINDOW_MS` | private | optional | Duplicate-message abuse window. |
| `SPAM_DUPLICATE_MAX` | private | optional | Duplicate-message threshold. |
| `BANNED_DOMAINS` | private | optional | Comma-separated moderation domains; no secrets. |
| `BANNED_KEYWORDS` | private | optional | Comma-separated moderation keywords; avoid sensitive data. |
| `RETENTION_FAILED_JOBS_DAYS` | private | optional | Failed job metadata retention. |
| `RETENTION_COMPLETED_JOBS_DAYS` | private | optional | Completed job metadata retention. |
| `RETENTION_TICKETS_DAYS` | private | optional | Ticket/support retention target. |
| `RETENTION_AUDIT_LOGS_DAYS` | private | optional | Admin audit log retention target. |
| `RETENTION_ANALYTICS_DAYS` | private | optional | Sanitized analytics retention target. |
| `RETENTION_CACHE_HOURS` | private | optional | Cache file/metadata retention target. |
| `RETENTION_CLOUDINARY_TEMP_HOURS` | private | optional | Cloudinary temp upload retention target. |
