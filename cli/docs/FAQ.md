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

## Why did a `blob/HEAD/cli/docs/...` link return 404?

The repository default branch hosts the web application, while the maintained CLI lives on versioned release branches. YTConv 1.7.3 restores a compatibility docs path on the default branch and prints release-pinned documentation URLs through `ytconv docs`.

## How do I find documentation from the terminal?

Run `ytconv docs --list`, then open a topic such as `ytconv docs troubleshooting`, `ytconv docs authentication`, or `ytconv docs packages`. Run `ytconv about` for project links and `ytconv shortcuts` for interactive keys.

