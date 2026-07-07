# Observability

YTConv uses a lightweight in-process observability layer for production operations without requiring external services.

## Request IDs

Every HTTP response includes `x-request-id`. Incoming `x-request-id`/`x-correlation-id` values are accepted only when they match a safe character/length pattern; otherwise the server generates a new UUID.

## Structured logs

`src/lib/observability.js` provides the structured logger. In production it writes JSON logs containing timestamp, level, message, requestId, method/path/status, duration, job IDs, and safe operational fields. Sensitive keys and common secret patterns are redacted before output.

Relevant environment variables:

```env
LOG_LEVEL=info
ENABLE_REQUEST_LOGS=true
ENABLE_ERROR_STACKS=false
SENTRY_DSN=
```

## Sentry

Sentry is optional. If `SENTRY_DSN` is empty, the application runs normally. When wiring Sentry in Railway, keep request bodies, cookies, authorization headers, and uploaded files disabled in event payloads. Tag events with `requestId`, route, app version, and environment.

## Admin metrics

Admin-only endpoints expose safe diagnostics:

- `/api/health/full` — protected by admin auth or `HEALTHCHECK_SECRET`.
- `/api/admin/metrics` — protected by admin auth and returns aggregate request, conversion, queue, recent error, and audit summaries.

These endpoints must never include database URLs, Redis URLs, cookies, API keys, bearer tokens, or service account JSON.
