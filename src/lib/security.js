const SENSITIVE_KEY_RE = /(authorization|cookie|token|secret|password|passwd|api[_-]?key|bearer|database_url|service_account|private_key|client_secret|cloudinary_url)/i;
const SENSITIVE_VALUE_RE = /(gsk_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]+|AIza[0-9A-Za-z_-]+|cloudinary:\/\/[^\s]+|postgres(?:ql)?:\/\/[^\s]+|Bearer\s+[A-Za-z0-9._~+\/-]+=*)/g;

export const redactSensitive = (value, depth = 0) => {
  if (depth > 5) return "[MaxDepth]";
  if (value == null) return value;
  if (typeof value === "string") return value.replace(SENSITIVE_VALUE_RE, "[REDACTED]");
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, SENSITIVE_KEY_RE.test(key) ? "[REDACTED]" : redactSensitive(val, depth + 1)]));
};

export const createSecurityHeadersMiddleware = (env) => (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  const connectSrc = [
    "'self'",
    "https:",
    "wss:",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://*.googleapis.com",
    "https://*.firebaseio.com",
    "wss://*.firebaseio.com",
    ...(env.CORS_ORIGINS || []),
  ].join(" ");
  const scriptSrc = env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://accounts.google.com https://challenges.cloudflare.com https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:";
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https: https://lh3.googleusercontent.com",
    "font-src 'self' data: https:",
    `connect-src ${connectSrc}`,
    "media-src 'self' blob: data: https:",
    "frame-src 'self' https://www.youtube.com https://accounts.google.com https://forum-warga.firebaseapp.com https://challenges.cloudflare.com https://*.firebaseapp.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com",
  ].join("; "));
  if (env.NODE_ENV === "production" || env.FORCE_HTTPS) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
};

export const createCorsOptions = (env) => {
  const allowed = new Set((env.CORS_ORIGINS || []).filter(Boolean));
  try { allowed.add(new URL(env.PUBLIC_BASE_URL).origin); } catch {}
  return {
    credentials: true,
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowed.has(origin)) return cb(null, true);
      if (env.NODE_ENV !== "production") return cb(null, true);
      return cb(new Error("cors_origin_denied"), false);
    },
  };
};

export const noStoreForSensitive = (req, res, next) => {
  if (/^\/(api\/admin|admin|admin-cookies\.html|admin-dashboard\.html|admin-tickets\.html)/i.test(req.path.replace(/^\//, ""))) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
  }
  next();
};
