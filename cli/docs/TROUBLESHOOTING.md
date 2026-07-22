# Troubleshooting YTConv 1.2.0

## Mulai dari diagnostics

```bash
ytconv --version
ytconv --diagnose
```

Pastikan yt-dlp, gallery-dl, dan FFmpeg ditemukan.

## Update bersih npm

### Windows CMD

```cmd
npm uninstall -g ytconv
npm cache clean --force
npm install -g ytconv@1.2.0 --force
ytconv --version
```

### Termux

```bash
pkg update
pkg install -y nodejs python ffmpeg
python -m pip install -U yt-dlp gallery-dl
npm uninstall -g ytconv
npm install -g ytconv@1.2.0 --omit=optional
ytconv --diagnose
```

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
- sistem operasi
- platform/link yang sudah disensor bila privat
- log dari `--log-file`
- command yang dipakai tanpa isi cookies atau kredensial proxy
