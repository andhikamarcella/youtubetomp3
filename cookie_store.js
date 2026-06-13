import { createHash } from "node:crypto";
import { promises as fsp } from "node:fs";
import { dirname, join } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PERSISTENT_BASE_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd();
const DEFAULT_COOKIES_PATH = join(PERSISTENT_BASE_DIR, "cookies.txt");
const COOKIES_PATH = process.env.COOKIES_PATH || process.env.COOKIE_FILE_PATH || DEFAULT_COOKIES_PATH;
const STORE_PATH = process.env.COOKIE_STORE_PATH || join(PERSISTENT_BASE_DIR, "data", "cookies-store.json");
const COLLECTION = "app-secrets";
const DOCUMENT = "youtube-cookies";
const MAX_COOKIE_BYTES = 900 * 1024;
const SYNC_INTERVAL_MS = Math.max(5_000, Number(process.env.COOKIES_SYNC_INTERVAL_MS || 15_000));

let firestoreDb;
let fileQueue = Promise.resolve();
let syncTimer;
let lastLocalHash = "";
let backendLogged = false;

const hashContent = (content) => createHash("sha256").update(content, "utf8").digest("hex");

const parseServiceAccount = () => {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (raw) return JSON.parse(raw);
  const base64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "").trim();
  if (base64) return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  return null;
};

const getDb = () => {
  if (firestoreDb !== undefined) return firestoreDb;
  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    firestoreDb = null;
    return firestoreDb;
  }
  const app = getApps()[0] || initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
  });
  firestoreDb = getFirestore(app);
  return firestoreDb;
};

const backendName = () => (getDb() ? "firestore" : "file");

const logBackend = () => {
  if (backendLogged) return;
  backendLogged = true;
  console.log(`[cookie-store] backend: ${backendName()}`);
};

const normalizeContent = (value) => {
  if (typeof value !== "string") throw new Error("cookies_invalid_body");
  const content = value.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!content.trim()) throw new Error("cookies_empty");
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > MAX_COOKIE_BYTES) throw new Error("cookies_too_large");
  return { content, bytes, hash: hashContent(content) };
};

const readFileRecord = async () => {
  try {
    const raw = await fsp.readFile(STORE_PATH, "utf8");
    const record = JSON.parse(raw);
    return record && typeof record.content === "string" ? record : null;
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
};

const writeFileRecord = (record) => {
  const operation = async () => {
    await fsp.mkdir(dirname(STORE_PATH), { recursive: true });
    const temporaryPath = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(temporaryPath, JSON.stringify(record), { encoding: "utf8", mode: 0o600 });
    await fsp.rename(temporaryPath, STORE_PATH);
    return record;
  };
  const run = fileQueue.then(operation, operation);
  fileQueue = run.catch(() => {});
  return run;
};

const writeLocalCookies = async (record, { force = false } = {}) => {
  if (!record?.content) return false;
  if (!force && lastLocalHash === record.hash) {
    try {
      await fsp.access(COOKIES_PATH);
      return false;
    } catch {
      // The runtime copy was removed; rebuild it from the persistent record.
    }
  }
  await fsp.mkdir(dirname(COOKIES_PATH), { recursive: true });
  const temporaryPath = `${COOKIES_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(temporaryPath, record.content, { encoding: "utf8", mode: 0o600 });
  await fsp.rename(temporaryPath, COOKIES_PATH);
  lastLocalHash = record.hash;
  return true;
};

export const getCookiesPath = () => COOKIES_PATH;
export const getCookieStoreBackend = () => backendName();

export const saveCookies = async (value) => {
  logBackend();
  const normalized = normalizeContent(value);
  const record = {
    ...normalized,
    uploadedAt: new Date().toISOString(),
    version: Date.now(),
  };
  const db = getDb();
  if (db) {
    await db.collection(COLLECTION).doc(DOCUMENT).set(record);
  } else {
    await writeFileRecord(record);
  }
  await writeLocalCookies(record, { force: true });
  return { bytes: record.bytes, hash: record.hash, uploadedAt: record.uploadedAt, version: record.version };
};

export const readCookies = async () => {
  logBackend();
  const db = getDb();
  if (db) {
    const snapshot = await db.collection(COLLECTION).doc(DOCUMENT).get();
    if (!snapshot.exists) return null;
    const record = snapshot.data();
    return record && typeof record.content === "string" ? record : null;
  }
  await fileQueue;
  return readFileRecord();
};

export const syncCookiesToLocal = async ({ force = false } = {}) => {
  const record = await readCookies();
  if (!record) return null;
  await writeLocalCookies(record, { force });
  return {
    exists: true,
    path: COOKIES_PATH,
    bytes: Number(record.bytes || Buffer.byteLength(record.content, "utf8")),
    hash: record.hash || hashContent(record.content),
    uploadedAt: record.uploadedAt || null,
    version: record.version || null,
    backend: backendName(),
  };
};

export const initializeCookiesStore = async () => {
  const persisted = await readCookies();
  if (persisted) {
    await writeLocalCookies(persisted, { force: true });
    return getCookiesStatus();
  }

  try {
    const legacyContent = await fsp.readFile(COOKIES_PATH, "utf8");
    if (!legacyContent.trim()) return null;
    await saveCookies(legacyContent);
    console.log(`[cookie-store] migrated legacy cookies from ${COOKIES_PATH}`);
    return getCookiesStatus();
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
};

export const getCookiesStatus = async () => {
  const record = await readCookies();
  if (!record) return { exists: false, backend: backendName(), path: COOKIES_PATH };
  await writeLocalCookies(record);
  return {
    exists: true,
    path: COOKIES_PATH,
    bytes: Number(record.bytes || Buffer.byteLength(record.content, "utf8")),
    hash: record.hash || hashContent(record.content),
    uploadedAt: record.uploadedAt || null,
    version: record.version || null,
    backend: backendName(),
  };
};

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
