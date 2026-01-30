// admin.js
import fs from "fs";
import express from "express";
import { join } from "path";
const router = express.Router();
const COOKIE_PATH = join(process.cwd(), "cookies.txt");
const WORKER_BASE = process.env.WORKER_API_BASE || "";
const WORKER_SECRET = (process.env.WORKER_SHARED_SECRET || "").trim();

router.use((req, res, next) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!process.env.ADMIN_TOKEN || token === process.env.ADMIN_TOKEN) return next();
  return res.status(401).json({ error: "unauthorized" });
});

router.post("/upload-cookies", express.text({ type: "*/*", limit: "1mb" }), async (req, res) => {
  const body = req.body || "";
  if (!body.trim()) return res.status(400).json({ error: "empty body" });
  await fs.promises.writeFile(COOKIE_PATH, body, "utf8");
  if (WORKER_BASE && WORKER_SECRET) {
    const workerUrl = `${WORKER_BASE.replace(/\/$/, "")}/admin/upload-cookies`;
    try {
      const resp = await fetch(workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          Authorization: `Bearer ${WORKER_SECRET}`,
        },
        body,
      });
      if (!resp.ok) {
        console.warn("Worker upload-cookies responded with", resp.status);
      }
    } catch (error) {
      console.warn("Failed to forward cookies to worker", error);
    }
  }
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

router.get("/download-cookies", async (_req, res) => {
  try {
    const text = await fs.promises.readFile(COOKIE_PATH, "utf8");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(text);
  } catch (error) {
    if (error?.code === "ENOENT") return res.status(404).json({ error: "not_found" });
    return res.status(500).json({ error: error.message });
  }
});

export default router;
