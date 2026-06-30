// Route implementation is mounted in index.js to stay compatible with the existing single-file Express app.
// This module documents the supported admin cookies API paths for future extraction:
export const adminCookiesRoutes = [
  "POST /api/admin/cookies/upload",
  "GET /api/admin/cookies/status",
  "POST /api/admin/cookies/test",
  "DELETE /api/admin/cookies",
];
