# YTConv CLI 1.2.0

YTConv adalah downloader dan converter media sosial berbasis terminal yang memakai **yt-dlp**, **gallery-dl**, dan **FFmpeg**. Versi 1.2.0 adalah rilis pematangan: opsi lebih lengkap, preset siap pakai, pemeriksaan tanpa download, logging, dokumentasi rinci, serta validasi agar command aman dipakai di CMD Windows, Linux, macOS, Termux, dan frontend native iSH.

> Gunakan hanya untuk media milik sendiri, berlisensi bebas, atau yang memang diizinkan untuk diunduh. YTConv tidak melewati DRM, pembayaran, akun privat tanpa akses, atau pembatasan hak cipta.

## Yang didukung

- Video, audio, gambar, carousel, story, Reel, post campuran, dan playlist.
- MP3, M4A, AAC, OPUS, Vorbis, FLAC, ALAC, dan WAV.
- MP4, MKV, WEBM, resolusi sampai 2160p bila sumber tersedia.
- Thumbnail terpisah, cover tertanam, metadata, chapter, subtitle, description, dan `info.json`.
- Crop thumbnail persegi 1:1 khusus YouTube Music.
- Potong bagian tertentu, SponsorBlock, normalisasi audio, archive anti-duplikat, proxy, rate limit, dan output template.
- Fallback yt-dlp ↔ gallery-dl untuk link AUTO yang cocok.

## Instalasi

### Windows, Linux, macOS

Pasang Node.js 18 atau lebih baru:

```bash
npm install -g ytconv@1.2.0
ytconv --version
ytconv --diagnose
ytconv
```

Tanpa instalasi global:

```bash
npx -y ytconv@1.2.0
```

### Android Termux

Gunakan Termux dari F-Droid atau GitHub Releases:

```bash
pkg update
pkg install -y nodejs python ffmpeg
termux-setup-storage
npm install -g ytconv@1.2.0 --omit=optional
ytconv --diagnose
ytconv
```

Hasil default berada di:

```text
/storage/emulated/0/Download/YTConv
```

### iPhone/iPad melalui iSH

Jangan memasang paket npm di iSH. Gunakan frontend Python native:

```sh
wget -qO- https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/codex/add-ytconv-cli/cli/scripts/install-ish.sh | sh
```

Lalu:

```sh
ytconv --version
ytconv --diagnose
ytconv
```

Hasil dapat dibuka dari `Files → iSH → root → Downloads → YTConv`.

## Pemakaian cepat

```bash
ytconv "LINK"
ytconv --preset music "LINK"
ytconv --preset mobile "LINK"
ytconv --preset archive --playlist "LINK_PLAYLIST"
```

### Preset

| Preset | Fungsi |
|---|---|
| `balanced` | AUTO, kualitas terbaik, perilaku aman |
| `music` | MP3 320 kbps + thumbnail + cover + metadata |
| `lossless` | FLAC terbaik + thumbnail + metadata |
| `mobile` | MP4 720p yang ringan dan kompatibel |
| `hd` | MP4 1080p |
| `archive` | kualitas terbaik, MKV, subtitle, sidecar, thumbnail, archive |

Lihat dari terminal:

```bash
ytconv --list-presets
```

## Audio

```bash
ytconv --audio-format mp3 --audio-quality 320 "LINK"
ytconv --audio-format flac --thumbnail "LINK"
ytconv --audio-format alac "LINK"
ytconv --audio --normalize-audio "LINK"
ytconv --audio --keep-video "LINK"
```

MP3 selalu menyimpan thumbnail JPG dan menanamnya sebagai cover. YouTube Music mengubah gambar menjadi persegi 1:1 sebelum disimpan dan ditanam.

## Video dan subtitle

```bash
ytconv --video-format mp4 --resolution 1080 "LINK"
ytconv --video-format webm --resolution 720 "LINK"
ytconv --subtitles --subtitle-langs "id,en" "LINK"
```

Subtitle normal dan otomatis dicoba, dikonversi ke SRT, lalu ditanam bila container mendukungnya.

## SponsorBlock

