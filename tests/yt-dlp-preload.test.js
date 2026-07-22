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

const optionPair = (args, name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args.slice(index, index + 2) : [];
};

test("yt-dlp preload normalizes stale clients, uses guest mode, and rotates egress proxies", async () => {
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
      YTDLP_YOUTUBE_PLAYER_CLIENTS: "mweb,web_safari,tv_embedded,android,default",
      YTDLP_FETCH_POT: "always",
      YTDLP_POT_PROVIDER_URL: "http://127.0.0.1:4416",
      YTDLP_IMPERSONATE: "chrome",
      YTDLP_SLEEP_REQUESTS: "0.75",
      YTDLP_PROXY: undefined,
      YTDLP_PROXY_POOL: "http://proxy-a.example:8080,\nhttp://proxy-b.example:8080",
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
      assert.deepEqual(optionPair(args, "--proxy"), ["--proxy", "http://proxy-a.example:8080"]);
      assert.deepEqual(optionPair(args, "--impersonate"), ["--impersonate", "chrome"]);
      assert.deepEqual(optionPair(args, "--sleep-requests"), ["--sleep-requests", "0.75"]);
      assert.equal(args.at(-1), url);

      const retryArgs = module.injectYtDlpArgs("yt-dlp", [
        "--cookies", cookiesPath,
        "--extractor-args", "youtube:player_client=mweb",
        url,
      ]);
      assert.deepEqual(optionPair(retryArgs, "--cookies"), ["--cookies", cookiesPath]);
      assert.equal(retryArgs.filter((item) => item === "--cookies").length, 1);
      assert.deepEqual(optionPair(retryArgs, "--proxy"), ["--proxy", "http://proxy-b.example:8080"]);

      const wrappedArgs = module.injectYtDlpArgs("python3", ["-m", "yt_dlp", url]);
      assert.deepEqual(optionPair(wrappedArgs, "--proxy"), ["--proxy", "http://proxy-a.example:8080"]);

      const explicitProxyArgs = module.injectYtDlpArgs("yt-dlp", [
        "--proxy", "socks5://explicit.example:1080",
        url,
      ]);
      assert.deepEqual(optionPair(explicitProxyArgs, "--proxy"), ["--proxy", "socks5://explicit.example:1080"]);
      assert.equal(explicitProxyArgs.filter((item) => item === "--proxy").length, 1);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
