# Safety, privacy, and legal use

YTConv is a local command-line tool. It is not a promise that every URL may legally or technically be downloaded.

## Before saving media

- Save only media you own, created, licensed, or have explicit permission to download.
- Follow the provider's terms, copyright rules, and the law that applies where you live.
- Do not use YTConv to bypass DRM, paywalls, account permissions, or regional controls.
- For YouTube's official offline feature, use the Download button offered by YouTube/YouTube Premium where available. See [YouTube Help](https://support.google.com/youtube/answer/11977233) and the [YouTube Terms of Service](https://www.youtube.com/static?template=terms).

## Why YTConv does not offer a hosted web ripper

A third-party conversion website receives the URL, IP address, browser metadata, and potentially account data. Some sites also use intrusive ads, tracking, fake download buttons, or unsafe executables. YTConv 1.7.2 therefore keeps conversion local and publishes GitHub Pages only as a tutorial—never as a server-side ripper.

## Account media

Cookies are credentials. YTConv first tries public access and requests a local browser session only when the provider reports that authentication is required. Read [COOKIES.md](COOKIES.md) and never send a cookie file to support.

## AI and content transformation

`ytconv transcript URL` and `ytconv extract URL` save provider-available captions, text, and structured metadata. They do not invent missing transcripts or defeat access controls.

`--upscale 4k` performs deterministic FFmpeg Lanczos scaling. It creates a real 3840×2160 file but does not claim AI super-resolution or recovered detail. A portable, tested AI model is not bundled in 1.7.2 because that would be misleading on unsupported devices.

## Reporting a problem

Run `ytconv doctor` and `ytconv --diagnose`. Remove usernames, local paths, URLs to private media, cookies, tokens, email addresses, and account identifiers before sending a report to [help.ytconv@proton.me](mailto:help.ytconv@proton.me).
