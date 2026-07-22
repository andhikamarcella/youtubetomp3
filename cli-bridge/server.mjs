import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { timingSafeEqual, randomUUID } from "node:crypto";
import { basename, extname, join } from "node:path";
import { tmpdir } from "node:os";

const HOST = String(process.env.HOST || "127.0.0.1").trim();
const PORT = Math.max(1, Math.min(65535, Number(process.env.PORT || 4417)));
const SECRET = String(process.env.YTCONV_BRIDGE_SECRET || "").trim();
const MAX_BODY_BYTES = 128 * 1024;
const MAX_LOG_BYTES = 64 * 1024;
const JOB_TIMEOUT_MS = Math.max(30_000, Number(process.env.YTCONV_BRIDGE_JOB_TIMEOUT_MS || 15 * 60 * 1000));
const MAX_CONCURRENT = Math.max(1, Math.min(8, Number(process.env.YTCONV_BRIDGE_MAX_CONCURRENT || 2)));
let activeJobs = 0;

if (!SECRET || SECRET.length < 24) {
  console.error("YTCONV_BRIDGE_SECRET wajib diisi minimal 24 karakter");
  process.exit(1);
}

const safeEqual = (left = "", right = "") => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
};

const authorized = (req) => {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") && safeEqual(header.slice(7), SECRET);
};

const sendJson = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
};

const readJsonBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let total = 0;
  req.on("data", (chunk) => {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      reject(Object.assign(new Error("request_too_large"), { status: 413 }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on("end", () => {
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
    } catch {
      reject(Object.assign(new Error("invalid_json"), { status: 400 }));
    }
  });
  req.on("error", reject);
});

const validateTarget = (value = "") => {
  const target = String(value || "").trim();
  if (/^(?:ytsearch|ytmsearch):/i.test(target)) {
    if (target.length > 600) throw Object.assign(new Error("search_too_long"), { status: 400 });
    return target;
  }
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    throw Object.assign(new Error("invalid_target"), { status: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw Object.assign(new Error("invalid_protocol"), { status: 400 });
  const host = parsed.hostname.toLowerCase();
  const allowed = host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com");
  if (!allowed) throw Object.assign(new Error("youtube_only"), { status: 400 });
  return parsed.toString();
};

const safeValue = (value, max = 300) => String(value || "").trim().slice(0, max);

const findYtDlpCandidates = () => {
  const configured = String(process.env.YTDLP_PATH || "").trim();
  const values = [];
  if (configured) values.push({ command: configured, prefix: [] });
  values.push({ command: process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp", prefix: [] });
  values.push({ command: process.platform === "win32" ? "python" : "python3", prefix: ["-m", "yt_dlp"] });
  if (process.platform === "win32") values.push({ command: "py", prefix: ["-3", "-m", "yt_dlp"] });
  const seen = new Set();
  return values.filter((item) => {
    const key = `${item.command}\0${item.prefix.join("\0")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildArgs = (request, outputTemplate = "") => {
  const target = validateTarget(request.target);
  const args = ["--no-config", "--no-playlist"];
  const runtime = String(process.env.YTCONV_BRIDGE_JS_RUNTIME || "").trim();
  if (runtime && !/^(?:off|none|0)$/i.test(runtime)) args.push("--js-runtimes", runtime);

  if (request.mode === "metadata") {
    args.push("--dump-single-json", "--skip-download", target);
    return args;
  }

  args.push("--newline", "--no-progress", "--no-part", "-o", outputTemplate);
  const format = safeValue(request.format, 500);
  if (format) args.push("-f", format);
  if (request.extractAudio) args.push("--extract-audio");
  const audioFormat = safeValue(request.audioFormat, 20).toLowerCase();
  if (audioFormat && /^[a-z0-9]+$/.test(audioFormat)) args.push("--audio-format", audioFormat);
  const audioQuality = safeValue(request.audioQuality, 20);
  if (audioQuality && /^[0-9.]+[kKmM]?$/.test(audioQuality)) args.push("--audio-quality", audioQuality);
  const mergeFormat = safeValue(request.mergeOutputFormat, 20).toLowerCase();
  if (mergeFormat && /^(?:mp4|mkv|webm)$/.test(mergeFormat)) args.push("--merge-output-format", mergeFormat);
  args.push(target);
  return args;
};

const runCandidate = (candidate, args, timeoutMs) => new Promise((resolve) => {
  const child = spawn(candidate.command, [...candidate.prefix, ...args], { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  let finished = false;
  const append = (current, chunk) => {
    const next = current + chunk.toString();
    return Buffer.byteLength(next) > MAX_LOG_BYTES
      ? Buffer.from(next).subarray(-MAX_LOG_BYTES).toString("utf8")
      : next;
  };
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
  }, timeoutMs);
  timer.unref?.();

  const done = (result) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    resolve(result);
  };

  child.stdout?.on("data", (chunk) => { stdout = append(stdout, chunk); });
  child.stderr?.on("data", (chunk) => { stderr = append(stderr, chunk); });
  child.on("error", (error) => done({ code: 127, stdout, stderr: `${stderr}\n${error.message}`, error }));
  child.on("close", (code, signal) => done({ code: Number.isInteger(code) ? code : 1, signal, stdout, stderr }));
});

const runYtDlp = async (args) => {
  const errors = [];
  for (const candidate of findYtDlpCandidates()) {
    const result = await runCandidate(candidate, args, JOB_TIMEOUT_MS);
    if (result.code === 0) return { ...result, candidate };
    errors.push(`${candidate.command} ${candidate.prefix.join(" ")}: ${result.stderr || result.stdout}`);
    if (result.code !== 127) break;
  }
  throw Object.assign(new Error("yt_dlp_failed"), { status: 502, logs: errors.join("\n").slice(-MAX_LOG_BYTES) });
};

const listOutputFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (/\.(?:part|ytdl|json)$/i.test(entry.name)) continue;
    const filePath = join(directory, entry.name);
    const info = await stat(filePath);
    if (info.size > 0) results.push({ path: filePath, name: entry.name, size: info.size, mtimeMs: info.mtimeMs });
  }
  return results.sort((a, b) => b.mtimeMs - a.mtimeMs);
};

const logHeader = (value = "") => Buffer.from(String(value).slice(-6000), "utf8").toString("base64url");

const processRequest = async (request, res) => {
  if (!["metadata", "download"].includes(request.mode)) throw Object.assign(new Error("invalid_mode"), { status: 400 });
  validateTarget(request.target);
  const workspace = await mkdtemp(join(tmpdir(), "ytconv-cli-bridge-"));
  try {
    const output = join(workspace, `${randomUUID()}.%(ext)s`);
    const args = buildArgs(request, output);
    const result = await runYtDlp(args);
    const combinedLog = `${result.candidate.command} ${result.candidate.prefix.join(" ")}\n${result.stderr}`.trim();

    if (request.mode === "metadata") {
      const body = result.stdout || "{}";
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store",
        "X-Ytconv-Kind": "metadata",
        "X-Ytconv-Log": logHeader(combinedLog),
      });
      res.end(body);
      return;
    }

    const files = await listOutputFiles(workspace);
    const file = files[0];
    if (!file) throw Object.assign(new Error("download_output_missing"), { status: 502, logs: combinedLog });
    const safeName = basename(file.name).replace(/[^A-Za-z0-9._ -]+/g, "_");
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Length": file.size,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
      "X-Ytconv-Kind": "download",
      "X-Ytconv-Filename": safeName,
      "X-Ytconv-Extension": extname(safeName).replace(/^\./, ""),
      "X-Ytconv-Log": logHeader(combinedLog),
    });
    await new Promise((resolve, reject) => {
      const stream = createReadStream(file.path);
      stream.on("error", reject);
      res.on("close", resolve);
      res.on("finish", resolve);
      stream.pipe(res);
    });
  } finally {
    await rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
};

const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, { ok: true, activeJobs, maxConcurrent: MAX_CONCURRENT });
  }
  if (req.method !== "POST" || req.url !== "/v1/yt-dlp") return sendJson(res, 404, { error: "not_found" });
  if (!authorized(req)) return sendJson(res, 401, { error: "unauthorized" });
  if (activeJobs >= MAX_CONCURRENT) return sendJson(res, 429, { error: "bridge_busy" });

  activeJobs += 1;
  try {
    const body = await readJsonBody(req);
    await processRequest(body, res);
  } catch (error) {
    if (!res.headersSent) {
      sendJson(res, Number(error?.status || 500), {
        error: error?.message || "bridge_failed",
        detail: String(error?.logs || "").slice(-8000),
      });
    } else {
      res.destroy(error);
    }
  } finally {
    activeJobs = Math.max(0, activeJobs - 1);
  }
});

server.requestTimeout = JOB_TIMEOUT_MS + 30_000;
server.headersTimeout = 15_000;
server.listen(PORT, HOST, () => {
  console.log(`YTConv CLI bridge listening at http://${HOST}:${PORT}`);
  console.log("Only authenticated YouTube/YouTube Music requests are accepted.");
});
