# YTConv CLI

YTConv adalah aplikasi terminal hitam-putih untuk mengubah dan mengunduh media dari satu link. Antarmukanya dibuat sederhana: paste link, pilih format bila perlu, lalu tekan Enter untuk **convert**.

> Gunakan hanya untuk media milik sendiri atau media yang memang diizinkan untuk diunduh.

## Instalasi paling mudah

Yang perlu dipasang pengguna hanya **Node.js 18 atau lebih baru**.

```powershell
npm install -g ytconv
```

Saat instalasi, paket YTConv otomatis menyiapkan:

- binary resmi `yt-dlp` yang sesuai dengan Windows, Linux, atau macOS pengguna;
- binary FFmpeg melalui paket `ffmpeg-static`;
- seluruh library antarmuka terminal yang dibutuhkan.

Pengguna tidak perlu memasang Python, yt-dlp, atau FFmpeg secara terpisah.

Setelah terpasang, jalankan salah satu:

```powershell
npx ytconv
```

atau:

```powershell
ytconv
```

Link juga bisa langsung diberikan:

```powershell
npx ytconv "https://www.youtube.com/watch?v=..."
```

## Tampilan dan kontrol

YTConv menggunakan tampilan CLI monokrom atau hitam-putih dengan tombol visual **convert**.

```text
Enter       convert link
Tab         ganti video/audio
Ctrl + Q    ganti resolusi atau kualitas audio
Ctrl + F    ganti MP3/M4A ketika mode audio
Ctrl + B    ganti browser cookies
Ctrl + P    aktif/nonaktifkan playlist
Ctrl + C    batalkan atau keluar
O           buka folder hasil
R           convert link lain atau ulangi
E           kembali mengedit link setelah gagal
```

Hasil otomatis disimpan ke folder `Downloads`. Lokasi dapat diubah dengan environment variable `YTCONV_OUTPUT`.

## Dukungan situs

YTConv meneruskan link ke extractor generik `yt-dlp`, sehingga dapat mencoba YouTube, TikTok, Instagram, X/Twitter, Facebook, Reddit, Twitch, SoundCloud, Vimeo, Dailymotion, Bilibili, Pinterest, Tumblr, Streamable, Rumble, Kick, Bandcamp, Mixcloud, dan banyak situs lain yang didukung versi yt-dlp yang ikut terpasang.

Dukungan extractor tidak menjamin semua link selalu berhasil. Konten privat, login-only, berbayar, DRM, dibatasi wilayah, atau situs yang baru mengubah sistemnya dapat gagal.

## Cookies browser

Tekan `Ctrl+B` untuk memilih Chrome, Edge, Firefox, Brave, Chromium, Opera, atau Vivaldi. Ini berguna untuk media yang hanya bisa dibuka ketika akun pengguna sudah login.

## Menjalankan dari repository

```powershell
git clone https://github.com/andhikamarcella/youtubetomp3.git
cd youtubetomp3
git checkout codex/add-ytconv-cli
cd cli
npm install
npm start
```

`npm install` akan mengunduh binary yt-dlp dan FFmpeg yang sesuai dengan komputer tersebut.

Untuk memasang command lokal:

```powershell
npm link
ytconv
```

Setelah ada perubahan baru di branch:

```powershell
cd C:\Users\andhi\youtubetomp3
git checkout codex/add-ytconv-cli
git pull origin codex/add-ytconv-cli
cd cli
npm install
npm link
npx ytconv
```

## Menerbitkan ke npm

`npx ytconv` untuk pengguna umum baru tersedia setelah paket diterbitkan ke registry npm.

```powershell
cd cli
npm login
npm run check
npm pack --dry-run
npm publish --access public
```

Versi berikutnya:

```powershell
npm version patch
npm publish --access public
```

Apabila nama paket `ytconv` sudah dimiliki akun lain, gunakan scoped package:

```json
{
  "name": "@andhikamarcella/ytconv",
  "bin": {
    "ytconv": "./bin/ytconv.js"
  }
}
```

Kemudian:

```powershell
npm publish --access public
npm install -g @andhikamarcella/ytconv
npx @andhikamarcella/ytconv
```

Command setelah instalasi global tetap dapat menggunakan:

```powershell
ytconv
```

## Masalah instalasi

### Binary belum selesai disiapkan

Pastikan internet aktif, lalu:

```powershell
npm rebuild ytconv
```

Atau instal ulang:

```powershell
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv
```

### PowerShell memblokir `npm.ps1`

Gunakan `npm.cmd`:

```powershell
npm.cmd install -g ytconv
npx.cmd ytconv
```

Atau atur Execution Policy khusus akun pengguna:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Lisensi komponen

Kode YTConv menggunakan lisensi MIT. Binary yt-dlp dan FFmpeg tetap mengikuti lisensi proyek masing-masing. `ffmpeg-static` mendistribusikan binary FFmpeg sesuai ketentuan lisensinya.
