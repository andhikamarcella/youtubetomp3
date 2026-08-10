# Deno and JavaScript runtimes

Current YouTube extraction can require an external JavaScript runtime. YTConv detects supported Deno first and uses Node.js as an explicit fallback.

Requirements:

- Deno 2.3.0 or newer, or
- Node.js 22.0 or newer; YTConv itself requires Node.js 22.14 or newer.

Install Deno from the [official Deno instructions](https://docs.deno.com/runtime/getting_started/installation/), then verify:

```bash
deno --version
ytconv --diagnose
```

The official yt-dlp executable and `yt-dlp[default]` package include the maintained EJS component. For supply-chain safety, YTConv disables downloading remote JavaScript components at conversion time. A JavaScript runtime helps solve supported extraction challenges; it does not remove account, cookie, regional, or provider restrictions.

Official reference: [yt-dlp EJS wiki](https://github.com/yt-dlp/yt-dlp/wiki/EJS).
