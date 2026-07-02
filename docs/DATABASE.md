# Database and Storage Notes

This project uses a mixed storage model:

- PostgreSQL can be configured with `DATABASE_URL` for production data where supported.
- Firebase Admin may be configured with `FIREBASE_SERVICE_ACCOUNT_BASE64` for Firebase-backed auth/forum/profile features.
- Local JSON/file stores are used as fallbacks for tickets, cookie metadata, appeals, and runtime state in development or when external services are unavailable.
- Converter job state is in memory unless a queue backend is configured.

## Safety rules

- Do not log `DATABASE_URL`, Firebase service account JSON, Redis URLs, cookies, or tokens.
- Optional database/Firebase failures should degrade ticket/forum/profile features instead of blocking the homepage.
- Do not run destructive migrations without a manual backup and rollback plan.

## Suggested indexes

If data is moved to PostgreSQL/Firestore collections, ensure safe indexes for:

- tickets: `ticketId`, `status`, `submittedAt`, `updatedAt`.
- forum messages: `room`, `createdAt`, `userId`.
- audit logs: `timestamp`, `action`, `targetType`.
- analytics/events: `event`, `timestamp`.
- jobs: `status`, `createdAt`, `completedAt`.

## Connection settings

Use placeholders only:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
DATABASE_SSL=true
DB_POOL_MIN=0
DB_POOL_MAX=5
DB_CONNECTION_TIMEOUT_MS=10000
DB_IDLE_TIMEOUT_MS=30000
```
