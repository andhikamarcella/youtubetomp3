# Migration to YTConv 1.7.4

YTConv 1.7.4 is a backward-compatible patch release. Existing download, conversion, donation, login, profile, history, and configuration commands remain available.

## Upgrade

```bash
npm install --global ytconv@1.7.4
ytconv --version
ytconv doctor
```

The expected version is `1.7.4`.

## Interactive archive recovery

Interactive downloads use the same per-profile archive defaults as headless commands. If yt-dlp exits successfully while the archive is active but no matching output file exists, YTConv retries the item once with the archive explicitly disabled.

The retry does not delete or rewrite the user's archive. It only bypasses the archive for that single recovery attempt. This also works when yt-dlp quiet output does not print an “already recorded” message.

To bypass archive behavior manually:

```bash
ytconv download "URL" --no-archive
```

## Accurate login recovery

YTConv now distinguishes positive authentication failures from explanations that explicitly say an account or cookies are not required. A zero-output, FFmpeg, codec, or archive failure no longer opens browser login merely because its explanatory text contains the word “cookies.”

Public media is still attempted without cookies first. Restricted, private, age-gated, or account-only media can still use the official browser-login recovery flow when the provider returns a genuine authentication signal.

## Browser discovery

On desktop systems, YTConv can detect a supported installed Chromium browser from its executable even before a regular browser profile directory exists. The private YTConv login profile remains isolated from the user's normal browser profile.

See [Troubleshooting](TROUBLESHOOTING.md), [Authentication](AUTHENTICATION.md), [cookies.txt](COOKIES.md), and [Safety and legal use](SAFETY-LEGAL.md).
