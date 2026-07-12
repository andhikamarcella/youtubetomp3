import { basename } from "node:path";

export const CONVERTER_STATES = Object.freeze({
  IDLE: "idle",
  VALIDATING_URL: "validating_url",
  FETCHING_METADATA: "fetching",
  WAITING_FOR_VERIFICATION: "waiting_for_verification",
  QUEUED: "queued",
  DOWNLOADING_SOURCE: "downloading",
  PROCESSING: "converting",
  UPLOADING_RESULT: "uploading",
  READY: "completed",
  CANCELLED: "cancelled",
  FAILED: "failed",
  EXPIRED: "expired",
});

export const CONVERTER_ERROR_CODES = Object.freeze({
  INVALID_URL: "INVALID_URL",
  UNSUPPORTED_PROVIDER: "UNSUPPORTED_PROVIDER",
  CONTENT_UNAVAILABLE: "CONTENT_UNAVAILABLE",
  PRIVATE_CONTENT: "PRIVATE_CONTENT",
  REGION_BLOCKED: "REGION_BLOCKED",
  AGE_RESTRICTED: "AGE_RESTRICTED",
  LOGIN_REQUIRED: "LOGIN_REQUIRED",
  COOKIES_EXPIRED: "COOKIES_EXPIRED",
  RATE_LIMITED: "RATE_LIMITED",
  SERVER_BUSY: "SERVER_BUSY",
  QUEUE_FULL: "QUEUE_FULL",
  FORMAT_UNAVAILABLE: "FORMAT_UNAVAILABLE",
  DOWNLOAD_FAILED: "DOWNLOAD_FAILED",
  PROCESSING_FAILED: "PROCESSING_FAILED",
  UPLOAD_FAILED: "UPLOAD_FAILED",
  DOWNLOAD_EXPIRED: "DOWNLOAD_EXPIRED",
  NETWORK_INTERRUPTED: "NETWORK_INTERRUPTED",
  JOB_NOT_FOUND: "JOB_NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CANCELLED: "CANCELLED",
  SERVER_RESTARTED: "SERVER_RESTARTED",
});

const RETRYABLE = new Set([
  CONVERTER_ERROR_CODES.RATE_LIMITED,
  CONVERTER_ERROR_CODES.SERVER_BUSY,
  CONVERTER_ERROR_CODES.QUEUE_FULL,
  CONVERTER_ERROR_CODES.DOWNLOAD_FAILED,
  CONVERTER_ERROR_CODES.PROCESSING_FAILED,
  CONVERTER_ERROR_CODES.UPLOAD_FAILED,
  CONVERTER_ERROR_CODES.NETWORK_INTERRUPTED,
  CONVERTER_ERROR_CODES.SERVER_RESTARTED,
]);

export const normalizeConverterErrorCode = (code, fallback = CONVERTER_ERROR_CODES.INTERNAL_ERROR) => {
  const raw = String(code || "").trim().toUpperCase();
  return Object.values(CONVERTER_ERROR_CODES).includes(raw) ? raw : fallback;
};

export const buildConverterError = ({ code, message, retryable, correlationId, details } = {}) => {
  const safeCode = normalizeConverterErrorCode(code);
  return {
    code: safeCode,
    message: String(message || "Gagal memproses media. Silakan coba lagi.").slice(0, 500),
    retryable: typeof retryable === "boolean" ? retryable : RETRYABLE.has(safeCode),
    correlationId: correlationId || null,
    ...(details ? { details: String(details).slice(0, 300) } : {}),
  };
};

export const publicJobSnapshot = (job = {}) => {
  const error = job.error
    ? (typeof job.error === "object"
      ? buildConverterError(job.error)
      : buildConverterError({ code: job.errorCategory, message: job.error }))
    : null;
  return {
    id: String(job.id || ""),
    status: String(job.status || CONVERTER_STATES.QUEUED),
    progress: Math.max(0, Math.min(100, Number(job.progress || 0))),
    step: String(job.step || job.status || CONVERTER_STATES.QUEUED),
    message: String(job.message || "").slice(0, 500),
    filename: job.filename ? basename(String(job.filename)) : null,
    downloadUrl: job.downloadUrl || null,
    error,
    errorCategory: job.errorCategory || error?.code || null,
    hint: job.hint || null,
    createdAt: job.createdAt || null,
    startedAt: job.startedAt || null,
    completedAt: job.completedAt || null,
    durationMs: job.durationMs || null,
    cached: Boolean(job.cached),
  };
};

export const serializeJobStore = (jobs = []) => ({
  version: 1,
  savedAt: Date.now(),
  jobs: Array.from(jobs).map((job) => ({
    id: job.id,
    payload: job.payload || null,
    cacheKey: job.cacheKey || null,
    status: job.status,
    progress: job.progress || 0,
    step: job.step || job.status,
    message: job.message || "",
    filename: job.filename || null,
    downloadUrl: job.downloadUrl || null,
    error: job.error || null,
    errorCategory: job.errorCategory || null,
    hint: job.hint || null,
    createdAt: job.createdAt || Date.now(),
    startedAt: job.startedAt || null,
    completedAt: job.completedAt || null,
    durationMs: job.durationMs || null,
    cached: Boolean(job.cached),
    logs: Array.isArray(job.logs) ? job.logs.slice(-50) : [],
  })),
});

export const hydratePersistedJobs = (store = {}, now = Date.now(), jobTtlMs = 60 * 60_000) => {
  const jobs = Array.isArray(store.jobs) ? store.jobs : [];
  return jobs
    .filter((job) => job?.id && now - Number(job.createdAt || now) <= jobTtlMs)
    .map((job) => {
      const activeAtShutdown = [CONVERTER_STATES.FETCHING_METADATA, CONVERTER_STATES.DOWNLOADING_SOURCE, CONVERTER_STATES.PROCESSING, CONVERTER_STATES.UPLOADING_RESULT].includes(job.status);
      if (!activeAtShutdown) return job;
      return {
        ...job,
        status: CONVERTER_STATES.FAILED,
        step: CONVERTER_STATES.FAILED,
        progress: Math.min(Number(job.progress || 0), 99),
        errorCategory: CONVERTER_ERROR_CODES.SERVER_RESTARTED,
        error: buildConverterError({ code: CONVERTER_ERROR_CODES.SERVER_RESTARTED, message: "Server restart saat job berjalan. Silakan retry." }),
        logs: [...(Array.isArray(job.logs) ? job.logs.slice(-49) : []), "Recovered as failed after server restart"],
      };
    });
};
