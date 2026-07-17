# YTConv CLI 1.0.0

YTConv adalah aplikasi terminal hitam-putih untuk mengunduh media dari link sosial. Satu command dapat menangani video, audio, gambar tunggal, carousel, reels, story, highlights, dan posting campuran selama link tersebut didukung oleh engine yang digunakan.

> Gunakan hanya untuk media milik sendiri, media berlisensi bebas, atau media yang memang diizinkan untuk diunduh. YTConv tidak melewati DRM, pembayaran, akun privat yang tidak dapat kamu akses, atau pembatasan hak cipta.

## Engine bawaan

YTConv memakai tiga alat:

- `yt-dlp` untuk video dan audio.
- `gallery-dl` untuk gambar, carousel, reels/story tertentu, posting campuran, dan situs galeri.
- FFmpeg untuk merge dan konversi video/audio.

Pada Windows dan Linux, YTConv mencoba menyiapkan executable `yt-dlp`, `gallery-dl`, dan FFmpeg saat instalasi. Pada Termux, YTConv menyiapkan modul Python yang kompatibel dengan Android saat pemakaian pertama.

## Perangkat

- Windows x64/ARM64
- Linux x64/ARM64/ARM
- macOS Intel dan Apple Silicon
- Android melalui Termux

Catatan macOS: `yt-dlp` dan FFmpeg tetap otomatis. Bila executable `gallery-dl` tidak tersedia, YTConv mencoba modul Python. Pada perangkat macOS tanpa Python 3, image/gallery mode memerlukan Python 3 terlebih dahulu.

## Instalasi

Pasang Node.js 18 atau lebih baru, lalu:

```bash
npm install -g ytconv
ytconv
```

Tanpa instalasi global:

```bash
npx -y ytconv@latest
```

## Update wajib

Mulai YTConv `1.0.0`, aplikasi memeriksa versi terbaru dari npm. Bila versi baru tersedia, YTConv memperbarui dirinya sebelum membuka converter. Update manual:

```bash
ytconv --check-update
ytconv --update
npm install -g ytconv@latest
```

Setelah update:

```bash
ytconv --version
ytconv
```

Pengecekan dapat dilewati hanya untuk pemulihan/offline:

```bash
ytconv --no-update-check
```

### Pengguna versi lama

- `0.5.6` dan `0.5.7` sudah memiliki update checker dan akan melihat versi `1.0.0` setelah versi tersebut diterbitkan di npm.
- `0.5.5` atau lebih lama tidak memiliki kode update checker. Versi yang sudah terpasang tidak dapat diubah dari jarak jauh, sehingga perlu satu kali update manual:

```bash
npm install -g ytconv@latest
```

Sesudah pindah ke `1.0.0`, update berikutnya ditangani oleh sistem update wajib.

## Termux

Gunakan Termux dari F-Droid atau GitHub Releases:

```bash
pkg update
pkg install -y nodejs
termux-setup-storage
npm install -g ytconv
ytconv
```

Pada pemakaian pertama, YTConv menyiapkan:

```text
Python
yt-dlp
gallery-dl
FFmpeg
yt-dlp-ejs (jika tersedia)
```

Hasil disimpan ke:

```text
/storage/emulated/0/Download/YTConv
```

## Cara memakai

1. Jalankan `ytconv`.
2. Tempel link.
3. Tekan Enter atau pilih tombol `convert`.
4. YTConv memilih engine video/audio atau image/gallery berdasarkan link.

Link langsung:

```bash
ytconv "https://www.instagram.com/p/..."
```

## Gambar dan carousel

Mode otomatis mengenali banyak link gambar dan carousel dari Instagram, Pinterest, TikTok photo posts, X/Twitter, Facebook, Reddit Gallery, Tumblr, Imgur, Flickr, DeviantArt, Pixiv, Bluesky, dan situs lain yang didukung `gallery-dl`.

Paksa image/gallery engine:

```bash
ytconv --image "https://www.instagram.com/p/..."
ytconv --image "https://www.pinterest.com/pin/..."
```

Untuk satu posting carousel, semua item yang tersedia akan disimpan, bukan hanya gambar pertama.

## Instagram Reels, Stories, dan Highlights

