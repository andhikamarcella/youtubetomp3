# Cookies and browser sessions

Public access is tried first. For account-authorized media, sign in on the provider's official site and use:

```bash
ytconv download "URL" --cookies-browser chrome
```

An exported file must use Netscape `cookies.txt` format:

```bash
ytconv download "URL" --cookies "/full/path/cookies.txt"
```

Never upload, commit, email, or paste cookies. Cookies do not bypass DRM, paywalls, regional rules, or account permission.
