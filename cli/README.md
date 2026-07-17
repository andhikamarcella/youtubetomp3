# YTConv CLI

YTConv adalah aplikasi terminal hitam-putih untuk mengunduh dan mengonversi video/audio dari link media yang didukung `yt-dlp`. Tampilannya memakai satu kotak link, tombol `convert`, progress bar, speed, ETA, dukungan cookies, serta mode video dan audio.

> Gunakan hanya untuk media milik sendiri, media berlisensi bebas, atau media yang memang diizinkan untuk diunduh.

## Perangkat

- Windows x64/ARM64
- Linux x64/ARM64/ARM
- macOS Intel dan Apple Silicon
- Android melalui Termux

## Instalasi desktop

Pasang Node.js 18 atau lebih baru:

```bash
npm install -g ytconv
ytconv
```

Tanpa instalasi global:

```bash
npx -y ytconv@latest
```

YTConv menyiapkan `yt-dlp` dan FFmpeg sendiri. Binary `yt-dlp` diperiksa dan disegarkan berkala agar extractor situs tidak terlalu lama.

## Instalasi Termux

Gunakan Termux versi F-Droid atau GitHub Releases.

```bash
pkg update
pkg install -y nodejs
termux-setup-storage
npm install -g ytconv
ytconv
```

Atau:

```bash
npx -y ytconv@latest
```

Pemakaian pertama menampilkan progres pemasangan Python, `yt-dlp`, FFmpeg, dan `yt-dlp-ejs` bila tersedia. Hasil disimpan ke:

```text
/storage/emulated/0/Download/YTConv
```

## Update otomatis

YTConv memeriksa versi terbaru dari npm paling sering sekali setiap enam jam. Jika ada rilis baru, sebelum tampilan utama terbuka akan muncul pemberitahuan:

```text
Update YTConv tersedia: 0.5.5 → 0.5.6
U = update sekarang · Enter = lanjut memakai versi lama
```

Tekan `U` lalu Enter untuk memperbarui langsung. Perintah update juga dapat dijalankan kapan saja:

```bash
ytconv --check-update
ytconv --update
ytconv --version
```

Cara manual yang setara:

```bash
npm install -g ytconv@latest
```

Setelah update selesai, tutup terminal, buka terminal baru, lalu jalankan:

```bash
ytconv --version
ytconv
```

Pengecekan update dapat dimatikan untuk satu sesi:

```bash
ytconv --no-update-check
```

Atau:

```bash
YTCONV_NO_UPDATE_CHECK=1 ytconv
```

## Cara memakai

1. Jalankan `ytconv` atau `npx -y ytconv@latest`.
2. Tempel link media.
3. Klik/tap `convert`, atau tekan `Tab` lalu `Enter`.
4. Enter dari kotak link juga langsung memulai proses.

YTConv memakai alternate terminal screen. Aplikasi tetap berjalan di tab terminal yang sama dan tampilan TUI tidak memenuhi riwayat scrollback.

### Keluar

- `Esc`
- `Ctrl+C`
- Tekan `q` saat tombol/status dipilih
- Ketik `exit`, `quit`, atau `:q` pada kotak link lalu Enter

Setelah YTConv ditutup, terminal kembali ke tampilan sebelumnya.

### Shortcut

```text
Tab         pilih input / tombol convert
Enter       jalankan convert
Ctrl + G    ganti Video / Audio
Ctrl + Q    ganti kualitas
Ctrl + F    ganti MP3 / M4A saat mode Audio
Ctrl + B    ganti sumber cookies
Ctrl + P    aktif/nonaktifkan playlist
Ctrl + O    aktif/nonaktifkan auto-open setelah selesai
Ctrl + H    buka bantuan shortcut
Ctrl + D    buka diagnostics
Esc/Ctrl+C  batalkan dan keluar
O           buka folder hasil
F           buka file hasil
C           salin lokasi hasil
R           convert link lain / retry
E           edit link setelah error
```

## Membuka hasil

Setelah conversion selesai:

- `O` membuka folder hasil.
- `F` membuka file dengan aplikasi default.
- `C` menyalin lokasi file/folder ke clipboard.
- `Ctrl+O` sebelum convert mengaktifkan auto-open.

