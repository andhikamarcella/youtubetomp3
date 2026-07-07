import { randomUUID, createHash } from "node:crypto";
import { redactSensitive } from "./security.js";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const SAFE_REQUEST_ID_RE = /^[A-Za-z0-9._:-]{8,128}$/;
const metrics = {
  startedAt: Date.now(),
  requests: { total: 0, byStatus: {}, errors: 0, rateLimited: 0, totalDurationMs: 0 },
  conversions: { started: 0, completed: 0, failed: 0, totalDurationMs: 0 },
  rateLimits: { hits: 0 },
  recentErrors: [],
};
const auditLog = [];
const MAX_RECENT = 100;

export const safeRequestId = (value) => {
  const raw = String(value || "").trim();
  return SAFE_REQUEST_ID_RE.test(raw) ? raw.slice(0, 128) : randomUUID();
};

export const hashForAudit = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
};

export const createLogger = (env = {}) => {
  const minLevel = LEVELS[String(env.LOG_LEVEL || "info").toLowerCase()] ?? LEVELS.info;
  const json = env.NODE_ENV === "production";
  const write = (level, message, fields = {}) => {
    if ((LEVELS[level] ?? LEVELS.info) < minLevel) return;
    const entry = redactSensitive({ timestamp: new Date().toISOString(), level, message, ...fields });
    const line = json ? JSON.stringify(entry) : `[${entry.timestamp}] ${level.toUpperCase()} ${message} ${JSON.stringify(entry)}`;
    const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    out(line);
  };
  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields),
  };
};

export const createRequestIdMiddleware = () => (req, res, next) => {
  const requestId = safeRequestId(req.get("x-request-id") || req.get("x-correlation-id"));
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};

export const createRequestLoggerMiddleware = ({ env = {}, logger = createLogger(env) } = {}) => (req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - started;
    recordRequestMetric({ status: res.statusCode, durationMs });
    if (!env.ENABLE_REQUEST_LOGS) return;
    const sensitive = /^\/(api\/admin|admin|api\/health\/full|api\/cloudinary\/signature|api\/upload|admin\/login|admin\/upload-cookies)/i.test(req.path || "");
    logger.info("request_completed", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
      route: req.route?.path,
      userAgent: req.get("user-agent")?.slice(0, 160),
      body: sensitive ? undefined : undefined,
    });
  });
  next();
};

export const recordRequestMetric = ({ status = 0, durationMs = 0 } = {}) => {
  metrics.requests.total += 1;
  metrics.requests.totalDurationMs += Number(durationMs) || 0;
  const bucket = String(status || 0);
  metrics.requests.byStatus[bucket] = (metrics.requests.byStatus[bucket] || 0) + 1;
  if (status >= 500) metrics.requests.errors += 1;
  if (status === 429) { metrics.requests.rateLimited += 1; metrics.rateLimits.hits += 1; }
};

export const recordError = (error, fields = {}) => {
  metrics.requests.errors += 1;
  const item = redactSensitive({ at: new Date().toISOString(), message: error?.message || String(error || "error"), code: error?.code, ...fields });
  metrics.recentErrors.push(item);
  if (metrics.recentErrors.length > MAX_RECENT) metrics.recentErrors.shift();
};

export const recordConversionMetric = (event, fields = {}) => {
  if (event === "started") metrics.conversions.started += 1;
  if (event === "completed") {
    metrics.conversions.completed += 1;
    metrics.conversions.totalDurationMs += Number(fields.durationMs) || 0;
  }
  if (event === "failed") metrics.conversions.failed += 1;
};

export const getMetricsSnapshot = () => {
  const avgRequestMs = metrics.requests.total ? Math.round(metrics.requests.totalDurationMs / metrics.requests.total) : 0;
  const avgConversionMs = metrics.conversions.completed ? Math.round(metrics.conversions.totalDurationMs / metrics.conversions.completed) : 0;
  return redactSensitive({ ...metrics, avgRequestMs, avgConversionMs, uptimeMs: Date.now() - metrics.startedAt });
};

export const auditAdminAction = ({ req, action, targetType = null, targetId = null, result = "success", message = "", adminId = "admin" } = {}) => {
  const entry = redactSensitive({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    adminId: String(adminId || "admin").slice(0, 80),
    action: String(action || "unknown").slice(0, 120),
    targetType: targetType ? String(targetType).slice(0, 80) : null,
    targetId: targetId ? String(targetId).slice(0, 160) : null,
    requestId: req?.requestId || null,
    ipHash: hashForAudit(req?.ip || req?.socket?.remoteAddress),
    userAgent: req?.get?.("user-agent")?.slice(0, 160) || null,
    result,
    message: String(message || "").slice(0, 500),
  });
  auditLog.push(entry);
  if (auditLog.length > MAX_RECENT) auditLog.shift();
  return entry;
};

export const getAuditLog = ({ limit = 50 } = {}) => auditLog.slice(-Math.max(1, Math.min(100, Number(limit) || 50))).reverse();
