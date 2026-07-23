# Referensi command YTConv 1.2.3

## Dasar

```text
ytconv [LINK] [OPSI]
```

## Bantuan sistem

```text
--repair, --setup       Siapkan/perbarui dependency
--doctor, --diagnose    Tampilkan diagnosis lengkap
--shell-info, --where   Tampilkan shell, PATH, Node, npm, dan lokasi command
--self-test             Tes cepat tanpa download
--clear-cache           Hapus cache update/error lama
--check-update          Periksa versi npm
--update                Jalankan update
--no-update-check       Lewati pemeriksaan update
--examples              Contoh untuk semua shell
```

## Headless dan batch

```text
--headless, --non-interactive  Download tanpa TUI
--stdin                       Baca link dari stdin
--batch-file FILE             Baca satu link per baris
--continue-on-error           Lanjut ke link berikutnya saat gagal
--open-output                 Buka folder hasil setelah selesai
--no-color                    Matikan warna terminal
```

## Preset

```text
--preset balanced|music|lossless|mobile|hd|archive
--list-presets
```

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

## Audio

```text
--audio-format mp3|m4a|aac|opus|vorbis|flac|alac|wav
--audio-quality best|320|256|192|128|96
--bitrate RATE
--normalize-audio
--keep-video
```

## Video

```text
--video-format auto|mp4|mkv|webm
--container FMT
--resolution best|2160|1440|1080|720|480|360|240|144
```

## Subtitle, metadata, dan thumbnail

```text
--subtitles
--subtitle-langs "id,en"
--thumbnail, --write-thumbnail
--metadata-files
--write-info-json
--write-description
```

## SponsorBlock dan potong durasi

```text
--sponsorblock off|mark|remove
--remove-sponsors
--sponsorblock-categories "sponsor,selfpromo"
--start TIME
--end TIME
```

## Playlist dan file

```text
--playlist
--playlist-items "1,3,5-10"
--max-downloads 25
--archive downloaded.txt
-o, --output PATH
--output-template "%(title)s.%(ext)s"
--restrict-filenames
--overwrite
--log-file FILE
```

## Jaringan

```text
--rate-limit 2M
--concurrent-fragments 1..16
--proxy URL
--live-from-start
```

## Cookies

```text
--cookies FILE
```

## Tanpa download

```text
--dry-run LINK
--json LINK
--list-formats LINK
--list-subs LINK
```

## Contoh

```sh
ytconv --preset music "LINK"
ytconv --headless --preset hd "LINK"
ytconv --batch-file links.txt --continue-on-error
ytconv --repair
ytconv --shell-info
```
