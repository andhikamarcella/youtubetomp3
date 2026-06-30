import { spawn } from "node:child_process";

export const runCommand = (cmd, args = [], { cwd = process.cwd(), timeoutMs = 120000 } = {}) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  const timer = setTimeout(() => {
    child.kill("SIGTERM");
    const err = new Error("process_timeout");
    err.stdout = stdout;
    err.stderr = stderr;
    reject(err);
  }, timeoutMs);
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  child.on("error", (err) => {
    clearTimeout(timer);
    err.stdout = stdout;
    err.stderr = stderr;
    reject(err);
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    if (code !== 0) {
      const err = new Error(`process_exit_${code}`);
      err.code = code;
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
      return;
    }
    resolve({ stdout, stderr });
  });
  timer.unref?.();
});

export const buildAudioFormatSelector = (format = "mp3") => {
  if (format === "m4a") return "bestaudio[ext=m4a]/bestaudio/best";
  return "bestaudio/best";
};

export const buildVideoFormatSelector = (height = "best") => {
  const numericHeight = Number.parseInt(String(height || ""), 10);
  if (!Number.isFinite(numericHeight)) return "bestvideo+bestaudio/best";
  return `bestvideo[height<=${numericHeight}]+bestaudio/best[height<=${numericHeight}]/best`;
};
