# Interactive Help Center

YTConv 1.7.5 includes terminal-first documentation discovery. The commands print responsive, copyable panels and canonical URLs without requiring a browser integration or shell execution.

## Commands

```bash
ytconv docs
ytconv docs --list
ytconv docs installation
ytconv docs troubleshooting
ytconv docs authentication
ytconv about
ytconv shortcuts
```

Topic names accept useful aliases such as `install`, `doctor`, `login`, `cookies`, `oidc`, `package`, and `migrate`. Unknown topics return exit code `2` and display the complete topic list.

## Why URLs are release-pinned

The repository default branch also contains the web application, so CLI documentation URLs use an explicit CLI release branch. A small compatibility documentation landing page remains on the default branch so existing `blob/HEAD/cli/docs/...` links do not return 404.

## Security

The help center only formats text and prints HTTPS URLs. It does not execute a shell, collect telemetry, read browser sessions, or send project data anywhere.
