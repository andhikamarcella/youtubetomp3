# YTConv CLI

YTConv CLI adalah aplikasi terminal interaktif berbasis Node.js untuk menjalankan `yt-dlp` dan FFmpeg tanpa harus menghafal command panjang.

> Gunakan hanya untuk media milik sendiri atau media yang memang diizinkan untuk diunduh.

## Fitur

- Tampilan terminal dengan logo YTConv.
- Download audio MP3/M4A atau video MP4.
- Pilihan kualitas audio dan resolusi video.
- Progress download, kecepatan, dan ETA.
- Dukungan cookies dari Chrome, Edge, atau Firefox.
- Bisa digunakan di Windows, Linux, dan macOS.
- Nama file aman untuk Windows.

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

Tutup PowerShell, buka kembali, lalu cek:

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

## Menjalankan dari repository

Dari folder utama repository:

```bash
cd cli
npm install
npm start
```

## Membuat command `ytconv` di komputer sendiri

```bash
cd cli
npm install
npm link
```

Setelah itu YTConv dapat dijalankan dari folder mana pun:

```bash
ytconv
```

Untuk melepas command lokal:

```bash
npm unlink -g ytconv
```

## Menjalankan melalui npm setelah dipublikasikan

Tanpa instalasi global:

```bash
npx ytconv
```

Dengan instalasi global:

```bash
npm install -g ytconv
ytconv
```

`npx ytconv` baru bisa digunakan publik setelah paket berhasil diterbitkan ke registry npm.

## Cara menerbitkan ke npm

1. Buat akun di npm dan verifikasi email.
2. Pastikan nama paket pada `package.json` masih tersedia.
3. Login dari terminal:

```bash
npm login
```

4. Periksa isi paket yang akan diterbitkan:

```bash
cd cli
npm pack --dry-run
```

5. Jalankan pemeriksaan syntax:

```bash
npm run check
```

6. Terbitkan paket:

```bash
npm publish --access public
```

7. Uji dari folder lain:

```bash
npx ytconv
```

Untuk versi berikutnya, ubah nomor versi terlebih dahulu:

```bash
npm version patch
npm publish --access public
```

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
├── package.json
└── README.md
```

## Masalah umum

### `yt-dlp` atau `ffmpeg` tidak ditemukan

Pastikan keduanya dapat dijalankan langsung dari terminal. Setelah instalasi, tutup dan buka kembali terminal agar PATH diperbarui.

### YouTube meminta login

Jalankan YTConv dan pilih cookies dari browser yang sedang digunakan. Tutup browser terlebih dahulu apabila pembacaan cookies gagal.

### Nama `ytconv` sudah dipakai di npm

Gunakan nama paket scoped tanpa mengubah nama command:

```json
{
  "name": "@andhikamarcella/ytconv",
  "bin": {
    "ytconv": "./bin/ytconv.js"
  }
}
```

Paket scoped dapat dijalankan dengan:

```bash
npx @andhikamarcella/ytconv
```

Setelah instalasi global, command-nya tetap:

```bash
npm install -g @andhikamarcella/ytconv
ytconv
```
