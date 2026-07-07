# Privacy Data Map

| Data | Source | Purpose | Storage | Retention | Third parties | Access |
| --- | --- | --- | --- | --- | --- | --- |
| Media URL/domain | User converter form | Metadata fetch/conversion | Runtime job/cache metadata; should prefer hashed keys | Output/job TTL | yt-dlp target provider, optional worker | User session/admin diagnostics |
| Converted file | Converter output | User download | `OUTPUT_DIR` / public jobs storage with signed links where enabled | `OUTPUT_TTL_MINUTES` | Cloudinary if audio save enabled | Requesting user via signed/temporary link |
| Temp files | Converter pipeline | Processing | `TEMP_DIR` | Short cleanup window | None unless uploaded | Server only |
| YouTube cookies | Admin upload | Access content requiring server cookies | `COOKIES_PATH` and metadata store | Until replaced/deleted | YouTube via yt-dlp | Admin/server only; never public response |
| Google profile/email | Google auth | User account/profile/history | Firebase/file/user store | Account lifecycle/manual deletion | Google/Firebase | User/admin support as needed |
| Support tickets | Support form | Helpdesk and abuse response | Ticket store / Firebase/file fallback | `RETENTION_TICKETS_DAYS` target | Email provider/Cloudinary for attachments | User via ticket ID, admin |
| Forum messages/reports/appeals | Community UI | Community interaction/moderation | Runtime/Firebase/file fallback depending configuration | Moderation policy/manual deletion | Firebase/Cloudinary if configured | Participants/admin/moderators |
| Voice-call metadata | Socket.IO signaling | Call setup and abuse handling | Runtime socket state/session replay summaries | Short operational window | TURN provider if configured | Participants/admin diagnostics |
| Admin audit events | Admin actions | Security audit | In-process audit summary currently | `RETENTION_AUDIT_LOGS_DAYS` target when persisted | None | Admin only |
| Request IDs/log metadata | HTTP/API | Observability/support | Logs/metrics | Operational retention | Sentry if configured | Operators/admin |
| Analytics events | Public UI helper | Product metrics | No-op unless enabled | `RETENTION_ANALYTICS_DAYS` target | Configured analytics endpoint if enabled | Operators/admin summaries |

## User rights workflow

Users should use `/data-request` for access, correction, export, deletion, copyright, or privacy requests. The endpoint creates a support ticket with a status link so admins can verify ownership before deleting account, ticket, attachment, forum, or conversion history data.
