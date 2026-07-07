# Implementation Plan

## Current pass scope

This pass prioritizes high-impact, backward-compatible fixes that can be completed safely in-repo without production credentials or a framework rewrite.

## Checklist

- [x] Inspect repository structure, framework, package manager, routes, worker, static frontend, PWA assets, and tests.
- [x] Run baseline install/lint/typecheck/test/build commands and document the results.
- [x] Create audit, security, test matrix, privacy data map, and deployment checklist docs.
- [x] Protect admin HTML routes server-side by redirecting unauthenticated users to an admin login page.
- [x] Add a dedicated admin login page that uses the existing `/admin/login` endpoint and supports Turnstile when configured.
- [x] Keep admin bearer/token secrets out of Web Storage; only a non-secret UI marker is used after login.
- [x] Ensure valid cookie sessions can load admin dashboard/tickets/cookies pages after refresh.
- [x] Add regression coverage for unauthenticated admin dashboard access.
- [x] Re-run test/build and route smoke checks.
- [x] Add Batch 1 converter state machine/error taxonomy helper.
- [x] Persist converter job snapshots to runtime cache storage.
- [x] Add async job idempotency, cancel, retry, expiry cleanup, and graceful shutdown persistence.
- [x] Add converter state unit tests.

- [x] Add Batch 2 admin CSRF token issuance and enforcement for cookie-session admin writes.
- [x] Restrict admin Socket.IO streams to authenticated admin sockets and add per-event socket guardrails.
- [x] Deepen converter URL safety with HTTPS-only and DNS/private-IP checks.
- [x] Validate forum image uploads with data URI parsing, magic-byte checks, MIME mismatch rejection, dimensions, and size limits.
- [x] Tighten production CSP by removing `unsafe-eval` and enumerating required script origins.
- [x] Add Batch 2 security regression tests for URL safety, upload magic bytes, and production CSP.

- [x] Add Batch 3 refresh-safe routes for studio, history, assistant, community, support, account, rewards, cookies, data request, and community guidelines.
- [x] Focus `/` on the converter by forcing the converter route and hiding secondary floating widgets on the home route.
- [x] Move navigation affordances to professional route labels: Converter, Studio, Bantuan, Rewards, Komunitas, Profil.
- [x] Remove public settings shortcuts for admin login/admin cookies while keeping protected admin pages available under `/admin`.
- [x] Rename user-facing “Mode Saya Gaptek” copy to “Mode Mudah” without changing the existing mode implementation.
- [x] Add frontend IA regression tests and route smoke checks.

- [x] Add Batch 4 full legal pages for privacy, terms, cookies, copyright, data request, and community guidelines.
- [x] Implement `/api/data-request` so privacy/copyright/data requests create trackable support tickets.
- [x] Update status page to consume live `/api/status` dependency health instead of static maintenance-only data.
- [x] Expose safe public service status for API, converter, queue, storage, database, Firebase, Cloudinary, Turnstile, AI, and realtime without secrets.
- [x] Keep app version unified through runtime `APP_VERSION` in health/status/changelog.
- [x] Add Batch 4 tests for legal copy, data-request route wiring, public status API, and no secret leakage.

- [x] Add Batch 5 dynamic `/api/ai/models` response with public Auto/Cepat/Pintar modes and optional advanced configured-model details.
- [x] Reject unavailable technical AI model names instead of hardcoding unsupported provider choices.
- [x] Add forum report/block APIs plus socket report/block events and per-recipient blocked-user filtering.
- [x] Require forum join authorization checks before forum messages, reports, blocks, and voice signaling.
- [x] Add voice-call consent requirement, active-call participant tracking, and disconnect cleanup.
- [x] Add private-share unlock attempt throttling.
- [x] Version PWA caches, add cache-reset/update messages, add offline fallback, and keep sensitive/private routes excluded.
- [x] Keep rewards/gamification isolated behind `/rewards` with regression coverage for route isolation.

- [x] Add Batch 6 root lint/typecheck/audit/secret-scan scripts without adding heavy dependencies.
- [x] Add Batch 6 security regression tests for admin CSRF/auth, protected health/metrics, route-specific rate guards, Socket.IO authorization, and upload spoofing/size rejection.
- [x] Add Batch 6 E2E route smoke tests for refresh-safe public routes, PWA assets, admin protection, and safe health output.
- [x] Add Batch 6 static accessibility regression tests for converter landmarks, labels, aria-live, and policy/status page metadata.
- [x] Add GitHub Actions CI with install, lint, typecheck, unit/integration, security, E2E smoke, accessibility, build, audit, and secret scan steps.
- [x] Raise vulnerable direct Nodemailer dependency to a high-severity-audit-clean version while leaving Firebase major upgrades untouched.

## Deferred because they require external browser/device infrastructure or larger follow-up work

- [ ] Add Playwright/axe E2E browser matrix with Chromium, Firefox, WebKit and real keyboard flows.
- [ ] Perform deeper bundle-level code splitting for AI/forum/rewards/voice modules after the static frontend is modularized.
- [ ] Replace file-backed job snapshots with Redis/Valkey or database-backed durable queue for full active-job resume across Railway restarts.
