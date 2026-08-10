# Cookies dan sesi browser

Media publik dicoba tanpa cookies. Untuk media yang memang boleh diakses akunmu, login pada situs resmi lalu:

```bash
ytconv download "URL" --cookies-browser chrome
```

Jika harus memakai berkas Netscape:

```bash
ytconv download "URL" --cookies "/path/lengkap/cookies.txt"
```

Tautan yang dirujuk FAQ yt-dlp:

- [Get cookies.txt LOCALLY untuk Chrome/Edge/Brave/Chromium](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
- [cookies.txt untuk Firefox](https://addons.mozilla.org/firefox/addon/cookies-txt/)

Pilih format Netscape, jangan JSON. Jangan unggah, commit, email, atau tempel cookies. Cookies tidak melewati DRM, paywall, wilayah, atau izin akun. Baca [panduan lengkap branch 1.7.2](https://github.com/andhikamarcella/YTConv/blob/release/ytconv-1.7.2/cli/docs/COOKIES.md).
