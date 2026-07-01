# Backup and Restore

This document is an operational checklist. It intentionally uses placeholders and does not contain secrets.

## What to back up

- Railway PostgreSQL: enable scheduled backups/snapshots in Railway or your PostgreSQL provider.
- Firebase/Firestore: use Firebase exports for collections used by auth/forum/profile/tickets.
- Cloudinary: keep important source assets backed up outside Cloudinary when needed.
- `/data` volume: back up cookie metadata and required persistent metadata. Treat cookies as sensitive secrets.

## What usually should not be backed up

- Temporary converted files.
- Failed partial downloads.
- Cache directories that can be regenerated.
- Public copies of YouTube cookies.

## Restore checklist

1. Restore PostgreSQL/Firebase/Cloudinary data from provider backups.
2. Restore required `/data` files securely.
3. Recreate Railway variables using placeholders as a guide:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
REDIS_URL=redis://default:PASSWORD@HOST:PORT
FIREBASE_SERVICE_ACCOUNT_BASE64=BASE64_JSON_PLACEHOLDER
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
ADMIN_JWT_SECRET=replace-with-random-secret
HEALTHCHECK_SECRET=replace-with-random-secret
```

4. Deploy and verify `/api/health`, `/api/health/full`, `/status`, and admin login.
5. Rotate any secret that may have been exposed during an incident.
