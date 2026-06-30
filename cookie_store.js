import { createHash } from "node:crypto";
import { promises as fsp } from "node:fs";
import { dirname, join } from "node:path";

const hasExplicitCookiesPath = Boolean(process.env.COOKIES_PATH || process.env.COOKIE_FILE_PATH);
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";
const FALLBACK_DIR = join(process.cwd(), "data");
const BASE_DIR = hasExplicitCookiesPath ? dirname(process.env.COOKIES_PATH || process.env.COOKIE_FILE_PATH) : DATA_DIR;
const DEFAULT_COOKIES_PATH = hasExplicitCookiesPath
  ? (process.env.COOKIES_PATH || process.env.COOKIE_FILE_PATH)
  : join(DATA_DIR, "cookies.txt");
const COOKIES_PATH = DEFAULT_COOKIES_PATH;
const META_PATH = process.env.COOKIE_STORE_PATH || join(BASE_DIR || FALLBACK_DIR, "cookies-meta.json");
const MAX_COOKIE_BYTES = Math.max(16 * 1024, Number(process.env.MAX_COOKIES_BYTES || 900 * 1024));
const SYNC_INTERVAL_MS = Math.max(5_000, Number(process.env.COOKIES_SYNC_INTERVAL_MS || 15_000));

let syncTimer;
let fileQueue = Promise.resolve();
let lastHealth = { health: "unknown", lastTestAt: null, lastErrorCategory: null };

const hashContent = (content) => createHash("sha256").update(content, "utf8").digest("hex");
const storageName = () => (String(COOKIES_PATH).startsWith("/data/") ? "volume" : "volume");

const queueFile = (operation) => {
  const run = fileQueue.then(operation, operation);
  fileQueue = run.catch(() => {});
  return run;
};

const readMeta = async () => {
  try {
    return JSON.parse(await fsp.readFile(META_PATH, "utf8"));
  } catch (err) {
    if (err?.code === "ENOENT") return {};
    return {};
  }
};

const writeMeta = async (patch = {}) => {
  const current = await readMeta();
  const next = { ...current, ...patch, storage: storageName(), path: COOKIES_PATH };
  await fsp.mkdir(dirname(META_PATH), { recursive: true });
  await fsp.writeFile(META_PATH, JSON.stringify(next, null, 2), { mode: 0o600 });
  lastHealth = {
    health: next.health || lastHealth.health || "unknown",
    lastTestAt: next.lastTestAt || lastHealth.lastTestAt || null,
    lastErrorCategory: next.lastErrorCategory || lastHealth.lastErrorCategory || null,
  };
  return next;
};

export const validateCookiesText = (value, { filename = "cookies.txt" } = {}) => {
  if (typeof value !== "string") throw new Error("cookies_invalid_body");
  if (!/\.txt$/i.test(String(filename || "cookies.txt"))) throw new Error("cookies_invalid_file_type");
  const content = value.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const bytes = Buffer.byteLength(content, "utf8");
  if (!content.trim()) throw new Error("cookies_empty");
  if (bytes > MAX_COOKIE_BYTES) throw new Error("cookies_too_large");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(content)) throw new Error("cookies_suspicious_content");

  const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
  const hasHeader = lines.some((line) => /^#\s*Netscape HTTP Cookie File/i.test(line));
  const cookieRows = lines.filter((line) => !line.startsWith("#"));
  const validRows = cookieRows.filter((line) => {
    const parts = line.split("\t");
    return parts.length >= 7 && parts[0] && /^(TRUE|FALSE)$/i.test(parts[1]) && /^(TRUE|FALSE)$/i.test(parts[3]) && parts[5] && parts.slice(6).join("\t");
  });
  if (!hasHeader || validRows.length < 1) throw new Error("cookies_invalid_netscape_format");
  if (!validRows.some((line) => /(^|\.)youtube\.com\t|(^|\.)google\.com\t|(^|\.)youtu\.be\t/i.test(line))) {
    throw new Error("cookies_missing_youtube_domain");
  }
  return { content, bytes, hash: hashContent(content), cookieCount: validRows.length };
};

export const getCookiesPath = () => COOKIES_PATH;
export const getCookieStoreBackend = () => storageName();

