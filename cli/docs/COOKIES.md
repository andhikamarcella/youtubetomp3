# cookies.txt: an easy and safe guide

YTConv tries public access first. Normal public videos do not need cookies. Use a browser session only when the site requires an account and that account is allowed to view the media.

## Easiest choice: read the browser session directly

1. Sign in on the provider's official site with Chrome, Edge, Firefox, Brave, Chromium, Opera, Vivaldi, or Safari.
2. Confirm that the URL plays in a normal profile, not an incognito/private window.
3. Close the browser if its cookie database is locked.
4. Run:

```bash
ytconv download "URL" --cookies-browser chrome
```

Replace `chrome` with the browser in use. This is safer than keeping a permanent cookie export.

## Export without a browser extension

If `yt-dlp` is on PATH, it can read the profile and write Netscape format:

```bash
yt-dlp --cookies-from-browser chrome --cookies "$HOME/Downloads/cookies.txt"
chmod 600 "$HOME/Downloads/cookies.txt"
ytconv download "URL" --cookies "$HOME/Downloads/cookies.txt"
```

The export may contain cookies for **every site** in the profile. Delete it immediately after use:

```bash
rm "$HOME/Downloads/cookies.txt"
```

## If an extension is necessary

The official yt-dlp FAQ links to these two options:

- Chrome, Edge, Brave, or Chromium: [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
- Firefox: [cookies.txt](https://addons.mozilla.org/firefox/addon/cookies-txt/)

Steps:

1. Review the developer name, permissions, privacy policy, and recent reviews before installation.
2. Open the official provider site and sign in with an account that may access the media.
3. Open the media page, select the extension, and export **Netscape** format—not JSON.
4. Save `cookies.txt` in a private folder.
5. Run:

```bash
ytconv download "URL" --cookies "/full/path/to/cookies.txt"
```

Do not install the older **Get cookies.txt** extension without **LOCALLY** in its name. The yt-dlp FAQ notes that the old extension was reported as malware and removed from the Chrome Web Store.

## Windows

```powershell
ytconv.cmd download "URL" --cookies-browser edge
ytconv.cmd download "URL" --cookies "$env:USERPROFILE\Downloads\cookies.txt"
```

## Flatpak browser on Linux

A Flatpak Chrome profile is commonly stored under `~/.var/app/com.google.Chrome/`:

```bash
ytconv download "URL" --cookies-browser "chrome:~/.var/app/com.google.Chrome/"
```

## iSH on iPhone/iPad

iSH cannot read Safari/Chrome iOS session databases. Export on a trusted device, move the file through Files into the iSH folder, then run:

```sh
chmod 600 "$HOME/cookies.txt"
ytconv "URL" --cookies "$HOME/cookies.txt"
rm "$HOME/cookies.txt"
```

## Check the file format

The file must use Mozilla/Netscape format. Its first line must be `# HTTP Cookie File` or `# Netscape HTTP Cookie File`. Renaming a JSON file to `cookies.txt` does not convert it.

## Safety rules

- Never upload or commit `cookies.txt` to GitHub.
- Never paste cookies into email, chat, issues, screenshots, or logs.
- Never send cookies to `help.ytconv@proton.me`; send only sanitized diagnostics.
- Cookies do not bypass DRM, paywalls, regional controls, or account permissions.
- If the file may have leaked, sign out of every site session and rotate relevant credentials.

Official reference: [yt-dlp cookies FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp).
