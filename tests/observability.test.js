import test from "node:test";
import assert from "node:assert/strict";
import { safeRequestId, hashForAudit, auditAdminAction, getAuditLog, getMetricsSnapshot, recordRequestMetric } from "../src/lib/observability.js";

const mockReq = (headers = {}) => ({
  requestId: "req-test-1234",
  ip: "203.0.113.10",
  socket: { remoteAddress: "203.0.113.10" },
  get(name) { return headers[name.toLowerCase()] || headers[name] || ""; },
});

test("safeRequestId accepts only safe request ids", () => {
  assert.equal(safeRequestId("abcDEF1234-_:.").startsWith("abcDEF1234"), true);
  const generated = safeRequestId("bad id with spaces and 🚫");
  assert.match(generated, /^[0-9a-f-]{36}$/i);
});

test("audit admin action redacts sensitive fields and hashes IP", () => {
  const entry = auditAdminAction({ req: mockReq({ "user-agent": "TestAgent secret-token" }), action: "admin_login", targetType: "session", targetId: "session-token-value", message: "ok" });
  assert.equal(entry.action, "admin_login");
  assert.equal(entry.ipHash, hashForAudit("203.0.113.10"));
  assert.equal(entry.requestId, "req-test-1234");
  assert.ok(getAuditLog({ limit: 1 })[0].id);
});

test("request metrics aggregate totals", () => {
  const before = getMetricsSnapshot().requests.total;
  recordRequestMetric({ status: 429, durationMs: 25 });
  const after = getMetricsSnapshot();
  assert.equal(after.requests.total, before + 1);
  assert.equal(after.requests.rateLimited >= 1, true);
});
