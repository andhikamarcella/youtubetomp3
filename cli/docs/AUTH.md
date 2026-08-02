# Login akun media sosial di YTConv 1.5.6

YTConv dapat memakai sesi akun yang sudah login di browser desktop tanpa meminta pengguna mengekspor `cookies.txt`. Fitur ini tersedia untuk Instagram, Facebook, X/Twitter, TikTok, YouTube/Google, Pinterest, Reddit, Threads, Twitch, SoundCloud, Vimeo, Tumblr, Flickr, dan Pixiv.

Download publik tidak memerlukan akun YTConv. Login hanya diperlukan ketika situs sumber memang membatasi media ke akun yang memiliki izin.

## Login pertama

```sh
ytconv login instagram
```

YTConv akan:

1. mendeteksi browser lokal;
2. meminta pengguna memilih browser bila ada lebih dari satu;
3. membuka `instagram.com/accounts/login` di browser tersebut;
4. menunggu pengguna menyelesaikan password dan 2FA pada halaman resmi Instagram;
5. menyimpan hanya pasangan `instagram → browser/profil`;
6. memakai sesi itu otomatis ketika link Instagram tidak dapat dibaca secara publik.

Contoh provider lain:

```sh
ytconv login facebook --browser edge
ytconv login x --browser firefox
ytconv login youtube --browser "chrome:Profile 1"
ytconv login tiktok
ytconv login pinterest
```

Gunakan nama profil browser bila akun yang benar tidak berada di profil default:

```powershell
ytconv.cmd login instagram --browser edge --profile "Profile 2"
```

## Status dan logout

```sh
ytconv social status
ytconv logout instagram
ytconv social logout --all
```

`logout PROVIDER` hanya melepaskan hubungan provider dari YTConv. Perintah itu tidak menghapus sesi atau akun dari browser. Untuk benar-benar logout dari situs, gunakan menu logout pada situs resmi di browser.

## Cara penyimpanan yang aman

YTConv tidak menyimpan:

- password;
- kode OTP atau 2FA;
- access token atau refresh token media sosial;
- nilai cookie mentah;
- salinan database cookie browser.

Cookie tetap berada di browser dan dilindungi oleh mekanisme browser/OS, seperti DPAPI pada Windows, Keychain pada macOS, atau keyring desktop pada Linux. YTConv hanya menyimpan provider, nama browser/profil, dan waktu penautan di:

```text
~/.ytconv/social-sessions.json
```

Pada Unix-like, file referensi tersebut ditulis dengan mode `0600`. File itu bukan salinan sesi dan tidak cukup untuk masuk ke akun tanpa database browser asli.

## Jika sesi browser tidak dapat dibaca

1. Tutup seluruh jendela browser dan pastikan proses browser tidak berjalan di background.
2. Jalankan kembali download.
3. Jika masih gagal, tautkan ulang dengan browser lain:

```sh
ytconv login instagram --browser firefox
```

Firefox sering lebih mudah dibaca oleh tool CLI karena database sesi tidak memakai mekanisme penguncian Chromium yang sama. Pada Chrome/Edge modern, enkripsi App-Bound atau kebijakan perangkat dapat melarang proses CLI membaca cookie; YTConv tidak mencoba menerobos perlindungan tersebut.

## Batasan Android Termux dan iPhone/iSH

Android dan iOS memisahkan data privat browser dari aplikasi terminal. Karena itu Termux/iSH tidak bisa membaca database browser Chrome/Safari secara langsung. YTConv tidak akan mencoba membypass sandbox perangkat. Gunakan media publik atau metode autentikasi resmi yang tersedia untuk platform/perangkat tersebut.

## Akun cloud YTConv (opsional)

Akun YTConv lama tidak diwajibkan untuk download. Jika tetap ingin digunakan:

```sh
ytconv account login
ytconv auth status
ytconv account logout
```

Jika account endpoint tidak tersedia, gunakan `ytconv account login --local`. Kegagalan server akun tidak memblokir fungsi downloader CLI.

## Aturan penggunaan

Gunakan hanya akun milik sendiri dan hanya unduh media yang dimiliki, berlisensi terbuka, atau telah mendapat izin. Login tidak mengubah hak akses akun dan tidak membypass DRM, paywall, akun privat yang tidak diikuti, pembatasan wilayah, atau kontrol hak cipta.
