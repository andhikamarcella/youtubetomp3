# YTConv CLI account login

YTConv 1.5.0 requires an active YTConv account before a media download or conversion starts. The same browser-based device flow is used by Windows, Linux, macOS, Termux, SSH terminals, and the native Python frontend for iSH.

## First login

```sh
ytconv login
```

YTConv prints an eight-character code and a secure browser link. Sign in with Google, verify that the code in the browser matches the terminal, and choose **Allow YTConv CLI**. The terminal continues automatically after approval.

The browser may be on a different device. This is useful for iSH, SSH, headless Linux, and terminals that cannot open a browser themselves.

## Account commands

```sh
ytconv auth status
ytconv logout
ytconv login
```

`logout` revokes the current device token on the server and removes the local token file.

## Local token storage

The CLI stores only the issued device token and basic account metadata:

- Node.js CLI: `~/.ytconv/auth.json`
- iSH frontend: `~/.ytconv/auth.json`

On Unix-like systems the file is written with mode `0600`. Cookie files, Google passwords, OAuth client secrets, and browser sessions are never copied into this file.

## Server configuration

The CLI uses `https://ytconv.onrender.com` by default. A self-hosted deployment can override it:

```sh
export YTCONV_API_BASE="https://ytconv.example.com"
```

The Next.js deployment needs:

- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `CLI_AUTH_ENCRYPTION_KEY` (recommended; otherwise `NEXTAUTH_SECRET` is used)

The CLI device tables are created automatically by the API and are also included in `sql/schema.sql`.

## Security behavior

- Device codes expire after ten minutes.
- CLI access tokens expire after ninety days.
- The database stores access-token hashes, not raw long-lived tokens.
- The temporary device response token is encrypted with AES-256-GCM.
- Every conversion validates that the token is active and not revoked.
- Help, version, diagnostics, repair, update, configuration, and history commands remain available before login.
