# Authentication and Browser Sessions

Some authorized downloads require an authenticated browser session. YTConv supports browser-login recovery without storing account passwords.

## Safe workflow

1. Sign in through the provider's official website in a supported browser.
2. Run the browser-session option shown by `ytconv --help`, or use `ytconv login PROVIDER` where supported.
3. Confirm the exact target URL and requested output.
4. Remove temporary cookie exports after the command finishes.

## Security rules

- Never commit cookies, tokens, browser profiles, passwords, or OTP codes.
- Never paste session data into GitHub issues, chat, screenshots, or public logs.
- Use a dedicated browser profile where practical.
- Revoke sessions from the provider when a device is lost or a cookie may have leaked.
- YTConv does not bypass provider authorization, paywalls, account restrictions, or access controls.

## Recovery

If authentication fails, update the relevant engine, sign in again through the official website, verify the selected browser profile, and run `ytconv --diagnose`. See [Troubleshooting](TROUBLESHOOTING.md) for additional steps.
