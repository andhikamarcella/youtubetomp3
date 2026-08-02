# YTConv 1.6.0 beta

YTConv 1.6.0-beta.1 keeps the required account login introduced in 1.5.0 and adds account security controls for people who use YTConv on several devices.

## Install the beta

```sh
npm install -g ytconv@beta --force
ytconv --version
ytconv login
```

Expected version:

```text
1.6.0-beta.1
```

Use the included platform installers for Termux, Windows, Linux, macOS, and iSH when dependencies also need to be installed.

## Device management

```sh
ytconv auth devices
ytconv auth devices --json
ytconv auth revoke TOKEN_ID
ytconv auth revoke all
ytconv auth refresh
ytconv auth status --json
```

`auth revoke all` keeps the terminal issuing the command active and revokes the other CLI sessions. Use `ytconv logout` to revoke the current device.

## Automatic token rotation

Every media command validates the current token. When its remaining lifetime is seven days or less, the Node.js CLI rotates it automatically and atomically replaces `~/.ytconv/auth.json`. Manual rotation is available with `ytconv auth refresh`.

## Return to stable

```sh
npm install -g ytconv@latest --force
```

For iSH, rerun the stable 1.5.0 installer from the `release/ytconv-1.5.0` branch.

## Feedback checklist

When reporting a beta problem, include:

- output of `ytconv --version`
- output of `ytconv doctor`
- operating system and terminal app
- whether `ytconv auth status` works
- the media platform and a public test link when possible

Never include `~/.ytconv/auth.json`, cookies, access tokens, browser sessions, or private media links in a bug report.
