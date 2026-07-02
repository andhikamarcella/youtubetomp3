# YTConv Audit Report

Date: 2026-07-02 UTC.

## Repository inventory

- Production root app: custom Node.js/Express server in `index.js` with Socket.IO attached to the same HTTP server.
- Static frontend: `public-ui/` served by Express. The production root package uses `npm start` -> `node index.js`.
- Secondary Next.js app: `next-app/` exists with App Router and Pages Router code, but it is not the root production start command.
- Worker service: `worker-service/server.js` provides a separate Express converter worker API protected by shared-secret auth.
- Package manager: npm with `package-lock.json`.
- Database/storage: PostgreSQL schema docs in `sql/schema.sql`, Firebase Admin/file fallbacks in store modules, local JSON/file fallbacks for tickets/appeals/cookies.
- Cloudinary: root server uses `cloudinary` package for upload/signature/delete flows.
- Firebase: `firebase-admin` is used by user/profile/history stores where configured.
- Auth: user sessions use server-created session tokens/cookies; admin supports signed HttpOnly cookie sessions plus legacy server-side bearer compatibility.
- Turnstile: `src/lib/turnstile.js` verifies tokens server-side for protected flows.
- Converter: yt-dlp/ffmpeg are invoked via `spawn` with argument arrays in `index.js` and service helpers.
- Queue/job storage: in-memory converter/background queues in root server; worker service also keeps job metadata in memory.
- PWA/static assets: `public-ui/manifest.json`, `manifest.webmanifest`, `sw.js`, `robots.txt`, `sitemap.xml`.
- Railway/deploy: `railway.toml`, `Dockerfile`, root `package.json`, and `docs/RAILWAY_DEPLOYMENT.md`.
- Tests: Node test runner via `npm test`, with tests under `tests/*.test.js`.

## Baseline command results

| Command | Result | Notes |
| --- | --- | --- |
| `npm install --ignore-scripts --no-audit --no-fund` | Pass | Dependencies already up to date. |
| `npm run lint` | Baseline fail | Root package does not define a lint script. |
| `npm run typecheck` | Baseline fail | Root package does not define a typecheck script. |
| `npm test` | Pass | 68 tests passed before this change. |
| `npm run build` | Pass | `node --check index.js` passed. |

## Baseline risks found

- Admin dashboard HTML was reachable without a valid admin session, even though its data APIs were protected. This leaked UI structure and contradicted the server-side admin page protection goal.
- Existing admin frontend pages depended on a non-secret `sessionStorage` marker before loading admin APIs, which could prevent a valid HttpOnly-cookie session from loading data after refresh/direct navigation.
- There is no root lint or typecheck script, so CI cannot yet enforce those checks.
- Full converter/browser matrix and live external-provider tests require credentials, external media access, and browser automation that are not configured in this repository.
- Dirty `node_modules` state was present at start of this task; it was restored/cleaned and not included in the patch.
