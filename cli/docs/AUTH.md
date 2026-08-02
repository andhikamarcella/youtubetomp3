# YTConv CLI login and local fallback

YTConv 1.5.5 requires a profile before a media download or conversion starts. It prefers cloud device sign-in when the configured account service is available and automatically falls back to a private profile stored only on the current device when that service is unavailable.

## First login

```sh
ytconv login
```

YTConv prints an eight-character code and a secure browser link. Sign in with Google, verify that the code in the browser matches the terminal, and choose **Allow YTConv CLI**. The terminal continues automatically after approval.

The browser may be on a different device. This is useful for iSH, SSH, headless Linux, and terminals that cannot open a browser themselves.

If the account endpoint is missing or offline, YTConv clearly reports the problem, creates a local profile, and returns to the CLI. This prevents a web deployment problem from disabling the downloader.

## Account commands

```sh
ytconv auth status
ytconv logout
ytconv login
ytconv login --local
ytconv login --cloud-only
ytconv login --no-launch
```

`logout` revokes the current device token on the server and removes the local token file.

- `--local` skips the cloud request and creates a private local profile immediately.
- `--cloud-only` fails instead of using local fallback when cloud login is unavailable.
- `--no-launch` completes login without opening the interactive downloader afterward.

## Local token storage

The CLI stores the issued cloud device token or local profile identifier plus basic account metadata:

- Node.js CLI: `~/.ytconv/auth.json`
- iSH frontend: `~/.ytconv/auth.json`

On Unix-like systems the file is written with mode `0600`. Cookie files, Google passwords, OAuth client secrets, and browser sessions are never copied into this file. A local fallback profile is not a verified online identity and is never advertised as one.

## Security behavior

- Device codes expire after ten minutes.
- CLI access tokens expire after ninety days.
- The database stores access-token hashes, not raw long-lived tokens.
- The temporary device response token is encrypted with AES-256-GCM.
- Cloud sessions are validated before conversion; local fallback sessions are validated on-device.
- Help, version, diagnostics, repair, update, configuration, and history commands remain available before login.
