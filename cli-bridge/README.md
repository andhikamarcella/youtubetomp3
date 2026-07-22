# YTConv CLI Bridge

Bridge ini membuat backend Render memakai `yt-dlp` dari laptop/PC yang IP-nya tidak terkena bot-check YouTube. Render tetap menjadi UI dan pemroses hasil; laptop hanya menjadi jalur unduhan cadangan saat server cloud menerima `BOT_CHECK` atau rate limit.

## Syarat di laptop

- Node.js 20 atau lebih baru
- `yt-dlp` tersedia di PATH
- `ffmpeg` tersedia di PATH untuk MP3 dan format hasil konversi lain
- Laptop memiliki koneksi yang memang berhasil saat menjalankan yt-dlp tanpa cookies

Bridge selalu menjalankan yt-dlp dengan `--no-config` dan tidak menerima cookies dari Render.

## Menjalankan bridge

Buat secret acak yang panjang dan sama pada laptop serta Environment Render.

### Windows PowerShell

```powershell
$env:YTCONV_BRIDGE_SECRET="ganti-dengan-secret-acak-minimal-24-karakter"
$env:PORT="4417"
node .\cli-bridge\server.mjs
```

### Linux/macOS

```bash
export YTCONV_BRIDGE_SECRET='ganti-dengan-secret-acak-minimal-24-karakter'
export PORT=4417
node ./cli-bridge/server.mjs
```

Secara default bridge hanya mendengarkan `127.0.0.1:4417`. Publikasikan port tersebut melalui tunnel HTTPS milikmu. Jangan membuka port bridge langsung ke internet tanpa HTTPS.

Cek lokal:

```text
http://127.0.0.1:4417/health
```

## Environment di Render

```env
YTDLP_CLI_BRIDGE_URL=https://alamat-tunnel-bridge.example
YTDLP_CLI_BRIDGE_SECRET=ganti-dengan-secret-yang-sama
YTDLP_CLI_BRIDGE_TIMEOUT_MS=900000
```

Lakukan deploy ulang menggunakan Dockerfile dari branch ini. Alurnya setelah aktif:

1. Render mencoba yt-dlp lokal di container tanpa cookies.
2. Deno, PO-token provider, dan client fallback tetap dicoba.
3. Hanya ketika log menunjukkan bot-check, 429, atau binary yt-dlp tidak tersedia, wrapper memanggil CLI bridge.
4. Bridge menjalankan yt-dlp tanpa cookies dari IP laptop, lalu mengirim file hasil kembali ke Render.
5. Render melanjutkan normalisasi, metadata, cover, dan penyajian tombol download seperti sebelumnya.

## Keamanan

- Endpoint download memerlukan Bearer secret.
- Hanya URL YouTube, YouTube Music, YouTube No-Cookie, `ytsearch`, dan `ytmsearch` yang diterima.
- Client tidak dapat mengirim argumen shell, path output, cookies, proxy, atau perintah eksekusi ke laptop.
- Maksimum job bersamaan default adalah 2. Ubah dengan `YTCONV_BRIDGE_MAX_CONCURRENT` bila diperlukan.
- Ganti secret segera bila alamat tunnel atau secret pernah tersebar.

## Environment opsional di laptop

```env
YTDLP_PATH=C:\path\to\yt-dlp.exe
YTCONV_BRIDGE_MAX_CONCURRENT=2
YTCONV_BRIDGE_JOB_TIMEOUT_MS=900000
YTCONV_BRIDGE_JS_RUNTIME=deno
```
