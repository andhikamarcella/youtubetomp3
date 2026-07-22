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

const assertNoForcedYoutubeEnhancements = (args) => {
  assert.equal(args.includes("--js-runtimes"), false);
  assert.equal(args.includes("--remote-components"), false);
  assert.equal(args.includes("--extractor-retries"), false);
  assert.equal(args.includes("--impersonate"), false);
  assert.equal(args.includes("--sleep-requests"), false);
  assert.equal(args.includes("--cookies"), false);
  assert.equal(args.includes("--proxy"), false);
  assert.equal(
    extractorArgValues(args).some((value) => /^(?:youtube|youtubepot-bgutilhttp):/i.test(value)),
    false,
  );
};

test("yt-dlp preload runs a real cookie-free CLI attempt before enhanced retries", async () => {
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
      YTDLP_VANILLA_FIRST: "true",
      YTDLP_YOUTUBE_PLAYER_CLIENTS: "mweb",
      YTDLP_YOUTUBE_CLIENT_POOL: "mweb,web_embedded,android_vr,web_safari,default",
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
      const originalDownloadArgs = [
        "--js-runtimes", "deno",
        "--remote-components", "ejs:npm",
        "--extractor-retries", "3",
        "--extractor-args", "youtube:player_client=mweb,web_safari,tv_embedded,android,default",
        "-f", "bestaudio/best",
        url,
      ];

      const vanillaDownloadArgs = module.injectYtDlpArgs("yt-dlp", originalDownloadArgs);
      assertNoForcedYoutubeEnhancements(vanillaDownloadArgs);
      assert.deepEqual(optionPair(vanillaDownloadArgs, "-f"), ["-f", "bestaudio/best"]);
      assert.equal(vanillaDownloadArgs.at(-1), url);

      const enhancedDownloadArgs = module.injectYtDlpArgs("yt-dlp", originalDownloadArgs);
      const enhancedExtractorArgs = extractorArgValues(enhancedDownloadArgs);
      assert.ok(enhancedExtractorArgs.includes("youtube:player_client=mweb;fetch_pot=always"));
      assert.ok(enhancedExtractorArgs.includes("youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416"));
      assert.equal(enhancedDownloadArgs.includes("--cookies"), false);
      assert.deepEqual(optionPair(enhancedDownloadArgs, "--proxy"), ["--proxy", "http://proxy-a.example:8080"]);
      assert.deepEqual(optionPair(enhancedDownloadArgs, "--impersonate"), ["--impersonate", "chrome"]);
      assert.deepEqual(optionPair(enhancedDownloadArgs, "--sleep-requests"), ["--sleep-requests", "0.75"]);
      assert.equal(enhancedDownloadArgs.at(-1), url);

      const vanillaMetadataArgs = module.injectYtDlpArgs("yt-dlp", [
        "--dump-single-json",
        "--skip-download",
        "--js-runtimes", "deno",
        "--extractor-args", "youtube:player_client=mweb",
        url,
      ]);
      assertNoForcedYoutubeEnhancements(vanillaMetadataArgs);
      assert.equal(vanillaMetadataArgs.includes("--dump-single-json"), true);
      assert.equal(vanillaMetadataArgs.includes("--skip-download"), true);

      const cookieRetryArgs = module.injectYtDlpArgs("yt-dlp", [
        "--cookies", cookiesPath,
        "--extractor-args", "youtube:player_client=mweb",
        url,
      ]);
      assert.deepEqual(optionPair(cookieRetryArgs, "--cookies"), ["--cookies", cookiesPath]);
      assert.equal(cookieRetryArgs.filter((item) => item === "--cookies").length, 1);
      assert.deepEqual(optionPair(cookieRetryArgs, "--proxy"), ["--proxy", "http://proxy-b.example:8080"]);

      const nextEnhancedArgs = module.injectYtDlpArgs("python3", ["-m", "yt_dlp", url]);
      assert.deepEqual(optionPair(nextEnhancedArgs, "--proxy"), ["--proxy", "http://proxy-a.example:8080"]);
      assert.ok(extractorArgValues(nextEnhancedArgs).includes("youtube:player_client=web_embedded"));

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
