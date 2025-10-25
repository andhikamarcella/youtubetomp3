import { promises as fsp } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { nanoid } from "nanoid";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const USERS_PATH = join(DATA_DIR, "users.json");
const CHEAT_AUDIT_PATH = join(DATA_DIR, "cheat_audit.log");
const MAX_HISTORY_ENTRIES = 100;

const defaultStore = () => ({
  users: {},
  referralIndex: {},
  xpEvents: {},
  cheatClaims: {},
});

const XP_EVENT_LIMIT = 1000;

const CHEAT_CODES = {
  "andhikagantengbangetomagadgantengbangetmuachmuach": {
    xp: 30000,
    reason: "cheat-secret",
    badge: "andhika",
    metadata: { label: "andhika-secret" },
  },
};

const sanitizeEventId = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
};

const ensureXpBucket = (data, userId) => {
  if (!data.xpEvents || typeof data.xpEvents !== "object") {
    data.xpEvents = {};
  }
  if (!data.xpEvents[userId]) {
    data.xpEvents[userId] = {};
  }
  return data.xpEvents[userId];
};

const ensureCheatBucket = (data, userId) => {
  if (!data.cheatClaims || typeof data.cheatClaims !== "object") {
    data.cheatClaims = {};
  }
  if (!data.cheatClaims[userId]) {
    data.cheatClaims[userId] = {};
  }
  return data.cheatClaims[userId];
};

const computeXpFromBucket = (bucket) => {
  if (!bucket || typeof bucket !== "object") return 0;
  return Object.values(bucket).reduce((total, entry) => {
    const delta = Number(entry?.delta);
    if (Number.isFinite(delta)) return total + delta;
    return total;
  }, 0);
};

const readStore = async () => {
  try {
    const raw = await fsp.readFile(USERS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultStore();
    if (!parsed.users || typeof parsed.users !== "object") parsed.users = {};
    if (!parsed.referralIndex || typeof parsed.referralIndex !== "object") parsed.referralIndex = {};
    if (!parsed.xpEvents || typeof parsed.xpEvents !== "object") parsed.xpEvents = {};
    if (!parsed.cheatClaims || typeof parsed.cheatClaims !== "object") parsed.cheatClaims = {};
    return parsed;
  } catch (err) {
    if (err?.code === "ENOENT") return defaultStore();
    throw err;
  }
};

const writeStore = async (data) => {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const tmpPath = `${USERS_PATH}.tmp`;
  await fsp.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await fsp.rename(tmpPath, USERS_PATH);
};

const appendCheatAudit = async (entry) => {
  if (!entry || typeof entry !== "object") return;
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    const line = JSON.stringify({ ...entry, at: new Date().toISOString() });
    await fsp.appendFile(CHEAT_AUDIT_PATH, `${line}\n`, "utf8");
  } catch (err) {
    console.warn("gagal menulis cheat audit", err);
  }
};

const calculateLevel = (xp = 0) => {
  const total = Number(xp) || 0;
  return Math.max(1, Math.floor(total / 750) + 1);
};

const reconcileUserRecord = (data, userId, { touchUpdatedAt = false } = {}) => {
  const user = data.users?.[userId];
  if (!user) return { user: null, changed: false, xp: 0, level: 1 };
  const bucket = ensureXpBucket(data, userId);
  const xpTotal = computeXpFromBucket(bucket);
  const level = calculateLevel(xpTotal);
  let changed = false;
  if (!Number.isFinite(user.xp) || user.xp !== xpTotal) {
    user.xp = xpTotal;
    changed = true;
  }
  if (!Number.isFinite(user.level) || user.level !== level) {
    user.level = level;
    changed = true;
  }
  if (changed && touchUpdatedAt) {
    user.updatedAt = Date.now();
  }
  return { user, changed, xp: xpTotal, level, bucket };
};

