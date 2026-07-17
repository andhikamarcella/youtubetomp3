# YTConv CLI

YTConv adalah aplikasi terminal hitam-putih untuk mengubah satu link media menjadi video MP4 atau audio MP3/M4A. Antarmukanya memakai satu kotak link, tombol `convert`, progress bar, speed, ETA, dan status proses.

> Gunakan hanya untuk media milik sendiri, media berlisensi bebas, atau media yang memang diizinkan untuk diunduh.

## Dukungan perangkat

- Windows x64/ARM64
- Linux x64/ARM64/ARM
- macOS Intel dan Apple Silicon
- Android melalui Termux

YTConv meneruskan link ke extractor `yt-dlp`, sehingga dapat mencoba YouTube, TikTok, Instagram, X/Twitter, Facebook, Reddit, Twitch, SoundCloud, Vimeo, Dailymotion, Bilibili, Pinterest, Tumblr, Streamable, Rumble, Kick, Bandcamp, Mixcloud, dan banyak situs lainnya.

Konten privat, login-only, berbayar, DRM, dibatasi wilayah, atau situs yang berubah dapat gagal.

## Instalasi desktop

Pasang Node.js 18 atau lebih baru, lalu:

```bash
npm install -g ytconv
```

Jalankan:

```bash
ytconv
```

atau:

```bash
npx ytconv
```

Pada Windows, Linux desktop, dan macOS, instalasi npm menyiapkan `yt-dlp` dan FFmpeg yang dibutuhkan YTConv.

## Instalasi Android dengan Termux

Gunakan Termux dari F-Droid atau GitHub Releases, bukan build Play Store lama.

Pertama kali saja:

```bash
pkg update
pkg install -y nodejs
termux-setup-storage
```

Setujui izin penyimpanan Android, lalu pasang YTConv:

```bash
npm install -g ytconv
```

Jalankan:

```bash
ytconv
```

atau:

```bash
npx -y ytconv
```

Pada pemakaian pertama, YTConv menampilkan proses setup secara langsung lalu memasang alat Android yang diperlukan:

- `python-yt-dlp`
- `ffmpeg`
- `yt-dlp-ejs` bila tersedia

Setup Termux sengaja dijalankan saat aplikasi pertama kali dibuka, bukan diam-diam saat `npm install`, supaya pengguna tetap melihat progres dan pesan error. Bila paket `python-yt-dlp` tidak tersedia dari mirror, YTConv mencoba fallback Python dan pip.

Hasil Termux disimpan ke:

```text
/storage/emulated/0/Download/YTConv
```

melalui shortcut Termux:

```text
~/storage/downloads/YTConv
```

## Tombol convert

Tombol `convert` di sebelah input dapat digunakan dengan beberapa cara:

- Klik dengan mouse pada Windows Terminal atau terminal lain yang mengirim mouse events.
- Tap pada Termux yang mendukung terminal mouse reporting.
- Tekan `Tab` untuk memilih tombol, kemudian `Enter` atau `Space`.
- Tekan `Enter` langsung saat kursor masih berada di kotak link.

YTConv mengaktifkan SGR mouse reporting saat aplikasi berjalan. Beberapa host terminal lama mungkin tetap mengambil klik untuk memilih teks; pada kondisi tersebut gunakan `Tab` + `Enter` sebagai fallback.

## Cara memakai

1. Jalankan `ytconv` atau `npx -y ytconv`.
2. Tempel link.
3. Klik/tap `convert`, atau tekan Enter.
4. Hasil tersimpan di folder Downloads.

Shortcut:

```text
Enter       convert dari input / jalankan tombol terpilih
Space       jalankan tombol convert saat terpilih
Tab         pilih input atau tombol convert
Ctrl + G    ganti Video / Audio
Ctrl + Q    ganti kualitas
Ctrl + F    ganti MP3 / M4A saat mode Audio
Ctrl + B    ganti browser cookies
Ctrl + P    aktif/nonaktifkan playlist
Ctrl + C    batalkan atau keluar
O           buka folder hasil
R           convert link lain
E           edit link setelah error
```

Link juga bisa diberikan langsung:

```bash
ytconv "https://www.youtube.com/watch?v=..."
```

## Jika Termux berhenti setelah prompt npx

Gunakan bentuk berikut agar prompt pemasangan dilewati:

```bash
npx -y ytconv
```

Kalau alat Android belum berhasil dipasang:

```bash
pkg install -y python-yt-dlp ffmpeg
pkg install -y yt-dlp-ejs
npx -y ytconv
```

## Folder hasil khusus

Gunakan environment variable `YTCONV_OUTPUT`:

### Windows CMD

```cmd
set YTCONV_OUTPUT=D:\Video\YTConv
ytconv
```

### Linux, macOS, atau Termux

```bash
YTCONV_OUTPUT="$HOME/MyDownloads" ytconv
```

## Menjalankan dari repository

```bash
git clone https://github.com/andhikamarcella/youtubetomp3.git
cd youtubetomp3
git checkout codex/add-ytconv-cli
cd cli
npm install
npm start
```

Membuat command lokal:

```bash
npm link
ytconv
```

## Pemeriksaan sebelum publish

```bash
npm run check
npm pack --dry-run
npm publish
```

Setelah berhasil diterbitkan:

```bash
npm install -g ytconv
npx -y ytconv
```

## Catatan keamanan akun npm

Publikasi npm memerlukan 2FA atau granular access token yang diizinkan untuk publishing. Jangan simpan token npm di repository atau membagikannya melalui screenshot.
