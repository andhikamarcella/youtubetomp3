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

## Deferred because they require larger follow-up work

- [ ] Add root lint/typecheck tooling and CI pipeline.
- [ ] Add Playwright/axe E2E browser matrix.
- [ ] Perform deeper bundle-level code splitting for AI/forum/rewards/voice modules after the static frontend is modularized.
- [ ] Replace file-backed job snapshots with Redis/Valkey or database-backed durable queue for full active-job resume across Railway restarts.
