# Frequently Asked Questions

## Is YTConv a website?

This package is the YTConv command-line application. The canonical source repository is `andhikamarcella/YTConv`.

## Does it include FFmpeg and downloader engines?

Availability depends on the installation format. Run `ytconv --diagnose` to see what the current system can use.

## Why is a requested format unavailable?

The provider may not expose it, the relevant engine may be outdated, or FFmpeg may be missing. See [Troubleshooting](TROUBLESHOOTING.md).

## Can it access private content?

Only when the user is authorized and supplies a valid supported browser session. YTConv does not bypass access controls.

## Are subtitles downloaded automatically?

No. Subtitles are disabled by default unless explicitly requested.

## Is telemetry enabled?

No. YTConv declares telemetry disabled.

## How do I verify an official release?

Compare SHA-256 checksums and inspect npm/GitHub provenance as described in [Releases](RELEASES.md).

## Where should bugs be reported?

Use the issue tracker in the canonical repository and include sanitized diagnostic information. Never include cookies, tokens, passwords, or private URLs.
