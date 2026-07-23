// Keep runtime defaults inside the application so Render custom start commands
// (including `node index.js`) receive the same current fallback configuration.
if (!String(process.env.YTDLP_PIPED_INSTANCE_LIST_URL || "").trim()) {
  process.env.YTDLP_PIPED_INSTANCE_LIST_URL =
    "https://raw.githubusercontent.com/TeamPiped/Documentation/main/content/docs/public-instances/index.md";
}

await import("./ytDlpCookiesPreload.js");
await import("./ytDlpPipedFallbackPreload.js");