const applyXpEvent = (data, user, { eventId, delta, reason, metadata }) => {
  if (!user?.id) {
    return { applied: false, xp: Number(user?.xp) || 0 };
  }
  const normalizedId = sanitizeEventId(eventId || "");
  if (!normalizedId) {
    return { applied: false, xp: Number(user.xp) || 0 };
  }
  const xpBucket = ensureXpBucket(data, user.id);
  if (xpBucket[normalizedId]) {
    const xpTotal = computeXpFromBucket(xpBucket);
    user.xp = xpTotal;
    user.level = calculateLevel(xpTotal);
    return { applied: false, xp: xpTotal, event: xpBucket[normalizedId] };
  }
  const createdAt = Date.now();
  const deltaValue = Number(delta) || 0;
  xpBucket[normalizedId] = {
    id: normalizedId,
    delta: deltaValue,
    reason: reason || null,
    metadata: metadata || null,
    createdAt,
  };
  const keys = Object.keys(xpBucket);
  if (keys.length > XP_EVENT_LIMIT) {
    const sorted = keys
      .map((key) => ({ key, createdAt: xpBucket[key]?.createdAt || 0 }))
      .sort((a, b) => a.createdAt - b.createdAt);
    const overflow = sorted.length - XP_EVENT_LIMIT;
    for (let i = 0; i < overflow; i += 1) {
      const key = sorted[i]?.key;
      if (key && key !== normalizedId) {
        delete xpBucket[key];
      }
    }
  }
  const xpTotal = computeXpFromBucket(xpBucket);
  user.xp = xpTotal;
  user.level = calculateLevel(xpTotal);
  return {
    applied: true,
    xp: xpTotal,
    event: xpBucket[normalizedId],
  };
};

const buildUserSummary = (user) => {
  if (!user) return null;
  const level = calculateLevel(user.xp || 0);
  const levelFloor = (level - 1) * 750;
  const levelProgress = user.xp - levelFloor;
  const nextLevelXp = level * 750;
  const levelRemaining = Math.max(0, nextLevelXp - user.xp);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    xp: user.xp,
    level,
    levelProgress,
    nextLevelXp,
    levelRemaining,
    totalConversions: user.totalConversions || 0,
    totalMinutes: user.totalMinutes || 0,
    plan: user.plan || "free",
    referralCode: user.referralCode || null,
    badges: Array.isArray(user.badges) ? user.badges : [],
    referralCount: user.referralCount || 0,
  };
};

const ensureReferralCode = (data, user) => {
  if (user.referralCode) return user.referralCode;
  let code;
  do {
    code = randomBytes(4).toString("hex").toUpperCase();
  } while (data.referralIndex[code]);
  user.referralCode = code;
  data.referralIndex[code] = user.id;
  return code;
};

export const getUserById = async (id) => {
  if (!id) return null;
  const data = await readStore();
  const { user, changed } = reconcileUserRecord(data, id, { touchUpdatedAt: false });
  if (changed) {
    await writeStore(data);
  }
  return user || null;
};

export const reconcileUserXp = async (userId) => {
  if (!userId) return null;
  const data = await readStore();
  const { user, bucket, changed, xp, level } = reconcileUserRecord(data, userId, {
    touchUpdatedAt: true,
  });
  if (!user) return null;
  if (changed) {
    await writeStore(data);
  }
  return { xp, level, events: Object.values(bucket) };
};

export const getUserByGoogleId = async (googleId) => {
  if (!googleId) return null;
  const data = await readStore();
  return Object.values(data.users).find((u) => u.googleId === googleId) || null;
};

export const getUserByReferralCode = async (code) => {
  if (!code) return null;
  const normalized = String(code || "").trim().toUpperCase();
  const data = await readStore();
  const userId = data.referralIndex[normalized];
  if (!userId) return null;
  return data.users[userId] || null;
};