Direct URL reel atau story dapat ditempel seperti link biasa:

```bash
ytconv "https://www.instagram.com/reel/..."
ytconv --cookies cookies.txt "https://www.instagram.com/stories/username/..."
```

Ambil story dari URL profil:

```bash
ytconv --stories --cookies cookies.txt "https://www.instagram.com/username/"
```

Ambil post, reels, stories, dan highlights dari profil:

```bash
ytconv --all-media --cookies cookies.txt "https://www.instagram.com/username/"
```

Story, highlights, akun privat, dan media login-only memerlukan cookies akun yang memang memiliki akses. YTConv tidak membuka akun privat yang tidak dapat dilihat oleh akun tersebut.

## Mode command line

```text
ytconv --auto LINK
ytconv --video LINK
ytconv --audio LINK
ytconv --image LINK
ytconv --stories --cookies cookies.txt PROFILE_URL
ytconv --all-media --cookies cookies.txt PROFILE_URL
ytconv --playlist LINK
ytconv --output PATH LINK
ytconv --cookies cookies.txt LINK
ytconv --diagnose
ytconv --check-update
ytconv --update
ytconv --version
```

`--auto` adalah perilaku default. `--video` memaksa yt-dlp dan tidak memakai gallery fallback. `--image` memaksa gallery-dl.

## Shortcut TUI

```text
Tab         pilih input / tombol convert
Enter       jalankan convert
Ctrl + G    ganti Video / Audio
Ctrl + Q    ganti kualitas
Ctrl + F    ganti MP3 / M4A saat mode Audio
Ctrl + B    ganti sumber cookies
Ctrl + P    aktif/nonaktifkan playlist
Ctrl + O    aktif/nonaktifkan auto-open
Ctrl + H    bantuan
Ctrl + D    diagnostics
Esc/Ctrl+C  batalkan dan keluar
O           buka folder hasil
F           buka file hasil
C           salin lokasi hasil
R           link lain / retry
E           edit link setelah error
```

Meskipun label TUI menampilkan mode video, link gambar/carousel pada mode default tetap dialihkan otomatis ke gallery engine. Gunakan `--video` hanya ketika ingin memaksa hasil video.

## Cookies

Tekan `Ctrl+B` untuk memilih sumber cookies.

Desktop:

```text
off → cookies.txt → Chrome → Edge → Firefox → Brave → Chromium → Opera → Vivaldi → Safari/Whale
```

File cookies harus memakai format Netscape. Lokasi khusus:

```cmd
ytconv --cookies C:\Users\Nama\Downloads\cookies.txt LINK
```

Termux tidak dapat membaca database aplikasi Chrome Android secara langsung. Gunakan:

```bash
ytconv --cookies "$HOME/storage/downloads/cookies.txt" LINK
```

Jangan pernah membagikan `cookies.txt`, karena file tersebut dapat berisi sesi login.

## Diagnostics

```bash
ytconv --diagnose
```

Diagnostics menampilkan:

- versi YTConv dan status update;
- Node.js dan platform;
- versi/runner yt-dlp;
- versi/runner gallery-dl;
- FFmpeg;
- folder output;
- cookies dan cakupan Instagram.

## Membuka hasil

Sesudah selesai:

- `O` membuka folder hasil.
- `F` membuka file terakhir.
- `C` menyalin lokasinya.
- `Ctrl+O` sebelum download mengaktifkan auto-open.

## Batasan nyata

Tidak ada downloader yang dapat menjamin setiap link selalu berhasil. Situs dapat mengganti API, meminta login, membatasi wilayah, menerapkan 429, menghapus posting, atau menambahkan DRM. YTConv melakukan retry dan fallback antarmesin, tetapi tidak menjanjikan akses ke media yang secara teknis atau hukum tidak tersedia.

## Menjalankan dari repository

```bash
git clone https://github.com/andhikamarcella/youtubetomp3.git
cd youtubetomp3
git checkout codex/add-ytconv-cli
cd cli
npm install
npm run check
npm test
npm start
```

## Publish

```bash
npm run check
npm test
npm pack --dry-run
npm publish
```

Setiap publikasi wajib memakai nomor versi yang belum pernah dipublikasikan.
