import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import {
  buildBridgeRequest,
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
