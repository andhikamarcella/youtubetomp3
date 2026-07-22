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

const extractorArgValues = (args) => {
  const values = [];
  for (let index = 0; index < args.length - 1; index += 1) {
    if (args[index] === "--extractor-args") values.push(args[index + 1]);
  }
  return values;
};

test("yt-dlp preload uses guest mode, mweb PO tokens, and keeps cookies for retry", async () => {
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
      YTDLP_AUTO_INJECT_COOKIES: "false",
      YTDLP_YOUTUBE_PLAYER_CLIENTS: "mweb",
      YTDLP_FETCH_POT: "always",
      YTDLP_POT_PROVIDER_URL: "http://127.0.0.1:4416",
      YTDLP_IMPERSONATE: "chrome",
      YTDLP_SLEEP_REQUESTS: "0.75",
      YTDLP_PROXY: "http://proxy.example:8080",
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

      const extractorArgs = extractorArgValues(args);
      assert.ok(extractorArgs.includes("youtube:player_client=mweb;fetch_pot=always"));
      assert.ok(extractorArgs.includes("youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416"));
      assert.equal(args.includes("--cookies"), false, "public-video attempt must stay cookie-free");
      assert.deepEqual(args.slice(args.indexOf("--proxy"), args.indexOf("--proxy") + 2), ["--proxy", "http://proxy.example:8080"]);
      assert.deepEqual(args.slice(args.indexOf("--impersonate"), args.indexOf("--impersonate") + 2), ["--impersonate", "chrome"]);
      assert.deepEqual(args.slice(args.indexOf("--sleep-requests"), args.indexOf("--sleep-requests") + 2), ["--sleep-requests", "0.75"]);
      assert.equal(args.at(-1), url);

      const retryArgs = module.injectYtDlpArgs("yt-dlp", [
        "--cookies", cookiesPath,
        "--extractor-args", "youtube:player_client=mweb",
        url,
      ]);
      assert.deepEqual(retryArgs.slice(retryArgs.indexOf("--cookies"), retryArgs.indexOf("--cookies") + 2), ["--cookies", cookiesPath]);
      assert.equal(retryArgs.filter((item) => item === "--cookies").length, 1);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
