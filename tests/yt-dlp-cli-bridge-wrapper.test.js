import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildBridgeRequest,
  callBridge,
  normalizeBridgeBaseUrl,
  resolveBridgeOutputPath,
} from "../scripts/yt-dlp-cli-bridge-wrapper.mjs";

test("CLI bridge wrapper converts metadata yt-dlp args into a safe request", () => {
  const request = buildBridgeRequest([
    "--dump-single-json",
    "--skip-download",
    "--no-playlist",
    "--cookies", "/data/cookies.txt",
    "https://www.youtube.com/watch?v=jNQXAC9IVRw",
  ]);

  assert.deepEqual(request, {
    mode: "metadata",
    target: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    format: "",
    extractAudio: false,
    audioFormat: "",
    audioQuality: "",
    mergeOutputFormat: "",
    noPlaylist: true,
    outputTemplate: "",
  });
});

test("CLI bridge wrapper preserves conversion choices without forwarding cookies", () => {
  const request = buildBridgeRequest([
    "--cookies", "/data/cookies.txt",
    "-f", "bestaudio/best",
    "--extract-audio",
    "--audio-format", "mp3",
    "--audio-quality", "2",
    "-o", "/tmp/jobs/job-123.%(ext)s",
    "https://music.youtube.com/watch?v=jNQXAC9IVRw",
  ]);

  assert.equal(request.mode, "download");
  assert.equal(request.target, "https://music.youtube.com/watch?v=jNQXAC9IVRw");
  assert.equal(request.format, "bestaudio/best");
  assert.equal(request.extractAudio, true);
  assert.equal(request.audioFormat, "mp3");
  assert.equal(request.audioQuality, "2");
  assert.equal(request.outputTemplate, "/tmp/jobs/job-123.%(ext)s");
  assert.equal(Object.hasOwn(request, "cookies"), false);
});

test("CLI bridge output uses the extension returned by the local CLI", () => {
  assert.equal(
    resolveBridgeOutputPath("/tmp/jobs/job-123.%(ext)s", "remote-result.webm"),
    "/tmp/jobs/job-123.webm",
  );
  assert.equal(
    resolveBridgeOutputPath("", "remote-result.m4a"),
    join(process.cwd(), "remote-result.m4a"),
  );
});

test("public CLI bridge URLs require HTTPS", () => {
  assert.equal(normalizeBridgeBaseUrl("https://bridge.example/path/"), "https://bridge.example/path");
  assert.equal(normalizeBridgeBaseUrl("http://127.0.0.1:4417/"), "http://127.0.0.1:4417");
  assert.throws(() => normalizeBridgeBaseUrl("http://bridge.example"), /wajib memakai HTTPS/);
});

test("CLI bridge streams a remote yt-dlp file into the original output template", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ytconv-cli-bridge-test-"));
  const secret = "integration-test-secret-at-least-24-chars";
  let receivedBody = null;
  const server = createServer(async (req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/v1/yt-dlp");
    assert.equal(req.headers.authorization, `Bearer ${secret}`);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    receivedBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const body = Buffer.from("fake-audio-data");
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Length": body.length,
      "X-Ytconv-Kind": "download",
      "X-Ytconv-Filename": "local-cli-result.m4a",
    });
    res.end(body);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const previousUrl = process.env.YTDLP_CLI_BRIDGE_URL;
  const previousSecret = process.env.YTDLP_CLI_BRIDGE_SECRET;
  process.env.YTDLP_CLI_BRIDGE_URL = `http://127.0.0.1:${address.port}`;
  process.env.YTDLP_CLI_BRIDGE_SECRET = secret;

  try {
    const outputTemplate = join(directory, "job-test.%(ext)s");
    const result = await callBridge({
      mode: "download",
      target: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      format: "bestaudio/best",
      extractAudio: false,
      audioFormat: "",
      audioQuality: "",
      mergeOutputFormat: "",
      noPlaylist: true,
      outputTemplate,
    });

    assert.equal(result.code, 0);
    assert.equal(result.destination, join(directory, "job-test.m4a"));
    assert.equal(await readFile(result.destination, "utf8"), "fake-audio-data");
    assert.equal(receivedBody.target, "https://www.youtube.com/watch?v=jNQXAC9IVRw");
    assert.equal(Object.hasOwn(receivedBody, "cookies"), false);
  } finally {
    if (previousUrl === undefined) delete process.env.YTDLP_CLI_BRIDGE_URL;
    else process.env.YTDLP_CLI_BRIDGE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.YTDLP_CLI_BRIDGE_SECRET;
    else process.env.YTDLP_CLI_BRIDGE_SECRET = previousSecret;
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