```bash
ytconv --sponsorblock mark "LINK"
ytconv --sponsorblock remove "LINK"
ytconv --remove-sponsors "LINK"
```

SponsorBlock bergantung pada ketersediaan segmen untuk video tersebut. Pada situs non-YouTube biasanya tidak ada data SponsorBlock.

## Metadata, thumbnail, dan potong durasi

```bash
ytconv --metadata-files --thumbnail "LINK"
ytconv --start 01:00 --end 02:30 "LINK"
ytconv --write-info-json --write-description "LINK"
```

Waktu menerima detik, `MM:SS`, atau `HH:MM:SS`.

## Playlist dan anti-duplikat

```bash
ytconv --playlist "LINK_PLAYLIST"
ytconv --playlist-items "1,3,5-10" --playlist "LINK_PLAYLIST"
ytconv --max-downloads 25 --playlist "LINK_PLAYLIST"
ytconv --archive downloaded.txt --playlist "LINK_PLAYLIST"
```

## Jaringan dan performa

```bash
ytconv --rate-limit 2M "LINK"
ytconv --concurrent-fragments 8 "LINK"
ytconv --proxy socks5://127.0.0.1:1080 "LINK"
ytconv --live-from-start "LINK_LIVE"
```

Fragmen paralel dibatasi 1–16 agar pengguna tidak sengaja membebani perangkat atau koneksi.

## Nama dan lokasi file

```bash
ytconv -o "D:\Media\YTConv" "LINK"
ytconv --restrict-filenames "LINK"
ytconv --output-template "%(uploader)s/%(title)s [%(id)s].%(ext)s" "LINK"
ytconv --overwrite "LINK"
```

Template harus relatif, tidak boleh keluar dari folder output, dan wajib memuat `%(ext)s`.

## Pemeriksaan tanpa download

```bash
ytconv --dry-run "LINK"
ytconv --json "LINK"
ytconv --list-formats "LINK"
ytconv --list-subs "LINK"
```

`--json` menghasilkan schema stabil versi 1 untuk automasi. Mode ini melewati update check agar stdout tetap bersih.

## Logging

```bash
ytconv --log-file ytconv.log "LINK"
```

Log menyimpan waktu, status, engine, dan pesan error. File tidak menyimpan isi cookies.

## Cookies

```bash
ytconv --cookies cookies.txt "LINK"
```

File harus berformat Netscape. Jangan pernah membagikan `cookies.txt`, karena dapat berisi sesi login. Pada Termux dan iSH, database privat browser tidak dapat dibaca langsung; gunakan file cookies yang diekspor secara sah.

## Shortcut TUI

| Tombol | Fungsi |
|---|---|
| `Ctrl+M` | mode AUTO/VIDEO/AUDIO/IMAGE |
| `Ctrl+A` | format audio |
| `Ctrl+T` | container video |
| `Ctrl+Q` | resolusi video |
| `Ctrl+S` | subtitle |
| `Ctrl+N` | thumbnail terpisah |
| `Ctrl+F` | format gambar |
| `Ctrl+G` | platform/AUTO |
| `Ctrl+B` | sumber cookies |
| `Ctrl+P` | playlist |
| `Ctrl+O` | auto-open |
| `Ctrl+H` | bantuan |
| `Ctrl+D` | diagnostics |

## Dokumentasi lengkap

- [Semua command dan contoh](docs/COMMANDS.md)
- [Dukungan platform dan batasan](docs/PLATFORMS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Checklist rilis npm](docs/RELEASE.md)
- [Riwayat perubahan](CHANGELOG.md)

## Batasan nyata

Tidak ada downloader yang dapat menjamin setiap link selalu berhasil. Situs dapat mengganti API, meminta login, membatasi wilayah, menerapkan 429, menghapus posting, atau menambahkan DRM. YTConv melakukan retry, cookies fallback, dan fallback antarmesin, tetapi tidak menjanjikan akses ke media yang secara teknis atau hukum tidak tersedia.

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

## Lisensi

MIT. Engine pihak ketiga memiliki lisensinya masing-masing.
