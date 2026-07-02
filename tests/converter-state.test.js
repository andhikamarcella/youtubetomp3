import test from "node:test";
import assert from "node:assert/strict";
import { CONVERTER_ERROR_CODES, CONVERTER_STATES, buildConverterError, hydratePersistedJobs, publicJobSnapshot, serializeJobStore } from "../src/lib/converterState.js";

test("converter error taxonomy normalizes retryable errors", () => {
  const error = buildConverterError({ code: "QUEUE_FULL", message: "Antrean penuh", correlationId: "req-1" });
  assert.equal(error.code, CONVERTER_ERROR_CODES.QUEUE_FULL);
  assert.equal(error.retryable, true);
  assert.equal(error.correlationId, "req-1");
});

test("public job snapshot strips unsafe path segments", () => {
  const snapshot = publicJobSnapshot({ id: "j1", filename: "../../secret.mp3", status: CONVERTER_STATES.READY, progress: 100 });
  assert.equal(snapshot.filename, "secret.mp3");
  assert.equal(snapshot.status, CONVERTER_STATES.READY);
});

test("persisted active jobs recover as failed after restart", () => {
  const store = serializeJobStore([{ id: "j2", status: CONVERTER_STATES.PROCESSING, progress: 40, createdAt: Date.now(), logs: ["started"] }]);
  const [job] = hydratePersistedJobs(store, Date.now(), 60_000);
  assert.equal(job.status, CONVERTER_STATES.FAILED);
  assert.equal(job.errorCategory, CONVERTER_ERROR_CODES.SERVER_RESTARTED);
  assert.match(job.error.message, /restart/i);
});
