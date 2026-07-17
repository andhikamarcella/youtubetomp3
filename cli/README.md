# YTConv CLI

YTConv adalah aplikasi terminal interaktif berbasis Node.js untuk mengunduh media dengan satu link. Antarmukanya dibuat seperti aplikasi terminal modern: logo di tengah, satu kotak link, tombol `ytconv`, progress bar, status proses, dan shortcut keyboard.

> Gunakan hanya untuk media milik sendiri, media berlisensi bebas, atau media yang memang diizinkan untuk diunduh.

## Dukungan situs

YTConv tidak memakai daftar situs yang dikunci di dalam aplikasi. Link diteruskan ke extractor milik `yt-dlp`, sehingga dapat mencoba YouTube, TikTok, Instagram, X/Twitter, Facebook, Reddit, Twitch, SoundCloud, Vimeo, Dailymotion, Bilibili, Pinterest, Tumblr, Streamable, Rumble, Kick, Bandcamp, Mixcloud, dan banyak situs lainnya.

Dukungan nyata mengikuti versi `yt-dlp` yang terpasang. Situs dapat berubah sewaktu-waktu. Konten privat, login-only, berbayar, DRM, atau extractor yang sedang rusak mungkin tidak dapat diunduh.

## Fitur

- Tampilan TUI satu-link yang terpusat dan responsif.
- Deteksi platform, judul, uploader, durasi, dan playlist sebelum download.
- Video MP4 hingga kualitas terbaik yang tersedia.
- Audio MP3 atau M4A.
- Progress bar, persentase, kecepatan, ETA, serta status merging/converting.
- Cookies browser untuk Chrome, Edge, Firefox, Brave, Chromium, Opera, dan Vivaldi.
- Dukungan playlist yang bisa dinyalakan atau dimatikan.
- Folder hasil otomatis ke `Downloads`.
- Bisa langsung diberi link: `ytconv https://...`.
- Berjalan di Windows, Linux, dan macOS.

## Shortcut

| Tombol | Fungsi |
|---|---|
| `Enter` | Mulai download |
| `Tab` | Ganti Video/Audio |
| `Ctrl+Q` | Ganti resolusi atau kualitas audio |
| `Ctrl+F` | Ganti MP3/M4A saat mode Audio |
| `Ctrl+B` | Ganti browser cookies |
| `Ctrl+P` | Aktif/nonaktifkan playlist |
| `Ctrl+T` | Ganti tema warna |
| `Ctrl+C` | Batalkan atau keluar |
| `O` | Buka folder hasil setelah selesai |
| `R` | Download link lain / coba lagi |
| `E` | Edit link setelah error |

## Persyaratan

- Node.js 18 atau lebih baru.
- `yt-dlp` tersedia di PATH.
- FFmpeg tersedia di PATH.

### Windows

Buka PowerShell sebagai Administrator:

```powershell
winget install OpenJS.NodeJS.LTS
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

Tutup semua PowerShell/CMD, buka kembali, lalu cek:

```powershell
node --version
npm --version
yt-dlp --version
ffmpeg -version
```

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install -y nodejs npm yt-dlp ffmpeg
```

## Menjalankan branch pengembangan ini

```powershell
cd C:\Users\andhi\youtubetomp3
git checkout codex/add-ytconv-cli
cd cli
npm install
npm start
```

Apabila PowerShell memblokir `npm.ps1`, gunakan:

```powershell
npm.cmd install
npm.cmd start
```

## Membuat command `ytconv` di komputer

Dari folder `cli`:

```powershell
npm link
```

Sesudah itu YTConv dapat dibuka dari folder mana pun:

```powershell
ytconv
```

Link juga dapat diberikan langsung:

```powershell
ytconv "https://www.youtube.com/watch?v=..."
```

Untuk menghapus command lokal:

```powershell
npm unlink -g ytconv
```

## Menjalankan melalui npm setelah dipublikasikan

Tanpa instalasi global:

```powershell
npx ytconv
```

Dengan instalasi global:

```powershell
npm install -g ytconv
ytconv
```

`npx ytconv` baru dapat digunakan publik setelah paket diterbitkan ke registry npm.

## Folder hasil

Secara default, file disimpan ke folder `Downloads` milik pengguna.

Folder dapat diganti sementara dengan environment variable:

```powershell
$env:YTCONV_OUTPUT = "D:\Video"
ytconv
```

CMD:

```cmd
set YTCONV_OUTPUT=D:\Video
ytconv
```

## Cara menerbitkan ke npm

```powershell
cd cli
npm login
npm run check
npm pack --dry-run
npm publish --access public
```

Untuk versi berikutnya:

```powershell
npm version patch
npm publish --access public
```

Jika nama paket `ytconv` sudah dimiliki akun lain, ubah nama package menjadi scoped:

```json
{
  "name": "@andhikamarcella/ytconv",
  "bin": {
    "ytconv": "./bin/ytconv.js"
  }
}
```

Lalu:

```powershell
npm publish --access public
npx @andhikamarcella/ytconv
```

Command setelah instalasi global tetap bernama `ytconv`.

## Masalah umum

### `npm` mencari `C:\Users\andhi\package.json`

Kamu sedang berada di folder yang salah. Masuk ke folder CLI lebih dulu:

```powershell
cd C:\Users\andhi\youtubetomp3\cli
npm install
npm start
```

### `yt-dlp` atau FFmpeg tidak ditemukan

Pastikan keduanya dapat dijalankan langsung dari terminal. Sesudah instalasi, tutup dan buka kembali terminal agar PATH diperbarui.

### Link meminta login atau ditandai privat

Pada layar utama tekan `Ctrl+B` sampai browser yang sudah login muncul, lalu coba kembali. Tutup browser terlebih dahulu jika database cookies sedang terkunci.

### Situs tidak bisa diunduh

Update `yt-dlp`:

```powershell
yt-dlp -U
```

Beberapa situs dapat berubah dan sementara tidak didukung. YTConv tidak dapat melewati DRM, pembayaran, atau akses yang tidak dimiliki pengguna.

## Struktur

```text
cli/
├── bin/
│   └── ytconv.js
├── src/
│   ├── dependencies.js
│   ├── downloader.js
│   └── ui.js
├── LICENSE
├── package-lock.json
├── package.json
└── README.md
```
