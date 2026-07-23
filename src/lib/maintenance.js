import "./ytDlpRuntimePreload.js";

const parseJson = (raw, fallback) => {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

const clamp = (value, min, max) => {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
};

export const parseMaintenance = (env = process.env) => {
  const active = /^(1|true|yes|on)$/i.test(String(env.MAINTENANCE_MODE || ""));
  const etaRaw = Number.parseInt(String(env.MAINTENANCE_ETA_MINUTES ?? ""), 10);
  const etaMinutes = Number.isFinite(etaRaw) && etaRaw >= 0 && etaRaw <= 7 * 24 * 60 ? etaRaw : null;
  return {
    active,
    id: String(env.MAINTENANCE_ID || "").replace(/^['\"]+|['\"]+$/g, "") || null,
    progress: clamp(env.MAINTENANCE_PROGRESS, 0, 100),
    etaMinutes,
    etaLabel: etaMinutes == null ? "TBD" : `${etaMinutes} menit`,
    detail: env.MAINTENANCE_DETAIL || "Kami sedang melakukan peningkatan stabilitas layanan.",
    tip: env.MAINTENANCE_TIP || "Silakan coba lagi beberapa saat lagi.",
    steps: parseJson(env.MAINTENANCE_STEPS_JSON, []),
    whatsNew: parseJson(env.MAINTENANCE_WHATS_NEW_JSON, []),
    services: parseJson(env.MAINTENANCE_SERVICES_JSON, {}),
  };
};

export const createMaintenanceMiddleware = (env) => (req, res, next) => {
  const maintenance = parseMaintenance(process.env);
  if (!maintenance.active) return next();
  if (/^\/(api\/health|admin|api\/admin|admin-cookies\.html|admin-dashboard\.html|admin-tickets\.html)/i.test(req.path.replace(/^\//, ""))) return next();
  if (req.path.startsWith("/api/")) return res.status(503).json({ ok: false, error: "maintenance_mode", message: maintenance.detail, maintenance });
  return next();
};
