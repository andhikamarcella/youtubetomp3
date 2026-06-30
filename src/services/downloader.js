export const ERROR_CATEGORIES = Object.freeze({
  BOT_CHECK: "BOT_CHECK",
  LOGIN_REQUIRED: "LOGIN_REQUIRED",
  AGE_RESTRICTED: "AGE_RESTRICTED",
  GEO_BLOCKED: "GEO_BLOCKED",
  PRIVATE_VIDEO: "PRIVATE_VIDEO",
  FORMAT_UNAVAILABLE: "FORMAT_UNAVAILABLE",
  RATE_LIMITED: "RATE_LIMITED",
  NETWORK_ERROR: "NETWORK_ERROR",
  YTDLP_MISSING: "YTDLP_MISSING",
  FFMPEG_MISSING: "FFMPEG_MISSING",
  UNKNOWN: "UNKNOWN",
});

export const createJobResponse = (job = {}) => ({
  ok: job.status !== "failed",
  jobId: job.id || job.jobId,
  status: job.status || "queued",
  progress: job.progress || 0,
  step: job.step || job.status || "queued",
  message: job.message || "",
  downloadUrl: job.downloadUrl || null,
  filename: job.filename || null,
  errorCategory: job.errorCategory || null,
  error: job.error || null,
  cached: Boolean(job.cached),
});
