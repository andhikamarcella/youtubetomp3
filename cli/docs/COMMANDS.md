# Referensi command YTConv 1.2.1

Versi 1.2.1 mempertahankan seluruh command 1.2.0 dan memperbaiki self-updater Windows agar npm dijalankan melalui `cmd.exe`, bukan dengan memanggil `npm.cmd` secara langsung.

## Bentuk umum

```text
ytconv [LINK] [OPSI]
```

Opsi dapat diletakkan sebelum atau setelah link. Semua argumen diteruskan tanpa shell wrapper, sehingga spasi pada path aman selama diberi tanda kutip. Pengecualian terkontrol hanya pada self-update Windows, yang memakai `cmd.exe` dengan command npm statis.

## Preset

```text
--preset balanced|music|lossless|mobile|hd|archive
--list-presets
```

Opsi eksplisit selalu mengalahkan nilai preset, walaupun `--preset` ditulis setelahnya.

## Mode

```text
--auto
--video
--audio
--image | --images | --gallery
--stories
--all-media
--platform PLATFORM
```

Mode paksa tidak diam-diam diganti oleh fallback. AUTO dapat mencoba yt-dlp dan gallery-dl.

## Audio

```text
--audio-format mp3|m4a|aac|opus|vorbis|flac|alac|wav
--audio-quality best|320|256|192|128|96
--bitrate RATE
--normalize-audio
--keep-video
```

`--bitrate` adalah alias `--audio-quality`. FLAC/ALAC/WAV tetap bergantung pada kualitas sumber; mengubah lossy menjadi lossless tidak mengembalikan detail yang sudah hilang.

## Video

```text
--video-format auto|mp4|mkv|webm
--container FMT
--resolution best|2160|1440|1080|720|480|360|240|144
```

`--container` adalah alias `--video-format`. Resolusi adalah batas maksimum; YTConv memilih kualitas terdekat yang tersedia.

## Subtitle

```text
--subtitles
--subtitle-langs "id,en"
```

YTConv mencoba subtitle normal dan otomatis, mengabaikan live chat secara default, mengubah ke SRT, lalu embed bila memungkinkan.

## SponsorBlock

```text
--sponsorblock off|mark|remove
--sponsorblock-mode off|mark|remove
--remove-sponsors
--sponsorblock-categories "sponsor,selfpromo"
```

Kategori default: sponsor, selfpromo, interaction, intro, outro, preview, dan music_offtopic.

## Sidecar dan thumbnail

```text
--thumbnail
--write-thumbnail
--metadata-files
--write-info-json
--write-description
```

MP3 selalu mendapatkan thumbnail terpisah dan cover tertanam. Format lain hanya menulis thumbnail bila diminta.

## Potong media

```text
--start 30
--start 01:00
--end 01:05:30
```

Potongan memakai `--download-sections` dan memaksa keyframe di titik potong. Hasil dapat bergeser sedikit tergantung codec/sumber.

## Playlist

```text
--playlist
--playlist-items "1,3,5-10"
--playlist-items "1:20:2"
--max-downloads 25
--archive downloaded.txt
```

Archive hanya mencatat media yang berhasil diproses oleh yt-dlp.

## Jaringan dan performa

```text
--rate-limit 500K
--rate-limit 2M
--concurrent-fragments 1..16
--proxy http://host:port
--proxy socks5://host:port
--live-from-start
```

Proxy juga digunakan saat pemeriksaan metadata. Kredensial proxy yang ditulis di command dapat terlihat pada history terminal; gunakan dengan hati-hati.

## File

```text
-o, --output PATH
--output-template "%(uploader)s/%(title)s [%(id)s].%(ext)s"
--restrict-filenames
--overwrite
--log-file FILE
```

Template wajib relatif, tidak boleh memiliki segmen `..`, dan wajib memuat `%(ext)s`.

## Cookies

```text
--cookies FILE
```

Gunakan format Netscape. Cookies hanya untuk akun yang sah dan memiliki akses terhadap media.

## Pemeriksaan dan update

```text
--dry-run LINK
--json LINK
--list-formats LINK
--list-subs LINK
--diagnose
--check-update
--update
--no-update-check
--version
--help
```

`--json` memakai schemaVersion 1 dengan field versi YTConv, preset, request, dan media.

Pada Windows, `--update` memakai bentuk setara berikut secara internal:

```cmd
cmd.exe /d /s /c "npm install -g ytconv@latest"
```

Instalasi 1.1.5 atau 1.2.0 yang sudah gagal dengan `spawnSync npm.cmd EINVAL` harus diperbarui manual:

```cmd
npm install -g ytconv@1.2.1 --force
```
