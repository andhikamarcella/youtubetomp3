// admin.js
import fs from "fs";
import express from "express";
const router = express.Router();
const COOKIE_PATH = "/tmp/cookies.txt";

router.use((req, res, next) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!process.env.ADMIN_TOKEN || token === process.env.ADMIN_TOKEN) return next();
  return res.status(401).json({ error: "unauthorized" });
});

router.post("/upload-cookies", express.text({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const body = req.body || "";
  if (!body.trim()) return res.status(400).json({ error: "empty body" });
  await fs.promises.writeFile(COOKIE_PATH, body, "utf8");
  return res.json({ ok: true, path: COOKIE_PATH, bytes: body.length, mtime: new Date().toISOString() });
});

router.get("/cookies-status", async (_req, res) => {
  try {
    const st = await fs.promises.stat(COOKIE_PATH);
    return res.json({ exists: true, bytes: st.size, mtime: st.mtime });
  } catch {
    return res.json({ exists: false });
  }
});

export default router;
