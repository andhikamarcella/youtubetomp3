# Data Retention Policy

YTConv should keep operational data only as long as needed for reliability, support, and abuse prevention.

## Defaults

- Converted output files: `OUTPUT_TTL_MINUTES`.
- Temp files: approximately 1 hour.
- Cache files/metadata: `RETENTION_CACHE_HOURS`.
- Failed job metadata: `RETENTION_FAILED_JOBS_DAYS`.
- Completed job metadata: `RETENTION_COMPLETED_JOBS_DAYS`.
- Tickets/support: `RETENTION_TICKETS_DAYS` or manual admin deletion.
- Admin audit logs: `RETENTION_AUDIT_LOGS_DAYS`.
- Analytics summaries/events: `RETENTION_ANALYTICS_DAYS`.
- Cloudinary temp uploads: `RETENTION_CLOUDINARY_TEMP_HOURS` if Cloudinary cleanup is enabled.

## Environment placeholders

```env
RETENTION_FAILED_JOBS_DAYS=7
RETENTION_COMPLETED_JOBS_DAYS=1
RETENTION_TICKETS_DAYS=90
RETENTION_AUDIT_LOGS_DAYS=180
RETENTION_ANALYTICS_DAYS=90
RETENTION_CACHE_HOURS=24
RETENTION_CLOUDINARY_TEMP_HOURS=24
```

Cleanup code must only delete inside configured runtime directories (`OUTPUT_DIR`, `TEMP_DIR`, `CACHE_DIR`) and must log summaries only, not file contents or cookie data.