export const upsertGoogleUser = async ({
  googleId,
  email,
  name,
  avatarUrl,
  referralCode,
}) => {
  if (!googleId) throw new Error("googleId wajib diisi");
  const now = Date.now();
  const data = await readStore();
  let user = Object.values(data.users).find((u) => u.googleId === googleId);
  if (!user) {
    const id = googleId;
    user = {
      id,
      googleId,
      email: email || null,
      name: name || null,
      avatarUrl: avatarUrl || null,
      createdAt: now,
      updatedAt: now,
      xp: 0,
      level: 1,
      badges: [],
      totalConversions: 0,
      totalMinutes: 0,
      plan: "free",
      history: [],
      referralCount: 0,
      referrals: [],
    };
    data.users[id] = user;
    ensureXpBucket(data, id);
    ensureReferralCode(data, user);
    if (referralCode) {
      const normalizedRef = String(referralCode).trim().toUpperCase();
      const referrerId = data.referralIndex[normalizedRef];
      if (referrerId && referrerId !== user.id) {
        const referrer = data.users[referrerId];
        if (referrer) {
          ensureXpBucket(data, referrerId);
          const referralEventId = sanitizeEventId(`referral:${user.id}`);
          const referralEvent = applyXpEvent(data, referrer, {
            eventId: referralEventId,
            delta: 250,
            reason: "referral-bonus",
            metadata: { invitee: user.id },
          });
          const alreadyListed = Array.isArray(referrer.referrals)
            ? referrer.referrals.includes(user.id)
            : false;
          if (!Array.isArray(referrer.referrals)) {
            referrer.referrals = alreadyListed ? referrer.referrals : [];
          }
          if (!alreadyListed) {
            referrer.referrals = Array.isArray(referrer.referrals)
              ? [...new Set([...referrer.referrals, user.id])]
              : [user.id];
          }
          if (referralEvent.applied) {
            referrer.referralCount = (referrer.referralCount || 0) + 1;
            if (!Array.isArray(referrer.badges)) referrer.badges = [];
            if (!referrer.badges.includes("referral-trailblazer")) {
              referrer.badges.push("referral-trailblazer");
            }
          }
        }
      }
    }
  } else {
    user.email = email || user.email || null;
    user.name = name || user.name || null;
    user.avatarUrl = avatarUrl || user.avatarUrl || null;
    user.updatedAt = now;
    ensureReferralCode(data, user);
    ensureXpBucket(data, user.id);
  }
  await writeStore(data);
  return buildUserSummary(user);
};

const deriveBadges = (user, context = {}) => {
  const awarded = new Set(Array.isArray(user.badges) ? user.badges : []);
  const results = [];
  const push = (badge, description) => {
    if (!awarded.has(badge)) {
      awarded.add(badge);
      results.push({ id: badge, description });
    }
  };
  if ((user.totalConversions || 0) >= 1) {
    push("audiophile-beginner", "Konversi pertama sukses");
  }
  if ((context.batchSize || 0) >= 10) {
    push("playlist-hunter", "Mengonversi 10+ track sekaligus");
  }
  const hour = context.convertHour;
  if (typeof hour === "number" && hour >= 0 && hour < 4) {
    push("late-night-converter", "Konversi larut malam");
  }
  if ((user.totalConversions || 0) >= 50) {
    push("conversion-pro", "Sudah 50 kali konversi");
  }
  user.badges = Array.from(awarded);
  return results;
};

