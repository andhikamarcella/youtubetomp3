#!/usr/bin/env node
import { promises as fsp } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const DATA_DIR = join(ROOT_DIR, "data");
const STORE_PATH = join(DATA_DIR, "users.json");

const readStore = async () => {
  try {
    const raw = await fsp.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err?.code === "ENOENT") {
      throw new Error("users.json belum dibuat. Jalankan aplikasi terlebih dahulu.");
    }
    throw err;
  }
};

const writeStore = async (data) => {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fsp.rename(tmp, STORE_PATH);
};

const calculateLevel = (xp = 0) => {
  const total = Number(xp) || 0;
  return Math.max(1, Math.floor(total / 750) + 1);
};

const computeXpFromBucket = (bucket) => {
  if (!bucket || typeof bucket !== "object") return 0;
  return Object.values(bucket).reduce((sum, entry) => {
    const delta = Number(entry?.delta);
    return Number.isFinite(delta) ? sum + delta : sum;
  }, 0);
};

const buildEvent = ({ id, delta, reason, metadata, createdAt }) => ({
  id,
  delta,
  reason: reason || "legacy-bootstrap",
  metadata: metadata || null,
  createdAt,
});

const migrate = async () => {
  const store = await readStore();
  if (!store.users || typeof store.users !== "object") {
    throw new Error("Struktur users.json tidak valid.");
  }
  if (!store.xpEvents || typeof store.xpEvents !== "object") {
    store.xpEvents = {};
  }
  const now = Date.now();
  const updates = [];
  for (const [userId, user] of Object.entries(store.users)) {
    if (!user || typeof user !== "object") continue;
    if (!store.xpEvents[userId] || typeof store.xpEvents[userId] !== "object") {
      store.xpEvents[userId] = {};
    }
    const bucket = store.xpEvents[userId];
    const existingTotal = computeXpFromBucket(bucket);
    const legacyXp = Number(user.xp) || 0;
    if (Object.keys(bucket).length === 0 && legacyXp !== 0) {
      const eventId = `legacy-${userId}`.slice(0, 120);
      bucket[eventId] = buildEvent({ id: eventId, delta: legacyXp, createdAt: user.updatedAt || now });
      updates.push(`Seeded XP event untuk ${userId} (+${legacyXp})`);
    } else if (Math.abs(existingTotal - legacyXp) > 0.0001) {
      const delta = legacyXp - existingTotal;
      if (delta !== 0) {
        const eventId = `reconcile-${now}-${userId}`.slice(0, 120);
        bucket[eventId] = buildEvent({
          id: eventId,
          delta,
          reason: "reconcile", 
          metadata: { previousXp: legacyXp },
          createdAt: now,
        });
        updates.push(`Menambahkan event koreksi ${delta} untuk ${userId}`);
      }
    }
    const finalTotal = computeXpFromBucket(bucket);
    user.xp = finalTotal;
    user.level = calculateLevel(finalTotal);
  }
  await writeStore(store);
  if (updates.length === 0) {
    console.log("Tidak ada perubahan. Semua pengguna sudah memiliki xp_events.");
  } else {
    console.log("Migrasi selesai. Ringkasan:");
    for (const line of updates) {
      console.log(`- ${line}`);
    }
  }
};

migrate().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
