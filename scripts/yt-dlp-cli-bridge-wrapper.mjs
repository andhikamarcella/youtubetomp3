import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";

const BOT_CHECK_PATTERN = /sign in to confirm|not a bot|bot.?check|too many requests|rate.?limit|HTTP Error 429/i;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_LOG_BYTES = 256 * 1024;

const optionValue = (args, names) => {
  const accepted = new Set(Array.isArray(names) ? names : [names]);
  for (let index = 0; index < args.length; index += 1) {
    const item = String(args[index] || "");
    if (accepted.has(item) && index + 1 < args.length) return String(args[index + 1]);
    for (const name of accepted) {
      if (item.startsWith(`${name}=`)) return item.slice(name.length + 1);
    }
  }
  return "";
};

const hasOption = (args, names) => {
  const accepted = Array.isArray(names) ? names : [names];
  return args.some((item) => accepted.includes(String(item || "")));
};

const findTarget = (args = []) => {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    const value = String(args[index] || "").trim();
    if (/^(?:https?:|ytsearch|ytmsearch)/i.test(value)) return value;
  }
  return "";
};

const outputTemplate = (args = []) => optionValue(args, ["-o", "--output"]);

const isMetadataInvocation = (args = []) => hasOption(args, [
  "--dump-single-json",
  "--dump-json",
  "-J",
  "-j",
  "--get-url",
  "--get-title",
  "--get-id",
  "--get-duration",
]);

export const buildBridgeRequest = (args = []) => {
  const target = findTarget(args);
  if (!target) return null;
  const metadata = isMetadataInvocation(args);
  return {
    mode: metadata ? "metadata" : "download",
    target,
    format: optionValue(args, ["-f", "--format"]),
    extractAudio: hasOption(args, ["-x", "--extract-audio"]),
    audioFormat: optionValue(args, "--audio-format"),
    audioQuality: optionValue(args, "--audio-quality"),
    mergeOutputFormat: optionValue(args, "--merge-output-format"),
    noPlaylist: hasOption(args, "--no-playlist") || !hasOption(args, "--yes-playlist"),
    outputTemplate: metadata ? "" : outputTemplate(args),
  };
};

const sanitizeHeaderFilename = (value = "") => {
  const normalized = basename(String(value || "").replace(/[\r\n]/g, "")).replace(/[^A-Za-z0-9._ -]+/g, "_");
  return normalized || "ytconv-bridge.bin";
};

export const resolveBridgeOutputPath = (template = "", remoteFilename = "") => {
  const filename = sanitizeHeaderFilename(remoteFilename);
  const extension = extname(filename).replace(/^\./, "") || "bin";
  if (!template) return join(process.cwd(), filename);
  if (template.includes("%(ext)s")) return template.replaceAll("%(ext)s", extension);
  if (!/%\([^)]+\)s/.test(template)) return template;
  return join(dirname(template), filename);
};

const trimLog = (value = "") => {
  const text = String(value || "");
  if (Buffer.byteLength(text) <= MAX_LOG_BYTES) return text;
  return Buffer.from(text).subarray(-MAX_LOG_BYTES).toString("utf8");
};

const decodeLogHeader = (value = "") => {
  try {
    return Buffer.from(String(value || ""), "base64url").toString("utf8");
  } catch {
    return "";
  }
};

const runRealYtDlp = (args, { metadata = false } = {}) => new Promise((resolve) => {
  const realCommand = String(process.env.YTDLP_REAL_PATH || "/usr/local/bin/yt-dlp-real").trim();
  const child = spawn(realCommand, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  let settled = false;

  const finish = (result) => {
    if (settled) return;
    settled = true;
    resolve(result);
  };

  child.stdout?.on("data", (chunk) => {
    const text = chunk.toString();
    stdout = trimLog(stdout + text);
    if (!metadata) process.stdout.write(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    stderr = trimLog(stderr + chunk.toString());
    process.stderr.write(chunk);
  });
  child.on("error", (error) => finish({ code: 127, stdout, stderr: trimLog(`${stderr}\n${error.message}`), error }));
  child.on("close", (code, signal) => {
    if (code === 0 && metadata && stdout) process.stdout.write(stdout);
    finish({ code: Number.isInteger(code) ? code : 1, signal, stdout, stderr });
  });
});

const bridgeConfigured = () => Boolean(
  String(process.env.YTDLP_CLI_BRIDGE_URL || "").trim()
  && String(process.env.YTDLP_CLI_BRIDGE_SECRET || "").trim(),
);

export const shouldUseBridge = ({ code, stderr = "", stdout = "" } = {}) => {
  if (!bridgeConfigured()) return false;
  if (Number(code) === 127) return true;
  return BOT_CHECK_PATTERN.test(`${stderr}\n${stdout}`);
};

const callBridge = async (request) => {
  const baseUrl = String(process.env.YTDLP_CLI_BRIDGE_URL || "").trim().replace(/\/$/, "");
  const secret = String(process.env.YTDLP_CLI_BRIDGE_SECRET || "").trim();
  const timeoutMs = Math.max(10_000, Number(process.env.YTDLP_CLI_BRIDGE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();

  try {
    const response = await fetch(`${baseUrl}/v1/yt-dlp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Accept: "application/octet-stream, application/json",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    const remoteLog = decodeLogHeader(response.headers.get("x-ytconv-log") || "");
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 8000);
      throw new Error(`CLI bridge HTTP ${response.status}: ${detail || remoteLog || "unknown error"}`);
    }

    const kind = response.headers.get("x-ytconv-kind") || request.mode;
    if (kind === "metadata") {
      const text = await response.text();
      if (remoteLog) process.stderr.write(`${remoteLog}\n`);
      process.stdout.write(text);
      return { code: 0, kind, bytes: Buffer.byteLength(text) };
    }

    const remoteFilename = response.headers.get("x-ytconv-filename") || "ytconv-bridge.bin";
    const destination = resolveBridgeOutputPath(request.outputTemplate, remoteFilename);
    await mkdir(dirname(destination), { recursive: true });
    if (!response.body) throw new Error("CLI bridge returned an empty file body");
    await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
    if (remoteLog) process.stderr.write(`${remoteLog}\n`);
    process.stderr.write(`[ytconv-cli-bridge] saved ${destination}\n`);
    return { code: 0, kind: "download", destination };
  } finally {
    clearTimeout(timer);
  }
};

export const main = async (argv = process.argv.slice(2)) => {
  const request = buildBridgeRequest(argv);
  const realResult = await runRealYtDlp(argv, { metadata: request?.mode === "metadata" });
  if (realResult.code === 0) return 0;
  if (!request || !shouldUseBridge(realResult)) return realResult.code || 1;

  process.stderr.write("[ytconv-cli-bridge] server IP blocked; retrying through configured CLI bridge\n");
  try {
    const result = await callBridge(request);
    return result.code;
  } catch (error) {
    process.stderr.write(`[ytconv-cli-bridge] ${error?.message || error}\n`);
    return realResult.code || 1;
  }
};

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) {
  const code = await main();
  process.exitCode = code;
}
