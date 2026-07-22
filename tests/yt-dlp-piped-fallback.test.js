import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { PassThrough } from "node:stream";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const moduleUrl = pathToFileURL(join(process.cwd(), "src/lib/ytDlpPipedFallbackPreload.js")).href;

test("Piped fallback parses YouTube IDs and selects audio", async () => {
  const module = await import(`${moduleUrl}?helpers=${Date.now()}`);
  assert.equal(module.extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=1"), "dQw4w9WgXcQ");
  assert.equal(module.extractYoutubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  const selected = module.selectPipedAudioStream([
    { url: "https://media.example/a.webm", mimeType: "audio/webm", bitrate: 160000 },
    { url: "https://media.example/a.m4a", mimeType: "audio/mp4", bitrate: 128000 },
  ], "m4a");
  assert.equal(selected?._ext, "m4a");
});

test("yt-dlp bot-check becomes a successful output through Piped", async () => {
  const module = await import(`${moduleUrl}?integration=${Date.now()}`);
  const directory = await mkdtemp(join(tmpdir(), "ytconv-piped-"));
  const outputTemplate = join(directory, "job123.%(ext)s");
  const audio = Buffer.alloc(4096, 7);
  const calls = [];

  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes("/streams/dQw4w9WgXcQ")) {
      return new Response(JSON.stringify({
        audioStreams: [
          { url: "https://media.example/audio.m4a", mimeType: "audio/mp4", bitrate: 128000 },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(audio, { status: 200, headers: { "content-type": "audio/mp4", "content-length": String(audio.length) } });
  };

  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = null;
    child.kill = () => true;
    child.pid = 123;
    queueMicrotask(() => {
      child.stderr.emit("data", Buffer.from("ERROR: Sign in to confirm you’re not a bot. Use --cookies\n"));
      child.emit("close", 1, null);
    });
    return child;
  };

  const env = {
    YTDLP_PIPED_FALLBACK: "true",
    YTDLP_PIPED_INSTANCES: "https://piped.example",
    YTDLP_PIPED_REQUEST_TIMEOUT_MS: "5000",
    YTDLP_PIPED_DOWNLOAD_TIMEOUT_MS: "5000",
    YTDLP_PIPED_MAX_MB: "10",
  };
  const spawn = module.createPipedFallbackSpawn(spawnImpl, { fetchImpl, env });
  const proc = spawn("yt-dlp", [
    "-f", "bestaudio/best",
    "-x", "--audio-format", "mp3",
    "-o", outputTemplate,
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  const stderrChunks = [];
  proc.stderr.on("data", (chunk) => stderrChunks.push(chunk));
  const [code] = await once(proc, "close");
  assert.equal(code, 0);
  assert.equal(calls.length, 2);
  const output = await readFile(join(directory, "job123.m4a"));
  assert.equal(output.length, audio.length);
  assert.match(Buffer.concat(stderrChunks).toString("utf8"), /fallback succeeded/i);
  await rm(directory, { recursive: true, force: true });
});
