import { spawn } from "node:child_process";

export const runFfmpeg = (ffmpegPath, args = [], { cwd = process.cwd(), timeoutMs = 15 * 60_000 } = {}) => new Promise((resolve, reject) => {
  if (!ffmpegPath) {
    const err = new Error("FFMPEG_MISSING");
    err.errorCategory = "FFMPEG_MISSING";
    reject(err);
    return;
  }
  const child = spawn(ffmpegPath, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  const timer = setTimeout(() => {
    child.kill("SIGTERM");
    const err = new Error("ffmpeg_timeout");
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
      const err = new Error(`ffmpeg_exit_${code}`);
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
      return;
    }
    resolve({ stdout, stderr });
  });
  timer.unref?.();
});
