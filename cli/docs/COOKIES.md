# cookies.txt: easy and safe setup

Public media is tried first. You do not need cookies for normal public downloads. Use cookies only when the site requires an account and your account is authorized to view the media.

## Easiest option: use your browser session directly

Sign in on the provider's official website, close private/incognito windows, then run:

```bash
ytconv download "URL" --cookies-browser chrome
```

Replace `chrome` with `edge`, `firefox`, `brave`, `chromium`, `opera`, `vivaldi`, or `safari`. On desktop, `ytconv login instagram` and similar provider commands can guide this flow.

## Use an exported cookies.txt file

If browser access is unavailable, export a Netscape-format `cookies.txt` file with a trusted, local browser extension. Save it outside the project folder, then run:

```bash
ytconv download "URL" --cookies "/full/path/to/cookies.txt"
```

Windows example:

```powershell
ytconv.cmd download "URL" --cookies "$env:USERPROFILE\Downloads\cookies.txt"
```

Do not rename JSON exports to `cookies.txt`; yt-dlp expects Netscape cookie-file format.

## Safety checklist

- Never upload or commit `cookies.txt`.
- Never paste cookie contents into email, chat, issues, screenshots, or logs.
- Use only an account that is allowed to access the media.
- Delete an exported file after use and revoke the website session if it may have leaked.
- Cookies do not bypass DRM, paywalls, regional rules, or account permissions.

Official details: [yt-dlp FAQ: cookies](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp).

## Common errors

`Sign in to confirm you are not a bot` can be a provider-side challenge or blocked data-center IP, not a file-format bug. Update the engines with `ytconv repair`, sign in again, and retry from the same network/browser profile. Account-restricted media may still be unavailable.
