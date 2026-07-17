# YTConv CLI 1.0.1

YTConv adalah aplikasi terminal hitam-putih untuk mengunduh media dari link sosial. Satu command dapat menangani video, audio, gambar tunggal, carousel, reels, story, highlights, dan posting campuran selama link tersebut didukung oleh engine yang digunakan.

> Gunakan hanya untuk media milik sendiri, media berlisensi bebas, atau media yang memang diizinkan untuk diunduh. YTConv tidak melewati DRM, pembayaran, akun privat yang tidak dapat kamu akses, atau pembatasan hak cipta.

## Engine bawaan

YTConv memakai tiga alat:

- `yt-dlp` untuk video dan audio.
- `gallery-dl` untuk gambar, carousel, reels/story tertentu, posting campuran, dan situs galeri.
- FFmpeg untuk merge dan konversi video/audio.

Pada Windows dan Linux, YTConv mencoba menyiapkan executable `yt-dlp`, `gallery-dl`, dan FFmpeg saat instalasi. Pada Termux, YTConv menyiapkan modul Python yang kompatibel dengan Android saat pemakaian pertama. Pada iSH/iOS, YTConv memakai frontend Python native agar tidak bergantung pada Node/npm lama bawaan iSH.

## Perangkat

- Windows x64/ARM64
- Linux x64/ARM64/ARM
- macOS Intel dan Apple Silicon
- Android melalui Termux
- iPhone/iPad melalui iSH native mode

Catatan macOS: `yt-dlp` dan FFmpeg tetap otomatis. Bila executable `gallery-dl` tidak tersedia, YTConv mencoba modul Python. Pada perangkat macOS tanpa Python 3, image/gallery mode memerlukan Python 3 terlebih dahulu.

## Instalasi desktop dan Termux

Pasang Node.js 18 atau lebih baru, lalu:

```bash
npm install -g ytconv
ytconv
```

Tanpa instalasi global:

```bash
npx -y ytconv@latest
```

## Instalasi iSH di iPhone/iPad

**Jangan memakai `npm install -g ytconv` di iSH.** iSH App Store umumnya memakai Alpine x86 lama; contoh Node `14.21.3` dan npm `7.17.0` tidak memenuhi kebutuhan TUI Node modern dan dapat menghasilkan `EBADENGINE`, `TAR_ENTRY_INVALID`, atau `ENOTEMPTY`.

Di iSH jalankan installer native berikut:

```sh
wget -qO- https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/codex/add-ytconv-cli/cli/scripts/install-ish.sh | sh
```

Installer akan:

- menghapus sisa instalasi npm YTConv yang rusak;
- memasang `python3`, `py3-pip`, `ffmpeg`, `curl`, dan sertifikat Alpine;
- memasang `yt-dlp` dan `gallery-dl` versi yang kompatibel dengan Python iSH;
- membuat command `/usr/local/bin/ytconv`;
- membuat folder hasil `~/Downloads/YTConv`.

Setelah selesai:

```sh
ytconv --version
ytconv --diagnose
ytconv
```

Hasil dapat dibuka melalui:

```text
Files → iSH → root → Downloads → YTConv
```

Update frontend iSH:

```sh
ytconv --check-update
ytconv --update
```

atau jalankan ulang installer yang sama.

### Batasan iSH yang perlu diketahui

- iSH adalah emulasi Linux x86 di iOS, bukan terminal native seperti Termux.
- Python iSH lama mungkin masih 3.9, sedangkan yt-dlp terbaru resmi membutuhkan Python 3.10+. pip akan memilih rilis yt-dlp terakhir yang kompatibel, sehingga sebagian situs terbaru dapat gagal.
- iOS dapat menghentikan iSH ketika aplikasi berada lama di background.
- Kecepatan convert dan FFmpeg lebih lambat dibanding Windows, Linux, macOS, atau Termux.
- Cookies browser Safari tidak dapat dibaca langsung. Gunakan file Netscape `cookies.txt`.

## Update wajib

Mulai YTConv `1.0.0`, aplikasi memeriksa versi terbaru. Bila versi baru tersedia, YTConv memperbarui dirinya sebelum membuka converter.

Desktop/Termux:

```bash
ytconv --check-update
ytconv --update
npm install -g ytconv@latest
```

iSH native:

```sh
ytconv --check-update
ytconv --update
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

- `0.5.6` dan versi sesudahnya memiliki update checker dan akan melihat versi terbaru setelah diterbitkan.
- `0.5.5` atau lebih lama tidak memiliki kode update checker dan perlu satu kali update manual:

```bash
npm install -g ytconv@latest
```

- Pengguna iSH yang pernah mencoba npm harus menjalankan installer native satu kali; installer membersihkan folder npm YTConv yang gagal.

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
3. Tekan Enter atau pilih tombol `convert` pada TUI Node.
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

## Shortcut TUI desktop/Termux

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

Frontend iSH sengaja memakai prompt sederhana tanpa Ink agar stabil pada Node lama dan emulasi x86.

## Cookies

File cookies harus memakai format Netscape.

Desktop:

```text
off → cookies.txt → Chrome → Edge → Firefox → Brave → Chromium → Opera → Vivaldi → Safari/Whale
```

Termux:

```bash
ytconv --cookies "$HOME/storage/downloads/cookies.txt" LINK
```

iSH:

```sh
ytconv --cookies "$HOME/Downloads/cookies.txt" LINK
```

Jangan pernah membagikan `cookies.txt`, karena file tersebut dapat berisi sesi login.

## Diagnostics

```bash
ytconv --diagnose
```

Diagnostics menampilkan versi YTConv, status update, platform, yt-dlp, gallery-dl, FFmpeg, folder output, dan ketersediaan cookies/engine.

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
