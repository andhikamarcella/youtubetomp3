import { promises as fsp } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || join(__dirname, "data");
const APPEALS_PATH = process.env.APPEAL_STORE_PATH || join(DATA_DIR, "appeals.json");
const COLLECTION = "forum-appeals";

let fileWriteQueue = Promise.resolve();
let firestoreDb;
let backendLogged = false;

const normalizeAppealId = (value) => String(value || "").trim().toUpperCase().slice(0, 80);
const clone = (value) => (value == null ? value : structuredClone(value));

const parseServiceAccount = () => {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (raw) return JSON.parse(raw);
  const base64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "").trim();
  if (base64) return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  return null;
};

const getAppealFirestore = () => {
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

const logBackend = (name) => {
  if (backendLogged) return;
  backendLogged = true;
  console.log(`[appeal-store] backend: ${name}`);
};

const readFileStore = async () => {
  try {
    const raw = await fsp.readFile(APPEALS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { appeals: {} };
    if (!parsed.appeals || typeof parsed.appeals !== "object") parsed.appeals = {};
    return parsed;
  } catch (err) {
    if (err?.code === "ENOENT") return { appeals: {} };
    throw err;
  }
};

const writeFileStore = async (data) => {
  await fsp.mkdir(dirname(APPEALS_PATH), { recursive: true });
  const tmpPath = `${APPEALS_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await fsp.rename(tmpPath, APPEALS_PATH);
};

const withFileWrite = (operation) => {
  const run = fileWriteQueue.then(operation, operation);
  fileWriteQueue = run.catch(() => {});
  return run;
};

export const getAppealStoreBackend = () => (getAppealFirestore() ? "firestore" : "file");

export const createAppeal = async (appeal) => {
  const appealId = normalizeAppealId(appeal?.appealId);
  if (!appealId) throw new Error("appeal_id_invalid");
  const record = { ...clone(appeal), appealId };
  const db = getAppealFirestore();

  if (db) {
    logBackend("firestore");
    const ref = db.collection(COLLECTION).doc(appealId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) throw new Error("appeal_already_exists");
      transaction.set(ref, record);
    });
    return clone(record);
  }

  logBackend("file");
  return withFileWrite(async () => {
    const data = await readFileStore();
    if (data.appeals[appealId]) throw new Error("appeal_already_exists");
    data.appeals[appealId] = record;
    await writeFileStore(data);
    return clone(record);
  });
};

export const getAppeal = async (appealIdValue) => {
  const appealId = normalizeAppealId(appealIdValue);
  if (!appealId) return null;
  const db = getAppealFirestore();
  if (db) {
    logBackend("firestore");
    const snapshot = await db.collection(COLLECTION).doc(appealId).get();
    return snapshot.exists ? { ...snapshot.data(), appealId } : null;
  }
  logBackend("file");
  await fileWriteQueue;
  const data = await readFileStore();
  return clone(data.appeals[appealId] || null);
};

export const listAppeals = async () => {
  const db = getAppealFirestore();
  if (db) {
    logBackend("firestore");
    const snapshot = await db.collection(COLLECTION).get();
    return snapshot.docs.map((doc) => ({ ...doc.data(), appealId: doc.id }));
  }
  logBackend("file");
  await fileWriteQueue;
  const data = await readFileStore();
  return Object.values(data.appeals).map(clone);
};

export const updateAppeal = async (appealIdValue, updater) => {
  const appealId = normalizeAppealId(appealIdValue);
  if (!appealId) return null;
  if (typeof updater !== "function") throw new TypeError("updater must be a function");
  const db = getAppealFirestore();

  if (db) {
    logBackend("firestore");
    const ref = db.collection(COLLECTION).doc(appealId);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return null;
      const current = { ...snapshot.data(), appealId };
      const updated = await updater(clone(current));
      if (!updated) return null;
      const record = { ...clone(updated), appealId };
      transaction.set(ref, record);
      return clone(record);
    });
  }

  logBackend("file");
  return withFileWrite(async () => {
    const data = await readFileStore();
    const current = data.appeals[appealId];
    if (!current) return null;
    const updated = await updater(clone(current));
    if (!updated) return null;
    const record = { ...clone(updated), appealId };
    data.appeals[appealId] = record;
    await writeFileStore(data);
    return clone(record);
  });
};

export const deleteAppeal = async (appealIdValue) => {
  const appealId = normalizeAppealId(appealIdValue);
  if (!appealId) return false;
  const db = getAppealFirestore();

  if (db) {
    logBackend("firestore");
    const ref = db.collection(COLLECTION).doc(appealId);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return false;
      transaction.delete(ref);
      return true;
    });
  }

  logBackend("file");
  return withFileWrite(async () => {
    const data = await readFileStore();
    if (!data.appeals[appealId]) return false;
    delete data.appeals[appealId];
    await writeFileStore(data);
    return true;
  });
};