export const recordConversionForUser = async (userId, entryPayload = {}) => {
  if (!userId) return null;
  const data = await readStore();
  const user = data.users[userId];
  if (!user) return null;
  const now = Date.now();
  const xpGain = Number(entryPayload.xpGain) || 50;
  const durationSeconds = Number(entryPayload.durationSeconds) || 0;
  const minutes = durationSeconds / 60;
  const historyEntry = {
    id: entryPayload.id || nanoid(10),
    title: entryPayload.title || null,
    artist: entryPayload.artist || null,
    album: entryPayload.album || null,
    format: entryPayload.format || null,
    bitrate: entryPayload.bitrate || null,
    sourceUrl: entryPayload.sourceUrl || null,
    downloadUrl: entryPayload.downloadUrl || null,
    createdAt: now,
    durationSeconds,
    payload: entryPayload.command || null,
    preview: entryPayload.preview || null,
    resultId: entryPayload.resultId || null,
    size: entryPayload.size || null,
    playlist: entryPayload.playlist || null,
  };
  user.history = Array.isArray(user.history) ? user.history : [];
  user.history.unshift(historyEntry);
  if (user.history.length > MAX_HISTORY_ENTRIES) {
    user.history.length = MAX_HISTORY_ENTRIES;
  }
  user.totalConversions = (user.totalConversions || 0) + 1;
  user.totalMinutes = Math.max(0, (user.totalMinutes || 0) + minutes);
  const xpEventId =
    sanitizeEventId(entryPayload.xpEventId || entryPayload.eventId || historyEntry.resultId || historyEntry.id);
  let xpEventResult = null;
  if (xpGain !== 0 && xpEventId) {
    xpEventResult = applyXpEvent(data, user, {
      eventId: xpEventId,
      delta: xpGain,
      reason: entryPayload.xpReason || "conversion",
      metadata: {
        historyId: historyEntry.id,
        format: historyEntry.format,
        sourceUrl: historyEntry.sourceUrl,
      },
    });
  } else {
    ensureXpBucket(data, user.id);
    const bucket = data.xpEvents[user.id];
    user.xp = computeXpFromBucket(bucket) || user.xp || 0;
    user.level = calculateLevel(user.xp);
  }
  user.updatedAt = now;
  const level = user.level;
  const badgesAwarded = deriveBadges(user, entryPayload.context || {});
  await writeStore(data);
  return {
    xpGain,
    xp: user.xp,
    level,
    totalConversions: user.totalConversions,
    totalMinutes: user.totalMinutes,
    badgesAwarded,
    historyEntry,
    xpEvent: xpEventResult,
    summary: buildUserSummary(user),
  };
};

export const recordXpEventForUser = async (userId, { eventId, delta, reason, metadata } = {}) => {
  if (!userId) return null;
  const data = await readStore();
  const user = data.users[userId];
  if (!user) return null;
  const normalizedId = sanitizeEventId(eventId || "");
  if (!normalizedId) {
    throw new Error("eventId wajib diisi");
  }
  const result = applyXpEvent(data, user, {
    eventId: normalizedId,
    delta,
    reason,
    metadata,
  });
  user.updatedAt = Date.now();
  await writeStore(data);
  return {
    xp: user.xp,
    level: user.level,
    applied: result.applied,
    event: result.event,
    events: Object.values(ensureXpBucket(data, userId)),
  };
};

export const listUserHistory = async (userId, { query, limit } = {}) => {
  if (!userId) return [];
  const data = await readStore();
  const user = data.users[userId];
  if (!user || !Array.isArray(user.history)) return [];
  const norm = typeof query === "string" ? query.trim().toLowerCase() : "";
  const source = norm
    ? user.history.filter((item) => {
        const haystack = [item.title, item.artist, item.album, item.sourceUrl]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase())
          .join(" ");
        return haystack.includes(norm);
      })
    : user.history;
  const max = typeof limit === "number" && limit > 0 ? Math.min(limit, 100) : 100;
  return source.slice(0, max);
};

export const getHistoryEntry = async (userId, entryId) => {
  if (!userId || !entryId) return null;
  const data = await readStore();
  const user = data.users[userId];
  if (!user || !Array.isArray(user.history)) return null;
  return user.history.find((item) => item.id === entryId) || null;
};

