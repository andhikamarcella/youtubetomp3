import { promises as fsp } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || join(__dirname, "data");
const TICKETS_PATH = process.env.TICKET_STORE_PATH || join(DATA_DIR, "tickets.json");
const COLLECTION = "support-tickets";

let fileWriteQueue = Promise.resolve();
let firestoreDb;
let backendLogged = false;

const normalizeTicketId = (value) => String(value || "").trim().toUpperCase().slice(0, 80);

const clone = (value) => {
  if (value == null) return value;
  return structuredClone(value);
};

const parseServiceAccount = () => {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();
  if (raw) return JSON.parse(raw);

  const base64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "").trim();
  if (base64) return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));

  return null;
};

const getTicketFirestore = () => {
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
  console.log(`[ticket-store] backend: ${name}`);
};

const readFileStore = async () => {
  try {
    const raw = await fsp.readFile(TICKETS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { tickets: {} };
    if (!parsed.tickets || typeof parsed.tickets !== "object") parsed.tickets = {};
    return parsed;
  } catch (err) {
    if (err?.code === "ENOENT") return { tickets: {} };
    throw err;
  }
};

const writeFileStore = async (data) => {
  await fsp.mkdir(dirname(TICKETS_PATH), { recursive: true });
  const tmpPath = `${TICKETS_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await fsp.rename(tmpPath, TICKETS_PATH);
};

const withFileWrite = (operation) => {
  const run = fileWriteQueue.then(operation, operation);
  fileWriteQueue = run.catch(() => {});
  return run;
};

export const getTicketStoreBackend = () => (getTicketFirestore() ? "firestore" : "file");

export const createTicket = async (ticket) => {
  const ticketId = normalizeTicketId(ticket?.ticketId);
  if (!ticketId) throw new Error("ticket_id_invalid");
  const record = { ...clone(ticket), ticketId };
  const db = getTicketFirestore();

  if (db) {
    logBackend("firestore");
    const ref = db.collection(COLLECTION).doc(ticketId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) throw new Error("ticket_already_exists");
      transaction.set(ref, record);
    });
    return clone(record);
  }

  logBackend("file");
  return withFileWrite(async () => {
    const data = await readFileStore();
    if (data.tickets[ticketId]) throw new Error("ticket_already_exists");
    data.tickets[ticketId] = record;
    await writeFileStore(data);
    return clone(record);
  });
};

export const getTicket = async (ticketIdValue) => {
  const ticketId = normalizeTicketId(ticketIdValue);
  if (!ticketId) return null;
  const db = getTicketFirestore();

  if (db) {
    logBackend("firestore");
    const snapshot = await db.collection(COLLECTION).doc(ticketId).get();
    return snapshot.exists ? { ...snapshot.data(), ticketId } : null;
  }

  logBackend("file");
  await fileWriteQueue;
  const data = await readFileStore();
  return clone(data.tickets[ticketId] || null);
};

export const listTickets = async () => {
  const db = getTicketFirestore();
  if (db) {
    logBackend("firestore");
    const snapshot = await db.collection(COLLECTION).get();
    return snapshot.docs.map((doc) => ({ ...doc.data(), ticketId: doc.id }));
  }

  logBackend("file");
  await fileWriteQueue;
  const data = await readFileStore();
  return Object.values(data.tickets).map(clone);
};

export const updateTicket = async (ticketIdValue, updater) => {
  const ticketId = normalizeTicketId(ticketIdValue);
  if (!ticketId) return null;
  if (typeof updater !== "function") throw new TypeError("updater must be a function");
  const db = getTicketFirestore();

  if (db) {
    logBackend("firestore");
    const ref = db.collection(COLLECTION).doc(ticketId);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return null;
      const current = { ...snapshot.data(), ticketId };
      const updated = await updater(clone(current));
      if (!updated) return null;
      const record = { ...clone(updated), ticketId };
      transaction.set(ref, record);
      return clone(record);
    });
  }

  logBackend("file");
  return withFileWrite(async () => {
    const data = await readFileStore();
    const current = data.tickets[ticketId];
    if (!current) return null;
    const updated = await updater(clone(current));
    if (!updated) return null;
    const record = { ...clone(updated), ticketId };
    data.tickets[ticketId] = record;
    await writeFileStore(data);
    return clone(record);
  });
};

export const deleteTicket = async (ticketIdValue) => {
  const ticketId = normalizeTicketId(ticketIdValue);
  if (!ticketId) return false;
  const db = getTicketFirestore();

  if (db) {
    logBackend("firestore");
    const ref = db.collection(COLLECTION).doc(ticketId);
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
    if (!data.tickets[ticketId]) return false;
    delete data.tickets[ticketId];
    await writeFileStore(data);
    return true;
  });
};
