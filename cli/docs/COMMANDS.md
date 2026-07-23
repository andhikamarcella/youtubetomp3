# Referensi command YTConv 1.3.0

## Bentuk command

```text
ytconv download LINK [OPSI]
ytconv playlist LINK [OPSI]
ytconv batch FILE [OPSI]
ytconv info LINK [--json]
ytconv formats LINK [--json]
ytconv subtitles LINK
ytconv doctor
ytconv repair
ytconv clean
```

Sintaks kompatibel lama tetap tersedia:

```text
ytconv [LINK] [OPSI]
```

## Command utama

| Command | Fungsi |
|---|---|
| `download`, `dl`, `get` | Download satu link |
| `playlist`, `pl` | Aktifkan playlist/kumpulan post |
| `batch FILE` | Baca link per baris dan lanjut bila satu gagal |
| `info`, `inspect` | Metadata, format sumber, dan rencana output |
| `formats` | Daftar format original |
| `formats LINK --json` | Format original sebagai JSON |
| `subtitles`, `subs` | Daftar subtitle |
| `doctor` | Diagnosis sistem |
| `repair`, `setup` | Perbaiki dependency |
| `clean` | Bersihkan cache YTConv |
| `update` | Update paket |

## Preset

```text
--preset balanced|music|lossless|mobile|hd|archive
--list-presets
```

Opsi eksplisit mengalahkan preset.

## Mode

```text
--auto
--video
--audio
--image, --images, --gallery
--stories
--all-media
--platform PLATFORM
```

Mode paksa tidak diam-diam diganti fallback. AUTO dapat mencoba yt-dlp lalu gallery-dl atau sebaliknya.

## Playlist dan batch

```text
--playlist
--playlist-items "1,3,5-10"
--playlist-items "1:20:2"
--max-downloads 25
--skip-playlist-after-errors 5
--archive downloaded.txt
--batch-file links.txt
--stdin
--jobs 1..8
--continue-on-error
--result-json report.json
```

`batch FILE` otomatis menambahkan `--continue-on-error`. URL duplikat, komentar `#`, dan baris kosong diabaikan.

## Retry, resume, dan cleanup

```text
--retries 20
--retries infinite
--fragment-retries 30
--file-access-retries 5
--retry-sleep "linear=1:10:2"
--retry-sleep "exp=1:20:2"
--resume
--no-resume
--cleanup-part
```

Resume aktif secara default. Cleanup hanya menghapus file sementara baru dari proses yang gagal. Saat `--jobs > 1`, cleanup part dinonaktifkan untuk mencegah worker menghapus file worker lain.

## Audio

```text
--format mp3
--quality 192
--audio
--audio-format mp3|m4a|aac|opus|vorbis|flac|alac|wav
--audio-quality best|320|256|192|128|96
--bitrate RATE
--normalize-audio
--keep-video
```

`--format` dan `--quality` adalah alias sederhana. MP3 320 kbps adalah target encoder, bukan bukti bahwa sumber mempunyai kualitas 320 kbps.

## Video

```text
--format mp4
--quality 1080p
--video
--video-format auto|mp4|mkv|webm
--container FMT
--resolution best|2160|1440|1080|720|480|360|240|144
```

Resolusi adalah batas maksimum; format sebenarnya bergantung pada sumber.

## Format sumber dan JSON

```text
ytconv info LINK
ytconv info LINK --json
ytconv formats LINK
ytconv formats LINK --json
--dry-run
--json
--list-formats
--formats-json
```

JSON info memakai schemaVersion 2. Format memuat ID, container, jenis, resolusi, FPS, codec, bitrate, ukuran perkiraan, protokol, dan `source: original` bila data tersedia.

## Metadata dan cover

```text
--metadata
--thumbnail
--metadata-files
--write-info-json
--write-description
--artist "Nama Artis"
--title "Judul Lagu"
--album "Nama Album"
--track 3
--year 2026
--genre Pop
```

Metadata otomatis dan URL sumber ditanam pada format yang mendukung. MP3 selalu mencoba cover tertanam dan thumbnail JPG terpisah. WAV tidak mendukung embedded cover melalui jalur ini.

## Subtitle

```text
--subtitles
--subtitle-only
--subtitle-langs "id,en"
--list-subs
```

YTConv mencoba subtitle manual dan otomatis, mengubah ke SRT, lalu embed bila media ikut diunduh dan container mendukung.

## Potong durasi

```text
--start 01:20
--end 03:45
--from 01:20
--to 03:45
```

Waktu menerima detik, `MM:SS`, atau `HH:MM:SS`. Titik potong dapat sedikit bergeser karena keyframe/codec.

## SponsorBlock

```text
--sponsorblock off|mark|remove
--sponsorblock-mode off|mark|remove
--remove-sponsors
--sponsorblock-categories "sponsor,selfpromo"
```

Data SponsorBlock tidak tersedia untuk semua video/situs.

## Cookies dan autentikasi

```text
--cookies cookies.txt
--cookies-from-browser chrome
--cookies-from-browser "chrome:Default"
--cookies-from-browser "firefox:default-release"
--cookies-from-browser edge
--cookies-from-browser brave
```

Browser desktop yang dikenali: Chrome, Chromium, Edge, Firefox, Brave, Opera, Vivaldi, Safari, dan Whale. Termux/iSH tidak dapat membaca database privat browser ponsel secara langsung.

## Jaringan dan performa

```text
--rate-limit 500K
--rate-limit 2M
--concurrent-fragments 1..16
--proxy http://host:port
--proxy socks5://host:port
--live-from-start
```

`--jobs` mengontrol jumlah link batch yang diproses bersamaan. `--concurrent-fragments` mengontrol fragmen satu media. Keduanya berbeda dan sebaiknya tidak dinaikkan berlebihan.

## File

```text
-o, --output PATH
--output-template "%(uploader)s/%(title)s [%(id)s].%(ext)s"
--restrict-filenames
--overwrite
--log-file FILE
--open-output
```

Template wajib relatif, tidak boleh mengandung segmen `..`, dan wajib memuat `%(ext)s`.

## Sistem

```text
--doctor, --diagnose
--repair, --setup
--shell-info, --where
--self-test
--clear-cache
--check-update
--update
--no-update-check
--examples
--headless, --non-interactive
--no-color
-y, --yes
-h, --help
-v, --version
```

## Exit code

| Kode | Makna |
|---:|---|
| 0 | Berhasil |
| 1 | Download/proses gagal |
| 2 | URL atau opsi tidak valid |
| 3 | Dependency belum tersedia |
| 4 | Login/cookies diperlukan |
| 5 | Gangguan sementara: jaringan, proxy, timeout, DNS, sertifikat, atau HTTP 429 |
| 130 | Dibatalkan |

## Contoh

```sh
ytconv playlist "LINK" --playlist-items "1-10" --archive downloaded.txt
ytconv batch links.txt --jobs 2 --result-json report.json
ytconv download "LINK" --format mp3 --quality 192 --thumbnail
ytconv download "LINK" --artist "Artis" --title "Judul"
ytconv download "LINK" --cookies-from-browser chrome
ytconv download "LINK" --subtitle-only --subtitle-langs "id,en"
ytconv info "LINK" --json
```
