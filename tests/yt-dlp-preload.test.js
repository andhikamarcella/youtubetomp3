import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const preloadUrl = pathToFileURL(join(process.cwd(), "src/lib/ytDlpCookiesPreload.js")).href;

const withEnv = async (patch, operation) => {
  const previous = new Map();
  for (const [key, value] of Object.entries(patch)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = String(value);
  }
  try {
    return await operation();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test("yt-dlp preload keeps HttpOnly cookies and removes stale default clients", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ytconv-cookies-"));
  const cookiesPath = join(directory, "cookies.txt");
  await writeFile(
    cookiesPath,
    [
      "# Netscape HTTP Cookie File",
      "#HttpOnly_.youtube.com\tTRUE\t/\tTRUE\t2147483647\tSAPISID\ttest-secret",
      ".youtube.com\tTRUE\t/\tFALSE\t2147483647\tPREF\ttz=Asia.Jakarta",
      "",
    ].join("\n"),
    "utf8",
  );

  try {
    await withEnv({
      COOKIES_PATH: cookiesPath,
      ENABLE_SERVER_COOKIES: "true",
      YTDLP_YOUTUBE_PLAYER_CLIENTS: undefined,
      YTDLP_IMPERSONATE: "chrome",
      YTDLP_SLEEP_REQUESTS: "0.75",
    }, async () => {
      const module = await import(`${preloadUrl}?test=${Date.now()}`);
      const cookies = module.readValidCookies();
      assert.equal(cookies?.filePath, cookiesPath);

      const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
      const args = module.injectYtDlpArgs("yt-dlp", [
        "--js-runtimes", "deno",
        "--extractor-args", "youtube:player_client=mweb,web_safari,tv_embedded,android,default",
        "-f", "bestaudio/best",
        url,
      ]);

      assert.equal(args.includes("--extractor-args"), false);
      assert.deepEqual(args.slice(args.indexOf("--cookies"), args.indexOf("--cookies") + 2), ["--cookies", cookiesPath]);
      assert.deepEqual(args.slice(args.indexOf("--impersonate"), args.indexOf("--impersonate") + 2), ["--impersonate", "chrome"]);
      assert.deepEqual(args.slice(args.indexOf("--sleep-requests"), args.indexOf("--sleep-requests") + 2), ["--sleep-requests", "0.75"]);
      assert.equal(args.at(-1), url);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
