# Referensi command YTConv 1.5.0 Beta

Versi npm: `1.5.0-beta.1`

## Default beta

Tiga fitur aktif tanpa perlu opsi tambahan:

```text
subtitle       ON untuk video
SponsorBlock   ON mode mark
archive        ON per profil
```

Mode SponsorBlock `mark` menambahkan chapter/penanda dan tidak memotong media.

Opt-out:

```text
--no-subtitles, --subtitles-off
--no-sponsorblock, --sponsorblock-off
--no-archive
```

Archive otomatis berada di `~/.ytconv/archives`. yt-dlp memakai file teks, sedangkan gallery-dl memakai database archive terpisah.

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
| `doctor` | Diagnosis sistem dan default beta |
| `repair`, `setup` | Perbaiki dependency |
| `clean` | Bersihkan cache update/error; archive tidak dihapus |
| `update` | Update melalui npm channel beta |

## Preset

```text
--preset balanced|music|lossless|mobile|hd|archive
--list-presets
```

Opsi eksplisit dan opt-out mengalahkan preset.

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

Mode paksa tidak diam-diam diganti fallback. AUTO dapat mencoba yt-dlp dan gallery-dl.

## Playlist, batch, dan archive

```text
--playlist
--playlist-items "1,3,5-10"
--playlist-items "1:20:2"
--max-downloads 25
--skip-playlist-after-errors 5
--archive downloaded.txt
--no-archive
--batch-file links.txt
--stdin
--jobs 1..8
--continue-on-error
--result-json report.json
```

Archive aktif otomatis. `--archive downloaded.txt` memakai file tersebut untuk yt-dlp dan membuat pasangan `downloaded.txt.gallery.sqlite3` untuk gallery-dl. `--no-archive` mematikan keduanya pada satu proses.

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

MP3 320 kbps adalah target encoder, bukan bukti bahwa sumber mempunyai kualitas 320 kbps.

Subtitle default tidak diterapkan pada hasil audio-only, tetapi SponsorBlock mark dan archive tetap dapat dipakai oleh engine bila sesuai.

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

JSON info memakai `schemaVersion: 2`. Format dapat memuat ID, container, jenis, resolusi, FPS, codec, bitrate, ukuran perkiraan, protokol, dan `source: original`.

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

Metadata otomatis dan URL sumber ditanam pada format yang mendukung. MP3 mencoba embedded cover dan thumbnail JPG terpisah. WAV tidak memakai embedded cover melalui jalur ini.

## Subtitle

Default: **aktif untuk video**.

```text
--subtitles
--no-subtitles
--subtitles-off
--subtitle-only
--subtitle-langs "id,en"
--list-subs
```

YTConv mencoba subtitle manual dan otomatis, mengubah ke SRT, lalu embed bila media ikut diunduh dan container mendukung. Tidak semua video mempunyai subtitle; ketiadaan subtitle tidak seharusnya menggagalkan media utama.

## Potong durasi

```text
--start 01:20
--end 03:45
--from 01:20
--to 03:45
```

Waktu menerima detik, `MM:SS`, atau `HH:MM:SS`. Titik potong dapat sedikit bergeser karena keyframe/codec.

## SponsorBlock

Default: **`mark`**.

```text
--sponsorblock off|mark|remove
--sponsorblock-mode off|mark|remove
--no-sponsorblock
--sponsorblock-off
--remove-sponsors
--sponsorblock-categories "sponsor,selfpromo"
```

`mark` menambahkan chapter/penanda. `remove` memotong segmen secara eksplisit. SponsorBlock terutama tersedia untuk YouTube dan tidak memiliki data untuk semua video/situs.

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

`--jobs` mengontrol jumlah link batch yang diproses bersamaan. `--concurrent-fragments` mengontrol fragmen satu media.

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

Pada prerelease ini, `--check-update` dan `--update` menggunakan dist-tag npm `beta`. `--clear-cache` tidak menghapus archive download.

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

## Contoh beta

```bash
ytconv download "LINK"
ytconv download "LINK" --subtitle-langs "id,en"
ytconv download "LINK" --sponsorblock remove
ytconv download "LINK" --no-subtitles --no-sponsorblock --no-archive
ytconv playlist "LINK" --playlist-items "1-10"
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
ytconv doctor
```
