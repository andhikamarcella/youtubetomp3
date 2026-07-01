import test from "node:test";
import assert from "node:assert/strict";
import { promises as fsp } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  upsertGoogleUser,
  recordConversionForUser,
  recordXpEventForUser,
  reconcileUserXp,
  listUserHistory,
  buildUserSummaryById,
  ensureReferralForUser,
  getHistoryEntry,
  updateHistoryEntry,
  deleteHistoryEntry,
  clearUserHistory,
  claimCheatForUser,
} from "../user_store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const USERS_PATH = join(DATA_DIR, "users.json");

const resetStore = async () => {
  await fsp.rm(DATA_DIR, { recursive: true, force: true });
};

test("upsertGoogleUser membuat user baru dan summary", async () => {
  await resetStore();
  const summary = await upsertGoogleUser({
    googleId: "user-123",
    email: "demo@example.com",
    name: "Demo User",
    avatarUrl: "https://example.com/avatar.png",
  });
  assert.equal(summary.id, "user-123");
  assert.equal(summary.email, "demo@example.com");
  assert.equal(summary.level, 1);
  assert.ok(summary.referralCode);

  const summaryAgain = await buildUserSummaryById("user-123");
  assert.equal(summaryAgain?.name, "Demo User");
  const code = await ensureReferralForUser("user-123");
  assert.equal(code, summary.referralCode);
  const content = JSON.parse(await fsp.readFile(USERS_PATH, "utf8"));
  assert.ok(content.users["user-123"]);
});

test("recordConversionForUser menambah riwayat dan xp", async () => {
  await resetStore();
  await upsertGoogleUser({
    googleId: "user-456",
    email: "convert@example.com",
    name: "Converter",
  });
  const record = await recordConversionForUser("user-456", {
    title: "Song Title",
    artist: "Artist",
    format: "mp3",
    sourceUrl: "https://youtu.be/example",
    downloadUrl: "/public/jobs/demo.mp3",
    durationSeconds: 180,
    xpGain: 80,
    command: { url: "https://youtu.be/example" },
    context: { batchSize: 1, convertHour: 2 },
  });
  assert.equal(record.xp, 80);
  assert.equal(record.level, 1);
  assert.equal(record.historyEntry.title, "Song Title");
  assert.ok(record.badgesAwarded.length >= 1);
  assert.ok(record.badgesAwarded.some((badge) => badge.id === 'audiophile-beginner'));

  const history = await listUserHistory("user-456");
  assert.equal(history.length, 1);
  assert.equal(history[0].title, "Song Title");

  const entry = await getHistoryEntry("user-456", history[0].id);
  assert.equal(entry?.downloadUrl, "/public/jobs/demo.mp3");

  await updateHistoryEntry("user-456", history[0].id, { downloadUrl: "/public/jobs/new.mp3" });
  const updated = await getHistoryEntry("user-456", history[0].id);
  assert.equal(updated?.downloadUrl, "/public/jobs/new.mp3");

  assert.equal(await deleteHistoryEntry("user-456", history[0].id), true);
  assert.equal(await getHistoryEntry("user-456", history[0].id), null);
  assert.equal(await deleteHistoryEntry("user-456", history[0].id), false);
});

test("clearUserHistory menghapus semua riwayat user login", async () => {
  await resetStore();
  await upsertGoogleUser({
    googleId: "user-clear-history",
    email: "clear@example.com",
    name: "Clear History",
  });
  await recordConversionForUser("user-clear-history", {
    id: "hist-a",
    title: "A",
    format: "mp3",
    sourceUrl: "https://youtu.be/a",
    downloadUrl: "/jobs/a.mp3",
    xpGain: 1,
  });
  await recordConversionForUser("user-clear-history", {
    id: "hist-b",
    title: "B",
    format: "m4a",
    sourceUrl: "https://youtu.be/b",
    downloadUrl: "/jobs/b.m4a",
    xpGain: 1,
  });

  assert.equal((await listUserHistory("user-clear-history")).length, 2);
  assert.equal(await clearUserHistory("user-clear-history"), 2);
  assert.deepEqual(await listUserHistory("user-clear-history"), []);
});

test("recordConversionForUser idempoten terhadap xpEventId yang sama", async () => {
  await resetStore();
  await upsertGoogleUser({
    googleId: "user-789",
    email: "dup@example.com",
    name: "Duplicated",
  });
  const xpEventId = "convert-demo-event";
  const first = await recordConversionForUser("user-789", {
    id: "hist-1",
    xpEventId,
    title: "Track",
    format: "mp3",
    sourceUrl: "https://youtu.be/demo",
    downloadUrl: "/jobs/a.mp3",
    durationSeconds: 120,
    xpGain: 60,
    command: { url: "https://youtu.be/demo" },
  });
  const second = await recordConversionForUser("user-789", {
    id: "hist-2",
    xpEventId,
    title: "Track",
    format: "mp3",
    sourceUrl: "https://youtu.be/demo",
    downloadUrl: "/jobs/a.mp3",
    durationSeconds: 120,
    xpGain: 60,
    command: { url: "https://youtu.be/demo" },
  });
  assert.equal(first.xp, 60);
  assert.equal(second.xp, 60);
  assert.ok(second?.xpEvent);
  assert.equal(second.xpEvent.applied, false);
  const history = await listUserHistory("user-789");
  assert.equal(history.length, 2);
});

test("recordXpEventForUser menyimpan event dan rekonsiliasi xp", async () => {
  await resetStore();
  await upsertGoogleUser({
    googleId: "user-999",
    email: "xp@example.com",
  });
  const first = await recordXpEventForUser("user-999", {
    eventId: "bonus-1",
    delta: 120,
    reason: "bonus",
  });
  assert.equal(first.applied, true);
  assert.equal(first.xp, 120);
  const duplicate = await recordXpEventForUser("user-999", {
    eventId: "bonus-1",
    delta: 9999,
  });
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.xp, 120);
  const reconcile = await reconcileUserXp("user-999");
  assert.equal(reconcile.xp, 120);
  assert.equal(reconcile.level, 1);
});

test("claimCheatForUser memberikan XP rahasia dan idempoten", async () => {
  await resetStore();
  await upsertGoogleUser({
    googleId: "cheat-user",
    email: "cheat@example.com",
    name: "Cheat Tester",
  });
  const first = await claimCheatForUser(
    "cheat-user",
    "andhikagantengbangetomagadgantengbangetmuachmuach",
  );
  assert.equal(first.applied, true);
  assert.equal(first.alreadyClaimed, false);
  assert.equal(first.xpDelta, 30000);
  assert.equal(first.xp, 30000);
  assert.ok(Array.isArray(first.badgesAwarded));
  assert.ok(first.badgesAwarded.some((badge) => (badge?.id || badge) === "andhika"));
  const targetLevel = first.level;

  const second = await claimCheatForUser(
    "cheat-user",
    "andhikagantengbangetomagadgantengbangetmuachmuach",
  );
  assert.equal(second.applied, false);
  assert.equal(second.alreadyClaimed, true);
  assert.equal(second.xp, 30000);
  assert.equal(second.level, targetLevel);
});

