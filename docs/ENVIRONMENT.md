# YTConv Environment Variables

Do **not** commit real secrets. Rotate any token, API key, OAuth secret, database URL, Firebase service account, Cloudinary URL, or bearer token that has been pasted into chat, logs, screenshots, or a public issue.

Use `.env.example` as a safe template only. In Railway, configure values in the Variables tab and mount a persistent volume for `/data` when using server cookies and cached outputs.

## Required in production

- `PUBLIC_BASE_URL`, `NEXTAUTH_URL`, `WORKER_API_BASE`
- `SESSION_SECRET` or the legacy `USER_SESSION_SECRET`
- `ADMIN_USER_HASH`, `ADMIN_PASS_HASH`, `ADMIN_BEARER`
- `TURNSTILE_SECRET_KEY` when `TURNSTILE_STRICT=true`
- `DOWNLOAD_TOKEN_SECRET` when `SIGNED_DOWNLOADS=true`
- `COOKIES_PATH=/data/cookies.txt` and `COOKIE_STORE_PATH=/data/cookies-meta.json` when `ENABLE_SERVER_COOKIES=true`

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

`YTDLP_PATH`, `FFMPEG_PATH`, and `FFPROBE_PATH` may be empty if binaries are on `PATH`. Configure `YTDLP_JS_RUNTIME=node` for the supported yt-dlp JavaScript runtime.

## Security and abuse controls

Enable `RATE_LIMIT_ENABLED`, restrict `CORS_ORIGINS`, set `ALLOWED_HOSTS`, keep `FORCE_HTTPS=true`, and use `TURNSTILE_STRICT=true` in production. Dangerous media URLs are rejected when `BLOCK_PRIVATE_IP_URLS`, `BLOCK_LOCALHOST_URLS`, and `BLOCK_FILE_PROTOCOL` are enabled.

## Maintenance mode

Maintenance JSON fields are parsed safely. Invalid JSON falls back to an empty list/object and does not crash the app. Keep text professional and use realistic ETA values; very large ETAs are shown as `TBD`.
