import { promises as fsp } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const SUPPORTS_PATH = join(DATA_DIR, "supports.json");

const defaultStore = () => ({
  events: {},
});

const readStore = async () => {
  try {
    const raw = await fsp.readFile(SUPPORTS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultStore();
    if (!parsed.events || typeof parsed.events !== "object") parsed.events = {};
    return parsed;
  } catch (err) {
    if (err?.code === "ENOENT") return defaultStore();
    throw err;
  }
};

const writeStore = async (data) => {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const tmpPath = `${SUPPORTS_PATH}.tmp`;
  await fsp.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await fsp.rename(tmpPath, SUPPORTS_PATH);
};

const clampLimit = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(50, Math.trunc(n)));
};

const normalizeName = (value) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed.slice(0, 60) : "Anonim";
};

const normalizeEmail = (value) => {
  const trimmed = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!trimmed) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "";
  return trimmed.slice(0, 120);
};

const parseIsoDateMs = (value) => {
  if (!value || typeof value !== "string") return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
};

const monthKeyUtc = (ms) => {
  const d = new Date(ms || 0);
  if (!Number.isFinite(d.getTime())) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
};

const makeDonorKey = (name, email) => {
  const normEmail = normalizeEmail(email);
  if (normEmail) return `email:${normEmail}`;
  const normName = normalizeName(name).toLowerCase();
  return `name:${normName}`;
};

export const recordSaweriaSupportEvent = async (payload, requestMeta = {}) => {
  const id = typeof payload?.id === "string" ? payload.id.trim() : "";
  if (!id) {
    throw new Error("Payload Saweria tidak punya id");
  }
  const amountRaw = Number(payload?.amount_raw);
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    throw new Error("amount_raw tidak valid");
  }

  const createdMs = parseIsoDateMs(payload?.created_at) || Date.now();
  const name = normalizeName(payload?.donator_name);
  const email = normalizeEmail(payload?.donator_email);
  const message = typeof payload?.message === "string" ? payload.message.trim().slice(0, 600) : "";

  const data = await readStore();
  if (data.events[id]) {
    return { applied: false, event: data.events[id] };
  }

  const event = {
    id,
    version: typeof payload?.version === "string" ? payload.version : null,
    type: typeof payload?.type === "string" ? payload.type : "donation",
    createdAt: createdMs,
    amountRaw: Math.trunc(amountRaw),
    cut: Number.isFinite(Number(payload?.cut)) ? Math.trunc(Number(payload.cut)) : null,
    donatorName: name,
    donatorEmail: email || null,
    message: message || null,
    request: {
      ip: typeof requestMeta?.ip === "string" ? requestMeta.ip : null,
      userAgent: typeof requestMeta?.userAgent === "string" ? requestMeta.userAgent.slice(0, 200) : null,
      receivedAt: Date.now(),
    },
  };

  data.events[id] = event;
  await writeStore(data);
  return { applied: true, event };
};

export const listSupportLeaderboard = async ({ period = "month", limit = 10 } = {}) => {
  const safeLimit = clampLimit(limit, 10);
  const data = await readStore();
  const events = Object.values(data.events || {});
  const nowMs = Date.now();
  const wantedMonth = monthKeyUtc(nowMs);

  const sums = new Map();
  for (const event of events) {
    const ms = Number(event?.createdAt) || 0;
    if (period === "month") {
      if (!ms || monthKeyUtc(ms) !== wantedMonth) continue;
    }
    const donorKey = makeDonorKey(event?.donatorName, event?.donatorEmail);
    const prev = sums.get(donorKey) || {
      donorKey,
      name: normalizeName(event?.donatorName),
      email: normalizeEmail(event?.donatorEmail) || null,
      totalAmount: 0,
      lastAt: 0,
    };
    prev.totalAmount += Number(event?.amountRaw) || 0;
    prev.lastAt = Math.max(prev.lastAt, ms);
    sums.set(donorKey, prev);
  }

  return Array.from(sums.values())
    .sort((a, b) => (b.totalAmount - a.totalAmount) || (b.lastAt - a.lastAt))
    .slice(0, safeLimit)
    .map((row, idx) => ({ rank: idx + 1, ...row }));
};

export const listRecentSupports = async ({ limit = 10 } = {}) => {
  const safeLimit = clampLimit(limit, 10);
  const data = await readStore();
  const events = Object.values(data.events || {});
  return events
    .sort((a, b) => (Number(b?.createdAt) || 0) - (Number(a?.createdAt) || 0))
    .slice(0, safeLimit)
    .map((event) => ({
      id: event?.id || "",
      createdAt: Number(event?.createdAt) || 0,
      amountRaw: Number(event?.amountRaw) || 0,
      donatorName: normalizeName(event?.donatorName),
      donatorEmail: normalizeEmail(event?.donatorEmail) || null,
      message: typeof event?.message === "string" ? event.message : null,
    }));
};