export const saveCookies = async (value, options = {}) => queueFile(async () => {
  const normalized = validateCookiesText(value, options);
  await fsp.mkdir(dirname(COOKIES_PATH), { recursive: true });
  const tmp = `${COOKIES_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, normalized.content, { encoding: "utf8", mode: 0o600 });
  await fsp.rename(tmp, COOKIES_PATH);
  const uploadedAt = new Date().toISOString();
  await writeMeta({
    exists: true,
    sizeBytes: normalized.bytes,
    bytes: normalized.bytes,
    hash: normalized.hash,
    cookieCount: normalized.cookieCount,
    updatedAt: uploadedAt,
    uploadedAt,
    version: Date.now(),
    health: "unknown",
    lastErrorCategory: null,
  });
  return { bytes: normalized.bytes, sizeBytes: normalized.bytes, uploadedAt, updatedAt: uploadedAt, version: Date.now(), health: "unknown", storage: storageName() };
});

export const readCookies = async () => {
  await fileQueue;
  try {
    const content = await fsp.readFile(COOKIES_PATH, "utf8");
    const stat = await fsp.stat(COOKIES_PATH);
    const meta = await readMeta();
    return {
      content,
      bytes: stat.size,
      sizeBytes: stat.size,
      hash: hashContent(content),
      uploadedAt: meta.uploadedAt || stat.mtime.toISOString(),
      updatedAt: meta.updatedAt || stat.mtime.toISOString(),
      version: meta.version || stat.mtimeMs,
      health: meta.health || lastHealth.health || "unknown",
      lastTestAt: meta.lastTestAt || lastHealth.lastTestAt || null,
      lastErrorCategory: meta.lastErrorCategory || lastHealth.lastErrorCategory || null,
    };
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
};

export const syncCookiesToLocal = async () => {
  const record = await readCookies();
  if (!record) return null;
  return {
    exists: true,
    path: COOKIES_PATH,
    bytes: record.bytes,
    sizeBytes: record.bytes,
    uploadedAt: record.uploadedAt,
    updatedAt: record.updatedAt,
    version: record.version,
    backend: storageName(),
    storage: storageName(),
    health: record.health || "unknown",
    lastTestAt: record.lastTestAt || null,
    lastErrorCategory: record.lastErrorCategory || null,
  };
};

export const initializeCookiesStore = async () => syncCookiesToLocal();

export const getCookiesStatus = async () => {
  const record = await readCookies();
  if (!record) {
    const meta = await readMeta();
    return {
      exists: false,
      sizeBytes: 0,
      updatedAt: null,
      storage: storageName(),
      backend: storageName(),
      health: "missing",
      lastTestAt: meta.lastTestAt || null,
      lastErrorCategory: meta.lastErrorCategory || null,
    };
  }
  return {
    exists: true,
    sizeBytes: record.bytes,
    bytes: record.bytes,
    updatedAt: record.updatedAt,
    uploadedAt: record.uploadedAt,
    storage: storageName(),
    backend: storageName(),
    health: record.health || "unknown",
    lastTestAt: record.lastTestAt || null,
    lastErrorCategory: record.lastErrorCategory || null,
  };
};

export const updateCookiesHealth = async ({ health = "unknown", lastErrorCategory = null } = {}) => {
  const meta = await writeMeta({ health, lastErrorCategory, lastTestAt: new Date().toISOString() });
  return {
    health: meta.health || health,
    lastErrorCategory: meta.lastErrorCategory || lastErrorCategory,
    lastTestAt: meta.lastTestAt,
  };
};

export const deleteCookies = async () => queueFile(async () => {
  await fsp.rm(COOKIES_PATH, { force: true });
  await writeMeta({ exists: false, sizeBytes: 0, bytes: 0, health: "missing", updatedAt: null, lastErrorCategory: null });
  return { ok: true };
});

export const startCookiesSync = ({ onError } = {}) => {
  if (syncTimer) return syncTimer;
  syncTimer = setInterval(() => {
    syncCookiesToLocal().catch((err) => {
      if (typeof onError === "function") onError(err);
    });
  }, SYNC_INTERVAL_MS);
  syncTimer.unref?.();
  return syncTimer;
};

export const stopCookiesSync = () => {
  if (!syncTimer) return;
  clearInterval(syncTimer);
  syncTimer = undefined;
};
