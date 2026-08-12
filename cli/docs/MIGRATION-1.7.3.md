# Migration to YTConv 1.7.3

YTConv 1.7.3 is a backward-compatible patch release. Existing download, conversion, login, profile, history, and configuration commands remain available.

## Upgrade

```bash
npm install --global ytconv@1.7.3
ytconv --version
ytconv doctor
```

The expected version is `1.7.3`.

## New donation command

```bash
ytconv donate
ytconv donate kofi
ytconv donate saweria
```

The interactive home screen also accepts `N`. Donation is optional and does not unlock features or change support priority. Ko-fi is labeled for global users and Saweria for users in Indonesia.

YTConv only opens the two release-pinned HTTPS pages. After the browser handoff, the interactive screen returns home after five seconds. A device without a compatible browser receives a copied link when clipboard support exists and always receives the complete manual URL.

## Public no-cookie validation

The release pipeline resolves the requested public YouTube URL ten times without cookies. It also repeats every deterministic audio/video conversion ten times and downloads short clips from openly licensed public YouTube candidates as MP4 and MP3 ten times each. Hosted-runner IP challenges remain an external service limitation and are reported separately from selector, conversion, and output-verification failures.

No Google password, token, or private browser session is stored in the source or CI.

See [Donate](DONATE.md), [Troubleshooting](TROUBLESHOOTING.md), and [Safety and legal use](SAFETY-LEGAL.md).
