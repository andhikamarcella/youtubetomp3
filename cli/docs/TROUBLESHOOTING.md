# Troubleshooting YTConv 1.2.1

## Mulai dari diagnostics

```bash
ytconv --version
ytconv --diagnose
```

Pastikan yt-dlp, gallery-dl, dan FFmpeg ditemukan.

## `spawnSync npm.cmd EINVAL` saat update Windows

Error ini berasal dari updater lama yang mencoba menjalankan `npm.cmd` secara langsung. Instalasi global 1.1.5 atau 1.2.0 yang sudah mengalami error tersebut tidak dapat memperbaiki dirinya sendiri.

Dari CMD jalankan:

```cmd
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@1.2.1 --force
where ytconv
ytconv --version
```

Versi harus menampilkan `1.2.1`. YTConv 1.2.1 menjalankan npm melalui `cmd.exe`, sehingga tidak lagi memakai pemanggilan `npm.cmd` yang menghasilkan `EINVAL`.

Untuk menguji branch GitHub sebelum 1.2.1 dipublikasikan:

```cmd
cd C:\Users\andhi\youtubetomp3
git switch codex/add-ytconv-cli
git pull --ff-only origin codex/add-ytconv-cli
cd cli
npm install
npm run check
npm test
npm install -g . --force
ytconv --version
```

Perintah `node .\bin\ytconv.js --version` menguji kode lokal. Perintah `ytconv --version` menguji instalasi global.

## Update bersih npm

### Windows CMD

```cmd
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@1.2.1 --force
ytconv --version
```

### Termux

```bash
pkg update
pkg install -y nodejs python ffmpeg
python -m pip install -U yt-dlp gallery-dl
npm uninstall -g ytconv
npm install -g ytconv@1.2.1 --omit=optional
ytconv --diagnose
```

Frontend native iSH tetap 1.2.0 karena hotfix 1.2.1 hanya memperbaiki self-update npm pada Windows.

## Link gagal tetapi bisa dibuka di browser

1. Coba tanpa cookies.
2. Coba `--cookies cookies.txt` dengan format Netscape.
3. Tutup browser bila memakai pembacaan cookies desktop.
4. Update YTConv/yt-dlp/gallery-dl.
5. Simpan log:

```bash
ytconv --log-file ytconv.log "LINK"
```

## HTTP 429 / terlalu banyak permintaan

Tunggu beberapa menit, kurangi fragmen, dan beri rate limit:

```bash
ytconv --concurrent-fragments 1 --rate-limit 1M "LINK"
```

Jangan melakukan retry agresif terus-menerus.

## Requested format is not available

Lihat format sumber:

```bash
ytconv --list-formats "LINK"
```

Turunkan resolusi atau gunakan container AUTO/MKV.

## Subtitle tidak muncul

```bash
ytconv --list-subs "LINK"
ytconv --subtitles --subtitle-langs "id,en" "LINK"
```

Tidak semua video memiliki subtitle. Sebagian container/player juga tidak menampilkan embedded subtitle secara default.

## Thumbnail/cover gagal

Pastikan FFmpeg tersedia. WAV tidak mendapat embedded thumbnail. Thumbnail terpisah tetap dapat diminta dengan `--thumbnail`.

## YouTube Music cover tidak persegi

Pastikan URL berasal dari `music.youtube.com`, bukan `youtube.com`, dan FFmpeg terdeteksi oleh `--diagnose`.

## SponsorBlock tidak mengubah video

Data segmen mungkin tidak tersedia. Coba mode mark untuk melihat chapter:

```bash
ytconv --sponsorblock mark "LINK"
```

## Potongan tidak tepat satu frame

Pemotongan bergantung pada keyframe dan codec. YTConv meminta keyframe pada titik potong, tetapi sumber tertentu tetap dapat bergeser sedikit.

## Proxy gagal

Gunakan URL lengkap:

```text
http://host:port
socks5://host:port
```

Jangan menaruh password proxy dalam screenshot atau log publik.

## Nama file terlalu panjang/aneh

```bash
ytconv --restrict-filenames --output-template "%(id)s.%(ext)s" "LINK"
```

## Data lama tidak boleh tertimpa

Default YTConv tidak menimpa hasil. Gunakan `--overwrite` hanya ketika benar-benar diperlukan.

## Melaporkan bug

Sertakan:

- `ytconv --version`
- keluaran `ytconv --diagnose`
- hasil `where ytconv` pada Windows
- sistem operasi
- platform/link yang sudah disensor bila privat
- log dari `--log-file`
- command yang dipakai tanpa isi cookies atau kredensial proxy