Windows mencoba memilih file langsung di Explorer lalu memakai beberapa fallback. Linux memakai `xdg-open`/GIO, macOS memakai Finder, dan Termux mencoba Android DocumentsUI serta `termux-open`. Jika file manager tidak bisa dibuka, YTConv tetap menyalin lokasi folder agar dapat ditempel secara manual.

## Command-line tambahan

```text
ytconv --help
ytconv --version
ytconv --diagnose
ytconv --check-update
ytconv --update
ytconv --no-update-check
ytconv --audio LINK
ytconv --video LINK
ytconv --playlist LINK
ytconv --output PATH LINK
ytconv --cookies cookies.txt LINK
```

Contoh Windows:

```cmd
ytconv --audio --output D:\Music "https://www.youtube.com/watch?v=..."
```

Contoh Termux:

```bash
ytconv --audio --output "$HOME/storage/downloads/Music" "https://..."
```

`ytconv --diagnose` menampilkan versi Node.js, status update, yt-dlp, FFmpeg, runner yang digunakan, folder output, serta status cookies.

## Cookies dan media login

Tekan `Ctrl+B` untuk mengganti sumber cookies.

### Windows, Linux, macOS

Sumber yang tersedia:

```text
off → cookies.txt → Chrome → Edge → Firefox → Brave → Chromium → Opera → Vivaldi → Safari/Whale
```

Tutup browser sepenuhnya apabila pembacaan cookies browser gagal. Alternatif paling portabel adalah file Netscape `cookies.txt`.

YTConv otomatis mencari `cookies.txt` di:

- folder tempat command dijalankan
- folder hasil YTConv
- folder Downloads
- home directory

Lokasi khusus juga bisa diberikan:

```cmd
ytconv --cookies C:\Users\Nama\Downloads\cookies.txt
```

Profil browser khusus:

```cmd
set YTCONV_BROWSER_PROFILE=Default
ytconv
```

### Termux

Android tidak mengizinkan Termux membaca database cookies aplikasi Chrome/Firefox secara langsung. Gunakan file Netscape:

```text
/storage/emulated/0/Download/YTConv/cookies.txt
```

atau:

```bash
ytconv --cookies "$HOME/storage/downloads/cookies.txt"
```

Tekan `Ctrl+B` sampai status menunjukkan `cookies:cookies.txt`.

Jangan membagikan `cookies.txt`; file tersebut dapat berisi sesi login akun.

## Dukungan situs

YTConv meneruskan URL secara generik ke extractor `yt-dlp`, mengaktifkan Node sebagai JavaScript runtime, komponen EJS resmi, pengecekan format, retry jaringan, serta fallback container MP4/MKV. Ini mencakup banyak link video/audio dari layanan seperti:

```text
YouTube, Instagram, TikTok, X/Twitter, Facebook, Pinterest,
Reddit, Twitch, Vimeo, SoundCloud, Dailymotion, Bilibili,
Tumblr, Snapchat, LinkedIn, Telegram embeds, Weibo, VK,
Streamable, Rumble, Kick, Bandcamp, Mixcloud, Imgur, 9GAG,
dan situs lain yang didukung extractor atau generic extractor.
```

Tidak ada downloader yang dapat menjamin semua link selalu berhasil. Situs dapat berubah, posting dapat dihapus, wilayah dapat dibatasi, dan beberapa link membutuhkan cookies. YTConv tidak melewati DRM, pembayaran, atau akses privat yang tidak dimiliki pengguna. Pinterest/Instagram yang hanya berisi gambar bukan video/audio tidak dikonversi sebagai video.

## Link langsung

```bash
ytconv "https://www.youtube.com/watch?v=..."
```

## Folder hasil khusus

```cmd
ytconv --output D:\Video\YTConv
```

```bash
ytconv --output "$HOME/MyDownloads"
```

Environment variable lama tetap didukung:

```text
YTCONV_OUTPUT
YTCONV_COOKIES
YTCONV_BROWSER_PROFILE
YTCONV_NO_UPDATE_CHECK
```

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

Setiap publikasi harus memakai nomor versi yang belum pernah dipublikasikan.
