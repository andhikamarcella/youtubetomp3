# Social-media account login in YTConv 1.5.8

YTConv can use an account session that is already signed in through a desktop browser without asking the user to export `cookies.txt`. This is available for Instagram, Facebook, X/Twitter, TikTok, YouTube/Google, Pinterest, Reddit, Threads, Twitch, SoundCloud, Vimeo, Tumblr, Flickr, and Pixiv.

Public downloads do not require a YTConv account. Sign-in is required only when the source site restricts media to an account that has permission to access it. In the interactive CLI, an authentication failure automatically opens the official login page and offers an immediate verified retry.

## First login

```sh
ytconv login instagram
```

YTConv will:

1. detect local browsers;
2. ask the user to choose one when multiple browsers are available;
3. open `instagram.com/accounts/login` in that browser;
4. wait for the user to complete password and 2FA entry on Instagram's official page;
5. retry the exact failed media URL with that browser profile;
6. store only the `instagram → browser/profile` association after the retry succeeds;
7. use that verified session automatically for later matching URLs.

If verification fails, no account link is saved. Press `B` in the login or error screen to open the official page in another detected profile.

Other provider examples:

```sh
ytconv login facebook --browser edge
ytconv login x --browser firefox
ytconv login youtube --browser "chrome:Profile 1"
ytconv login tiktok
ytconv login pinterest
```

Specify a browser profile when the correct account is not in the default profile:

```powershell
ytconv.cmd login instagram --browser edge --profile "Profile 2"
```

## Status and logout

```sh
ytconv social status
ytconv logout instagram
ytconv social logout --all
```

`logout PROVIDER` only removes the provider association from YTConv. It does not delete the browser session or account. To sign out from the site, use the site's official logout control in the browser.

## Safe storage model

YTConv does not store:

- passwords;
- OTP or 2FA codes;
- social-media access or refresh tokens;
- raw cookie values;
- copies of browser cookie databases.

Cookies remain in the browser and are protected by browser/OS mechanisms such as DPAPI on Windows, Keychain on macOS, or a desktop keyring on Linux. YTConv stores only the provider, browser/profile name, and link timestamp in:

```text
~/.ytconv/social-sessions.json
```

On Unix-like systems, this reference file is written with mode `0600`. It is not a session copy and cannot sign in to an account without the original browser database.

## If a browser session cannot be read

1. Close every browser window and ensure that no browser process remains in the background.
2. Retry the download.
3. If it still fails, link a different browser:

```sh
ytconv login instagram --browser firefox
```

Firefox is often easier for CLI tools to read because its session database does not use the same Chromium locking mechanism. On modern Chrome or Edge, App-Bound Encryption or device policy may prevent a CLI process from reading cookies; YTConv does not bypass those protections.

## Android Termux and iPhone/iSH limitations

Android and iOS isolate private browser data from terminal applications. Termux and iSH therefore cannot read Chrome or Safari databases directly. YTConv does not bypass the device sandbox. Use public media or an official authentication method available for that platform or device.

## Optional legacy YTConv cloud account

The legacy YTConv account is not required for downloads. To use it anyway:

```sh
ytconv account login
ytconv auth status
ytconv account logout
```

If the account endpoint is unavailable, use `ytconv account login --local`. An account-server failure does not block CLI downloading.

## Acceptable use

Use only your own accounts and download only media you own, that is openly licensed, or that you are authorized to save. Login does not change account permissions and does not bypass DRM, paywalls, private accounts you cannot access, regional restrictions, or copyright controls.
