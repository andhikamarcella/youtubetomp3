# Railway Deployment Reliability

## Start and build

The root app is a custom Express server. Railway should run:

```bash
npm run build
npm start
```

The server listens on `process.env.PORT || 3000` and host `0.0.0.0`.

## Runtime directories

Prefer Railway volume paths for persistent state:

```env
OUTPUT_DIR=/data/ytconv/outputs
TEMP_DIR=/tmp/ytconv-jobs
CACHE_DIR=/data/ytconv/cache
COOKIES_PATH=/data/cookies.txt
COOKIE_STORE_PATH=/data/cookies-meta.json
```

## Health checks

Use `/api/health` for public/platform checks. Use `/api/health/full` only with admin auth or `HEALTHCHECK_SECRET`.

## Redis/Valkey

If configured, set:

```env
REDIS_URL=redis://default:PASSWORD@HOST:PORT
QUEUE_DRIVER=redis
FALLBACK_QUEUE_DRIVER=memory
```

Never log the Redis URL. If Redis is unavailable, the app should continue with memory fallback only where configured.

## Deployment verification

After deploy, check:

- `/`
- `/api/health`
- `/status`
- `/robots.txt`
- `/sitemap.xml`
- `/manifest.json`
- admin login and `/api/health/full`