export const updateHistoryEntry = async (userId, entryId, patch = {}) => {
  if (!userId || !entryId) return null;
  const data = await readStore();
  const user = data.users[userId];
  if (!user || !Array.isArray(user.history)) return null;
  const entry = user.history.find((item) => item.id === entryId);
  if (!entry) return null;
  Object.assign(entry, patch, { updatedAt: Date.now() });
  await writeStore(data);
  return entry;
};

export const claimCheatForUser = async (userId, rawCode) => {
  if (!userId) throw new Error("userId wajib diisi");
  const normalized = typeof rawCode === "string" ? rawCode.trim().toLowerCase() : "";
  if (!normalized) throw new Error("Kode cheat wajib diisi");
  const cheat = CHEAT_CODES[normalized];
  if (!cheat) throw new Error("Kode cheat tidak dikenali");

  const data = await readStore();
  const user = data.users[userId];
  if (!user) throw new Error("Pengguna tidak ditemukan");

  const claims = ensureCheatBucket(data, userId);
  if (claims[normalized]) {
    const { xp, level } = reconcileUserRecord(data, userId, { touchUpdatedAt: false });
    return {
      applied: false,
      alreadyClaimed: true,
      xp,
      level,
      cheat: claims[normalized],
    };
  }

  const now = Date.now();
  let xpDelta = Number(cheat.xp) || 0;
  let xpEvent = null;
  if (xpDelta !== 0) {
    xpEvent = applyXpEvent(data, user, {
      eventId: sanitizeEventId(`cheat:${normalized}`),
      delta: xpDelta,
      reason: cheat.reason || "cheat-code",
      metadata: { code: normalized, ...(cheat.metadata || {}) },
    });
    if (!xpEvent.applied) {
      xpDelta = 0;
    }
  } else {
    const bucket = ensureXpBucket(data, userId);
    user.xp = computeXpFromBucket(bucket) || user.xp || 0;
    user.level = calculateLevel(user.xp);
  }

  const badgeAwards = [];
  if (cheat.badge) {
    if (!Array.isArray(user.badges)) user.badges = [];
    if (!user.badges.includes(cheat.badge)) {
      user.badges.push(cheat.badge);
      badgeAwards.push({ id: cheat.badge });
    }
  }

  claims[normalized] = {
    code: normalized,
    xp: xpDelta,
    reason: cheat.reason || "cheat-code",
    claimedAt: now,
    metadata: cheat.metadata || null,
  };

  if (xpEvent?.applied) {
    user.xp = xpEvent.xp;
    user.level = calculateLevel(user.xp);
  }
  user.updatedAt = now;
  await writeStore(data);
  await appendCheatAudit({ userId, code: normalized, xpDelta, badge: cheat.badge || null });
  return {
    applied: true,
    alreadyClaimed: false,
    xp: user.xp,
    level: user.level,
    xpDelta,
    cheat: claims[normalized],
    badgesAwarded: badgeAwards,
    event: xpEvent?.event || null,
  };
};

export const buildUserSummaryById = async (userId) => {
  if (!userId) return null;
  const data = await readStore();
  const { user, changed } = reconcileUserRecord(data, userId, { touchUpdatedAt: true });
  if (!user) return null;
  if (changed) {
    await writeStore(data);
  }
  return buildUserSummary(user);
};

export const revokeUserSession = async (userId) => {
  const data = await readStore();
  const user = data.users[userId];
  if (!user) return;
  user.updatedAt = Date.now();
  await writeStore(data);
};

export const getStoreSnapshot = async () => {
  const data = await readStore();
  return data;
};

export const ensureReferralForUser = async (userId) => {
  const data = await readStore();
  const user = data.users[userId];
  if (!user) return null;
  const code = ensureReferralCode(data, user);
  await writeStore(data);
  return code;
};

export const updateUserPlan = async (userId, plan) => {
  if (!userId) return null;
  const data = await readStore();
  const user = data.users[userId];
  if (!user) return null;
  user.plan = plan || user.plan;
  user.updatedAt = Date.now();
  await writeStore(data);
  return buildUserSummary(user);
};

