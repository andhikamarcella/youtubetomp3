import { promises as fsp } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { nanoid } from "nanoid";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const USERS_PATH = join(DATA_DIR, "users.json");
const MAX_HISTORY_ENTRIES = 100;

const defaultStore = () => ({
  users: {},
  referralIndex: {},
});

const readStore = async () => {
  try {
    const raw = await fsp.readFile(USERS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultStore();
    if (!parsed.users || typeof parsed.users !== "object") parsed.users = {};
    if (!parsed.referralIndex || typeof parsed.referralIndex !== "object") parsed.referralIndex = {};
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

const calculateLevel = (xp = 0) => {
  const total = Number(xp) || 0;
  return Math.max(1, Math.floor(total / 750) + 1);
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
  return data.users[id] || null;
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
    ensureReferralCode(data, user);
    if (referralCode) {
      const referrerId = data.referralIndex[String(referralCode).trim().toUpperCase()];
      if (referrerId && referrerId !== user.id) {
        const referrer = data.users[referrerId];
        if (referrer) {
          referrer.xp = (referrer.xp || 0) + 250;
          referrer.referralCount = (referrer.referralCount || 0) + 1;
          referrer.referrals = Array.isArray(referrer.referrals)
            ? Array.from(new Set([...referrer.referrals, user.id]))
            : [user.id];
          if (!Array.isArray(referrer.badges)) referrer.badges = [];
          if (!referrer.badges.includes("referral-trailblazer")) {
            referrer.badges.push("referral-trailblazer");
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
  user.xp = (user.xp || 0) + xpGain;
  user.updatedAt = now;
  const level = calculateLevel(user.xp);
  user.level = level;
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
    summary: buildUserSummary(user),
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

export const buildUserSummaryById = async (userId) => {
  if (!userId) return null;
  const user = await getUserById(userId);
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

