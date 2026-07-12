import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const truthy = /^(1|true|yes|on)$/i;
const falsy = /^(0|false|no|off)$/i;

const bool = (value, fallback = false) => {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  if (truthy.test(raw)) return true;
  if (falsy.test(raw)) return false;
  return fallback;
};

const int = (value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const str = (value, fallback = "") => {
  const raw = String(value ?? "").trim();
  return raw || fallback;
};

const csv = (value, fallback = []) => {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  return raw.split(",").map((item) => item.trim()).filter(Boolean);
};

const redactUrl = (value) => {
  const raw = String(value || "");
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (url.password) url.password = "***";
    if (url.username) url.username = `${url.username.slice(0, 2)}***`;
    return url.toString();
  } catch {
    return raw.replace(/(:\/\/[^:\s]+:)[^@\s]+@/g, "$1***@");
  }
};

const requireInProduction = (env, keys) => {
  if (env.NODE_ENV !== "production") return [];
  return keys.filter((key) => !str(env[key]));
};

export const loadEnv = (rawEnv = process.env) => {
  const nodeEnv = str(rawEnv.NODE_ENV, "development");
  const appEnv = str(rawEnv.APP_ENV, nodeEnv === "production" ? "production" : "development");
  const publicBaseUrl = str(rawEnv.PUBLIC_BASE_URL || rawEnv.NEXTAUTH_URL || rawEnv.WORKER_API_BASE, "http://localhost:3000").replace(/\/$/, "");
  const outputDir = str(rawEnv.OUTPUT_DIR, "/data/ytconv/outputs");
  const tempDir = str(rawEnv.TEMP_DIR, "/tmp/ytconv-jobs");
  const cacheDir = str(rawEnv.CACHE_DIR, "/data/ytconv/cache");

  const env = {
    NODE_ENV: nodeEnv,
    APP_ENV: appEnv,
    APP_NAME: str(rawEnv.APP_NAME, "YTConv"),
    APP_VERSION: str(rawEnv.APP_VERSION, "v4.0.0"),
    PUBLIC_BASE_URL: publicBaseUrl,
    NEXTAUTH_URL: str(rawEnv.NEXTAUTH_URL, publicBaseUrl),
    WORKER_API_BASE: str(rawEnv.WORKER_API_BASE, publicBaseUrl),
    PORT: int(rawEnv.PORT, 3000, { min: 0, max: 65535 }),
    TRUST_PROXY: bool(rawEnv.TRUST_PROXY, true),
    LOG_LEVEL: str(rawEnv.LOG_LEVEL, nodeEnv === "production" ? "info" : "debug"),

    DATABASE_URL: str(rawEnv.DATABASE_URL),
    DATABASE_SSL: bool(rawEnv.DATABASE_SSL, nodeEnv === "production"),
    DB_POOL_MIN: int(rawEnv.DB_POOL_MIN, 0, { min: 0, max: 50 }),
    DB_POOL_MAX: int(rawEnv.DB_POOL_MAX, 5, { min: 1, max: 100 }),
    DB_CONNECTION_TIMEOUT_MS: int(rawEnv.DB_CONNECTION_TIMEOUT_MS, 10_000, { min: 100, max: 120_000 }),
    DB_IDLE_TIMEOUT_MS: int(rawEnv.DB_IDLE_TIMEOUT_MS, 30_000, { min: 1_000, max: 600_000 }),

    NEXTAUTH_SECRET: str(rawEnv.NEXTAUTH_SECRET),
    SESSION_SECRET: str(rawEnv.SESSION_SECRET || rawEnv.USER_SESSION_SECRET),
    COOKIE_SECRET: str(rawEnv.COOKIE_SECRET),
    ENCRYPTION_KEY: str(rawEnv.ENCRYPTION_KEY || rawEnv.COOKIES_ENCRYPTION_KEY),
    JWT_SECRET: str(rawEnv.JWT_SECRET),
    CSRF_SECRET: str(rawEnv.CSRF_SECRET),
    SECURE_COOKIES: bool(rawEnv.SECURE_COOKIES, nodeEnv === "production"),
    COOKIE_SAME_SITE: str(rawEnv.COOKIE_SAME_SITE, "lax"),
    COOKIE_HTTP_ONLY: bool(rawEnv.COOKIE_HTTP_ONLY, true),
    COOKIE_MAX_AGE_SECONDS: int(rawEnv.COOKIE_MAX_AGE_SECONDS, 60 * 60 * 24 * 30, { min: 60, max: 60 * 60 * 24 * 365 }),
    CORS_ORIGINS: csv(rawEnv.CORS_ORIGINS, [publicBaseUrl]),
    ALLOWED_HOSTS: csv(rawEnv.ALLOWED_HOSTS, []),
    FORCE_HTTPS: bool(rawEnv.FORCE_HTTPS, nodeEnv === "production"),

    ADMIN_USERNAME: str(rawEnv.ADMIN_USERNAME),
    ADMIN_USER_HASH: str(rawEnv.ADMIN_USER_HASH),
    ADMIN_PASS_HASH: str(rawEnv.ADMIN_PASS_HASH),
    ADMIN_BEARER: str(rawEnv.ADMIN_BEARER),
    ADMIN_JWT_SECRET: str(rawEnv.ADMIN_JWT_SECRET),
    ADMIN_SESSION_TTL_SECONDS: int(rawEnv.ADMIN_SESSION_TTL_SECONDS, 60 * 60 * 8, { min: 300, max: 60 * 60 * 24 * 30 }),
    ENABLE_CHEATS: bool(rawEnv.ENABLE_CHEATS, false),
    LOAD_TEST_REPORT_TOKEN: str(rawEnv.LOAD_TEST_REPORT_TOKEN),

    TURNSTILE_SITE_KEY: str(rawEnv.TURNSTILE_SITE_KEY),
    TURNSTILE_SECRET_KEY: str(rawEnv.TURNSTILE_SECRET_KEY),
    TURNSTILE_STRICT: bool(rawEnv.TURNSTILE_STRICT, false),
    TURNSTILE_REQUIRED_ROUTES: csv(rawEnv.TURNSTILE_REQUIRED_ROUTES, ["/api/convert", "/api/contact", "/admin/login", "/api/assistant-chat"]),
    TURNSTILE_TIMEOUT_MS: int(rawEnv.TURNSTILE_TIMEOUT_MS, 7_000, { min: 1_000, max: 30_000 }),

    GOOGLE_CLIENT_ID: str(rawEnv.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: str(rawEnv.GOOGLE_CLIENT_SECRET),
    YOUTUBE_API_KEY: str(rawEnv.YOUTUBE_API_KEY),
    GEMINI_API_KEY: str(rawEnv.GEMINI_API_KEY),
    FIREBASE_API_KEY: str(rawEnv.FIREBASE_API_KEY),
    FIREBASE_PROJECT_ID: str(rawEnv.FIREBASE_PROJECT_ID),
    FIREBASE_AUTH_DOMAIN: str(rawEnv.FIREBASE_AUTH_DOMAIN),
    FIREBASE_STORAGE_BUCKET: str(rawEnv.FIREBASE_STORAGE_BUCKET),
    FIREBASE_SERVICE_ACCOUNT_BASE64: str(rawEnv.FIREBASE_SERVICE_ACCOUNT_BASE64),
    FIREBASE_APP_CHECK_REQUIRED: bool(rawEnv.FIREBASE_APP_CHECK_REQUIRED, false),

    CLOUDINARY_URL: str(rawEnv.CLOUDINARY_URL),
    CLOUDINARY_AUDIO_URL: str(rawEnv.CLOUDINARY_AUDIO_URL),
    CLOUDINARY_UPLOAD_FOLDER: str(rawEnv.CLOUDINARY_UPLOAD_FOLDER, "ytconv/uploads"),
    CLOUDINARY_AUDIO_FOLDER: str(rawEnv.CLOUDINARY_AUDIO_FOLDER, "ytconv/audio"),
    CLOUDINARY_IMAGE_FOLDER: str(rawEnv.CLOUDINARY_IMAGE_FOLDER, "ytconv/images"),
    CLOUDINARY_TEMP_FOLDER: str(rawEnv.CLOUDINARY_TEMP_FOLDER, "ytconv/tmp"),
    CLOUDINARY_SIGNED_UPLOADS: bool(rawEnv.CLOUDINARY_SIGNED_UPLOADS, true),
    CLOUDINARY_WEBHOOK_SECRET: str(rawEnv.CLOUDINARY_WEBHOOK_SECRET),
    CLOUDINARY_MAX_IMAGE_MB: int(rawEnv.CLOUDINARY_MAX_IMAGE_MB, 8, { min: 1, max: 100 }),
    CLOUDINARY_MAX_AUDIO_MB: int(rawEnv.CLOUDINARY_MAX_AUDIO_MB, 200, { min: 1, max: 1000 }),

    SPOTIFY_CLIENT_ID: str(rawEnv.SPOTIFY_CLIENT_ID),
    SPOTIFY_CLIENT_SECRET: str(rawEnv.SPOTIFY_CLIENT_SECRET),
    GROQ_API_KEY: str(rawEnv.GROQ_API_KEY),
    GROQ_API_KEY_FALLBACK: str(rawEnv.GROQ_API_KEY_FALLBACK),
    GROQ_MODEL: str(rawEnv.GROQ_MODEL, "llama-3.1-8b-instant"),
    OAIBEST_API_KEY: str(rawEnv.OAIBEST_API_KEY),
    AI_TIMEOUT_MS: int(rawEnv.AI_TIMEOUT_MS, 30_000, { min: 1_000, max: 180_000 }),
    AI_MAX_TOKENS: int(rawEnv.AI_MAX_TOKENS, 1024, { min: 64, max: 32_000 }),

    WORKER_SHARED_SECRET: str(rawEnv.WORKER_SHARED_SECRET),
    INTERNAL_API_KEY: str(rawEnv.INTERNAL_API_KEY),
    INTERNAL_REQUEST_TIMEOUT_MS: int(rawEnv.INTERNAL_REQUEST_TIMEOUT_MS, 15_000, { min: 500, max: 120_000 }),

    YTDLP_JS_RUNTIME: str(rawEnv.YTDLP_JS_RUNTIME, "deno"),
    YTDLP_PATH: str(rawEnv.YTDLP_PATH),
    FFMPEG_PATH: str(rawEnv.FFMPEG_PATH),
    FFPROBE_PATH: str(rawEnv.FFPROBE_PATH),
    ENABLE_SERVER_COOKIES: bool(rawEnv.ENABLE_SERVER_COOKIES, true),
    COOKIES_PATH: str(rawEnv.COOKIES_PATH, "/data/cookies.txt"),
    COOKIE_STORE_PATH: str(rawEnv.COOKIE_STORE_PATH, "/data/cookies-meta.json"),
    COOKIES_TEST_URL: str(rawEnv.COOKIES_TEST_URL, "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    YTDLP_YOUTUBE_PLAYER_CLIENTS: str(rawEnv.YTDLP_YOUTUBE_PLAYER_CLIENTS, "mweb,web_safari,tv_embedded,android,default"),
    YTDLP_YOUTUBE_PO_TOKEN: str(rawEnv.YTDLP_YOUTUBE_PO_TOKEN),
    YTDLP_AUTO_UPDATE: bool(rawEnv.YTDLP_AUTO_UPDATE, false),
    OUTPUT_DIR: outputDir,
    TEMP_DIR: tempDir,
    CACHE_DIR: cacheDir,
    OUTPUT_TTL_MINUTES: int(rawEnv.OUTPUT_TTL_MINUTES, 60, { min: 5, max: 24 * 60 }),
    JOB_TTL_SECONDS: int(rawEnv.JOB_TTL_SECONDS, 60 * 60, { min: 60, max: 24 * 60 * 60 }),
    CLEANUP_INTERVAL_MS: int(rawEnv.CLEANUP_INTERVAL_MS, 10 * 60_000, { min: 30_000, max: 24 * 60 * 60_000 }),
    CONVERTER_CONCURRENCY: int(rawEnv.CONVERTER_CONCURRENCY, 1, { min: 1, max: 8 }),
    QUEUE_CONCURRENCY: int(rawEnv.QUEUE_CONCURRENCY, int(rawEnv.CONVERTER_CONCURRENCY, 1), { min: 1, max: 16 }),
    MAX_PARALLEL_DOWNLOADS: int(rawEnv.MAX_PARALLEL_DOWNLOADS, 1, { min: 1, max: 8 }),
    MAX_QUEUE_SIZE: int(rawEnv.MAX_QUEUE_SIZE, 50, { min: 1, max: 10_000 }),
    MAX_DURATION_SECONDS: int(rawEnv.MAX_DURATION_SECONDS, 7200, { min: 30, max: 24 * 60 * 60 }),
    MAX_FILE_MB: int(rawEnv.MAX_FILE_MB, 800, { min: 1, max: 5000 }),
    MAX_PLAYLIST_ITEMS: int(rawEnv.MAX_PLAYLIST_ITEMS, 25, { min: 1, max: 500 }),
    ALLOW_PLAYLIST: bool(rawEnv.ALLOW_PLAYLIST, true),
    DEFAULT_AUDIO_FORMAT: str(rawEnv.DEFAULT_AUDIO_FORMAT, "mp3"),
    DEFAULT_AUDIO_QUALITY: str(rawEnv.DEFAULT_AUDIO_QUALITY, "320"),
    ALLOWED_AUDIO_FORMATS: csv(rawEnv.ALLOWED_AUDIO_FORMATS, ["mp3", "m4a", "aac", "opus", "flac", "wav", "aiff", "alac", "caf", "ogg"]),
    ALLOWED_VIDEO_FORMATS: csv(rawEnv.ALLOWED_VIDEO_FORMATS, ["mp4", "webm", "mkv"]),
    ALLOWED_AUDIO_QUALITIES: csv(rawEnv.ALLOWED_AUDIO_QUALITIES, ["64", "128", "192", "256", "320"]),
    SIGNED_DOWNLOADS: bool(rawEnv.SIGNED_DOWNLOADS, nodeEnv === "production"),
    DOWNLOAD_TOKEN_SECRET: str(rawEnv.DOWNLOAD_TOKEN_SECRET),
    DOWNLOAD_URL_TTL_SECONDS: int(rawEnv.DOWNLOAD_URL_TTL_SECONDS, 60 * 30, { min: 60, max: 24 * 60 * 60 }),

    REDIS_URL: str(rawEnv.REDIS_URL),
    QUEUE_DRIVER: str(rawEnv.QUEUE_DRIVER, rawEnv.REDIS_URL ? "redis" : "memory"),
    QUEUE_PREFIX: str(rawEnv.QUEUE_PREFIX, "ytconv"),
    QUEUE_REMOVE_ON_COMPLETE: bool(rawEnv.QUEUE_REMOVE_ON_COMPLETE, true),
    QUEUE_REMOVE_ON_FAIL: bool(rawEnv.QUEUE_REMOVE_ON_FAIL, false),
    QUEUE_JOB_TIMEOUT_MS: int(rawEnv.QUEUE_JOB_TIMEOUT_MS, 15 * 60_000, { min: 10_000, max: 6 * 60 * 60_000 }),
    FALLBACK_QUEUE_DRIVER: str(rawEnv.FALLBACK_QUEUE_DRIVER, "memory"),

    RATE_LIMIT_ENABLED: bool(rawEnv.RATE_LIMIT_ENABLED, true),
    RATE_LIMIT_WINDOW_MS: int(rawEnv.RATE_LIMIT_WINDOW_MS, 60_000, { min: 1_000, max: 60 * 60_000 }),
    RATE_LIMIT_MAX: int(rawEnv.RATE_LIMIT_MAX, 120, { min: 1, max: 100_000 }),
    CONVERT_RATE_LIMIT_WINDOW_MS: int(rawEnv.CONVERT_RATE_LIMIT_WINDOW_MS, 60_000, { min: 1_000, max: 60 * 60_000 }),
    CONVERT_RATE_LIMIT_MAX: int(rawEnv.CONVERT_RATE_LIMIT_MAX, 10, { min: 1, max: 10_000 }),
    AUTH_RATE_LIMIT_WINDOW_MS: int(rawEnv.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60_000, { min: 1_000, max: 60 * 60_000 }),
    AUTH_RATE_LIMIT_MAX: int(rawEnv.AUTH_RATE_LIMIT_MAX, 10, { min: 1, max: 10_000 }),
    TICKET_RATE_LIMIT_WINDOW_MS: int(rawEnv.TICKET_RATE_LIMIT_WINDOW_MS, 10 * 60_000, { min: 1_000, max: 60 * 60_000 }),
    TICKET_RATE_LIMIT_MAX: int(rawEnv.TICKET_RATE_LIMIT_MAX, 5, { min: 1, max: 10_000 }),
    AI_RATE_LIMIT_WINDOW_MS: int(rawEnv.AI_RATE_LIMIT_WINDOW_MS, 60_000, { min: 1_000, max: 60 * 60_000 }),
    AI_RATE_LIMIT_MAX: int(rawEnv.AI_RATE_LIMIT_MAX, 20, { min: 1, max: 10_000 }),
    UPLOAD_RATE_LIMIT_WINDOW_MS: int(rawEnv.UPLOAD_RATE_LIMIT_WINDOW_MS, 60_000, { min: 1_000, max: 60 * 60_000 }),
    UPLOAD_RATE_LIMIT_MAX: int(rawEnv.UPLOAD_RATE_LIMIT_MAX, 20, { min: 1, max: 10_000 }),

    BLOCK_PRIVATE_IP_URLS: bool(rawEnv.BLOCK_PRIVATE_IP_URLS, true),
    BLOCK_LOCALHOST_URLS: bool(rawEnv.BLOCK_LOCALHOST_URLS, true),
    BLOCK_FILE_PROTOCOL: bool(rawEnv.BLOCK_FILE_PROTOCOL, true),
    URL_FETCH_TIMEOUT_MS: int(rawEnv.URL_FETCH_TIMEOUT_MS, 10_000, { min: 500, max: 120_000 }),
    MAX_URL_LENGTH: int(rawEnv.MAX_URL_LENGTH, 2048, { min: 64, max: 16_384 }),
    IP_BLOCKLIST: csv(rawEnv.IP_BLOCKLIST, []),
    IP_ALLOWLIST: csv(rawEnv.IP_ALLOWLIST, []),
    USER_AGENT_BLOCKLIST: csv(rawEnv.USER_AGENT_BLOCKLIST, []),

    UPLOAD_MAX_MB: int(rawEnv.UPLOAD_MAX_MB, 12, { min: 1, max: 200 }),
    UPLOAD_ALLOWED_MIME_TYPES: csv(rawEnv.UPLOAD_ALLOWED_MIME_TYPES, ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "audio/mpeg", "audio/wav"]),
    UPLOAD_SCAN_ENABLED: bool(rawEnv.UPLOAD_SCAN_ENABLED, false),

    MAINTENANCE_MODE: bool(rawEnv.MAINTENANCE_MODE, false),
    MAINTENANCE_PROGRESS: int(rawEnv.MAINTENANCE_PROGRESS, 0, { min: 0, max: 100 }),
    MAINTENANCE_ETA_MINUTES: int(rawEnv.MAINTENANCE_ETA_MINUTES, 0, { min: 0, max: 10080 }),
    MAINTENANCE_ID: str(rawEnv.MAINTENANCE_ID),
    MAINTENANCE_DETAIL: str(rawEnv.MAINTENANCE_DETAIL),
    MAINTENANCE_TIP: str(rawEnv.MAINTENANCE_TIP),
    MAINTENANCE_STEPS_JSON: str(rawEnv.MAINTENANCE_STEPS_JSON),
    MAINTENANCE_WHATS_NEW_JSON: str(rawEnv.MAINTENANCE_WHATS_NEW_JSON),
    MAINTENANCE_SERVICES_JSON: str(rawEnv.MAINTENANCE_SERVICES_JSON),

    FEATURE_FORUM: bool(rawEnv.FEATURE_FORUM, true),
    FEATURE_TICKETS: bool(rawEnv.FEATURE_TICKETS, true),
    FEATURE_AI_NAVIGATOR: bool(rawEnv.FEATURE_AI_NAVIGATOR, true),
    FEATURE_CLOUDINARY_SAVE: bool(rawEnv.FEATURE_CLOUDINARY_SAVE, true),
    FEATURE_SUBTITLE: bool(rawEnv.FEATURE_SUBTITLE, true),
    FEATURE_PLAYLIST: bool(rawEnv.FEATURE_PLAYLIST, true),
    FEATURE_PRIVATE_ROOM: bool(rawEnv.FEATURE_PRIVATE_ROOM, true),
    FEATURE_PWA: bool(rawEnv.FEATURE_PWA, true),
    FEATURE_VOICE: bool(rawEnv.FEATURE_VOICE, true),
    FEATURE_MINIGAME: bool(rawEnv.FEATURE_MINIGAME, true),
    MODERATION_ENABLED: bool(rawEnv.MODERATION_ENABLED, true),
    CACHE_ENABLED: bool(rawEnv.CACHE_ENABLED, true),
    ANALYTICS_ENABLED: bool(rawEnv.ANALYTICS_ENABLED, false),
    ANALYTICS_PROVIDER: str(rawEnv.ANALYTICS_PROVIDER, "none"),
    ANALYTICS_ENDPOINT: str(rawEnv.ANALYTICS_ENDPOINT),
    METADATA_CACHE_TTL_SECONDS: int(rawEnv.METADATA_CACHE_TTL_SECONDS, 6 * 60 * 60, { min: 60, max: 7 * 24 * 60 * 60 }),
    RESULT_CACHE_TTL_SECONDS: int(rawEnv.RESULT_CACHE_TTL_SECONDS, 60 * 60, { min: 60, max: 24 * 60 * 60 }),
    MAX_LINKS_PER_MESSAGE: int(rawEnv.MAX_LINKS_PER_MESSAGE, 5, { min: 0, max: 100 }),
    SPAM_DUPLICATE_WINDOW_MS: int(rawEnv.SPAM_DUPLICATE_WINDOW_MS, 60_000, { min: 1_000, max: 24 * 60 * 60_000 }),
    SPAM_DUPLICATE_MAX: int(rawEnv.SPAM_DUPLICATE_MAX, 3, { min: 1, max: 100 }),
    BANNED_DOMAINS: csv(rawEnv.BANNED_DOMAINS, []),
    BANNED_KEYWORDS: csv(rawEnv.BANNED_KEYWORDS, []),
    RETENTION_FAILED_JOBS_DAYS: int(rawEnv.RETENTION_FAILED_JOBS_DAYS, 7, { min: 1, max: 365 }),
    RETENTION_COMPLETED_JOBS_DAYS: int(rawEnv.RETENTION_COMPLETED_JOBS_DAYS, 1, { min: 1, max: 365 }),
    RETENTION_TICKETS_DAYS: int(rawEnv.RETENTION_TICKETS_DAYS, 90, { min: 1, max: 3650 }),
    RETENTION_AUDIT_LOGS_DAYS: int(rawEnv.RETENTION_AUDIT_LOGS_DAYS, 180, { min: 1, max: 3650 }),
    RETENTION_ANALYTICS_DAYS: int(rawEnv.RETENTION_ANALYTICS_DAYS, 90, { min: 1, max: 3650 }),
    RETENTION_CACHE_HOURS: int(rawEnv.RETENTION_CACHE_HOURS, 24, { min: 1, max: 24 * 365 }),
    RETENTION_CLOUDINARY_TEMP_HOURS: int(rawEnv.RETENTION_CLOUDINARY_TEMP_HOURS, 24, { min: 1, max: 24 * 365 }),
    XP_MULTIPLIER_PREMIUM: Number(rawEnv.XP_MULTIPLIER_PREMIUM || 1),

    SUPPORT_EMAIL: str(rawEnv.SUPPORT_EMAIL || rawEnv.SUPPORT_CONTACT_EMAIL, "support@example.com"),
    SMTP_HOST: str(rawEnv.SMTP_HOST || rawEnv.NOTIFY_SMTP_HOST),
    SMTP_PORT: int(rawEnv.SMTP_PORT || rawEnv.NOTIFY_SMTP_PORT, 587, { min: 1, max: 65535 }),
    SMTP_USER: str(rawEnv.SMTP_USER || rawEnv.NOTIFY_SMTP_USER),
    SMTP_PASS: str(rawEnv.SMTP_PASS || rawEnv.NOTIFY_SMTP_PASS),
    SMTP_FROM: str(rawEnv.SMTP_FROM || rawEnv.NOTIFY_FROM_EMAIL || rawEnv.NOTIFY_EMAIL_FROM),
    SENTRY_DSN: str(rawEnv.SENTRY_DSN),
    HEALTHCHECK_SECRET: str(rawEnv.HEALTHCHECK_SECRET),
    ENABLE_REQUEST_LOGS: bool(rawEnv.ENABLE_REQUEST_LOGS, nodeEnv !== "test"),
    ENABLE_ERROR_STACKS: bool(rawEnv.ENABLE_ERROR_STACKS, nodeEnv !== "production"),
  };

  const missing = requireInProduction(rawEnv, [
    "SESSION_SECRET",
    "ADMIN_USER_HASH",
    "ADMIN_PASS_HASH",
    "ADMIN_BEARER",
    "ADMIN_JWT_SECRET",
    ...(env.SIGNED_DOWNLOADS ? ["DOWNLOAD_TOKEN_SECRET"] : []),
  ]);

  return { env, missing, warnings: missing.map((key) => `Missing production env: ${key}`) };
};

export const ensureRuntimeDirectories = (env) => {
  const dirs = [env.OUTPUT_DIR, env.TEMP_DIR, env.CACHE_DIR, dirname(env.COOKIES_PATH), dirname(env.COOKIE_STORE_PATH)];
  for (const dir of dirs.filter(Boolean)) {
    mkdirSync(dir, { recursive: true });
  }
  return dirs;
};

export const validateRuntimeEnv = (rawEnv = process.env) => {
  const result = loadEnv(rawEnv);
  if (result.missing.length) {
    const message = `Missing required production env: ${result.missing.join(", ")}`;
    const error = new Error(message);
    error.code = "ENV_VALIDATION_FAILED";
    error.missing = result.missing;
    throw error;
  }
  return result.env;
};

export const publicEnvSummary = (env) => ({
  appName: env.APP_NAME,
  appVersion: env.APP_VERSION,
  publicBaseUrl: env.PUBLIC_BASE_URL,
  nodeEnv: env.NODE_ENV,
  appEnv: env.APP_ENV,
  queueDriver: env.QUEUE_DRIVER,
  signedDownloads: env.SIGNED_DOWNLOADS,
  features: { forum: env.FEATURE_FORUM, tickets: env.FEATURE_TICKETS, aiNavigator: env.FEATURE_AI_NAVIGATOR, pwa: env.FEATURE_PWA },
});

export const safeEnvDiagnostics = (env) => ({
  ...publicEnvSummary(env),
  databaseUrl: env.DATABASE_URL ? redactUrl(env.DATABASE_URL) : null,
  cloudinaryConfigured: Boolean(env.CLOUDINARY_URL),
  firebaseAdminConfigured: Boolean(env.FIREBASE_SERVICE_ACCOUNT_BASE64),
  turnstileConfigured: Boolean(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY),
  cookiesPath: env.COOKIES_PATH,
  outputDir: env.OUTPUT_DIR,
  tempDir: env.TEMP_DIR,
  cacheDir: env.CACHE_DIR,
});
