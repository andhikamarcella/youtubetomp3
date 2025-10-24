import test from "node:test";
import assert from "node:assert/strict";
import { promises as fsp } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  upsertGoogleUser,
  recordConversionForUser,
  listUserHistory,
  buildUserSummaryById,
  ensureReferralForUser,
  getHistoryEntry,
  updateHistoryEntry,
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
});

