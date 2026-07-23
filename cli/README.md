# YTConv CLI 1.3.0

YTConv adalah downloader dan converter media sosial yang ramah pengguna awam, tetapi tetap nyaman untuk script, bot, SSH, dan automasi. YTConv memakai **yt-dlp**, **gallery-dl**, dan **FFmpeg**, dengan routing dan fallback untuk video, audio, gambar, carousel, Story, Reel, post campuran, serta playlist.

> Gunakan hanya untuk media milik sendiri, berlisensi bebas, atau yang memang diizinkan untuk diunduh. YTConv tidak melewati DRM, paywall, akun privat tanpa akses, region lock, atau pembatasan hak cipta.

## Hal baru di 1.3.0

- Command sederhana: `download`, `playlist`, `batch`, `info`, `formats`, `subtitles`, `doctor`, `repair`, dan `clean`.
- Batch dari file atau stdin dengan `--jobs 1–8`, `--continue-on-error`, dan laporan `--result-json`.
- Retry, fragment retry, file-access retry, retry sleep, resume `.part`, archive anti-duplikat, serta cleanup file sementara yang aman.
- Format sumber tampil sebagai **original**, lengkap dengan codec, bitrate, FPS, resolusi, dan perkiraan ukuran bila tersedia.
- Target hasil ditandai sebagai converted/remux. MP3 320 kbps tidak diklaim meningkatkan kualitas sumber.
- Metadata musik otomatis plus override `artist`, `title`, `album`, `track`, `year`, dan `genre`.
- Cookies file serta cookies browser Chrome, Chromium, Edge, Firefox, Brave, Opera, Vivaldi, Safari, dan Whale pada desktop.
- Subtitle-only, subtitle SRT, embed subtitle, potong durasi, SponsorBlock, normalisasi audio, metadata sidecar, dan thumbnail/cover.
- Exit code stabil untuk script.
- Doctor dan shell-info menampilkan distro, package manager, dependency, PATH, updater, serta folder output.
- Installer user-level untuk Windows, macOS, distro Linux utama, Termux, dan frontend native iSH.
- CI untuk Node 18/20/22, Windows CMD, PowerShell, Ubuntu/Linux, macOS, Alpine/musl, SSH/headless, Termux simulation, dan iSH.

## Instalasi cepat

### Windows CMD

```cmd
npm.cmd install -g ytconv@1.3.0 --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

### Windows PowerShell

Gunakan `.cmd` agar tidak terganggu Execution Policy:

```powershell
npm.cmd install -g ytconv@1.3.0 --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

### Linux dan macOS

Dari source repository:

```sh
sh ./scripts/install-unix.sh
```

Installer mendeteksi apt, dnf, pacman, zypper, apk, xbps, emerge, Nix, atau Homebrew. Paket npm dipasang ke `~/.local`, bukan memakai `sudo npm install -g`.

Lihat [panduan seluruh distro Linux](docs/LINUX.md).

### Android Termux

```sh
pkg update
pkg install -y nodejs python ffmpeg
termux-setup-storage
python -m pip install -U yt-dlp gallery-dl
npm install -g ytconv@1.3.0 --omit=optional --force
ytconv repair
ytconv --self-test
```

Hasil default: `~/storage/downloads/YTConv`.

### iPhone/iPad melalui iSH

Gunakan frontend Python native, bukan paket npm Ink:

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/codex/add-ytconv-cli/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
```

Hasil default: `~/Downloads/YTConv`, dapat dibuka melalui aplikasi Files → iSH.

### Tanpa instalasi global

```sh
npx -y ytconv@1.3.0 --help
npx -y ytconv@1.3.0 download "LINK"
```

## Command dasar

```sh
ytconv download "LINK"
ytconv playlist "LINK_PLAYLIST"
ytconv batch links.txt
ytconv info "LINK"
ytconv formats "LINK"
ytconv formats "LINK" --json
ytconv subtitles "LINK"
ytconv doctor
ytconv repair
ytconv clean
```

Sintaks lama tetap didukung:

```sh
ytconv "LINK" --preset music
```

## Playlist dan batch

Seluruh playlist dengan archive anti-duplikat:

```sh
ytconv playlist "LINK" --archive downloaded.txt
```

Item tertentu:

```sh
ytconv playlist "LINK" --playlist-items "1-10"
ytconv playlist "LINK" --playlist-items "1,3,5-10"
```

Batasi jumlah dan lanjut bila beberapa item gagal:

```sh
ytconv playlist "LINK" --max-downloads 25 --skip-playlist-after-errors 5
```

`links.txt`:

```text
# komentar diabaikan
https://example.com/media-1
https://example.com/media-2
```

Jalankan dua pekerjaan sekaligus dan simpan laporan:

```sh
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

`--jobs` dibatasi 1–8. Nilai kecil lebih aman untuk laptop lama, ponsel, server kecil, dan situs yang mudah memberi HTTP 429.

## Retry, resume, dan cleanup

```sh
ytconv download "LINK" \
  --retries 20 \
  --fragment-retries 30 \
  --file-access-retries 5 \
  --retry-sleep "linear=1:10:2" \
  --resume
```

Resume aktif secara default. Matikan dengan:

```sh
ytconv download "LINK" --no-resume
```

Bersihkan file `.part` baru bila proses gagal:

```sh
ytconv download "LINK" --cleanup-part
```

Saat batch paralel memakai `--jobs > 1`, cleanup part otomatis dinonaktifkan agar worker tidak menghapus file worker lain.

## Format dan kualitas yang jujur

Lihat format original:

```sh
ytconv formats "LINK"
ytconv formats "LINK" --json
```

Info lengkap beserta rencana output:

```sh
ytconv info "LINK"
ytconv info "LINK" --json
```

Contoh konversi:

```sh
ytconv download "LINK" --format mp3 --quality 192
ytconv download "LINK" --format mp4 --quality 1080p
ytconv download "LINK" --audio-format flac
ytconv download "LINK" --video-format webm --resolution 720
```

Label `original` berarti stream berasal dari sumber. MP3, FLAC dari sumber lossy, normalisasi, dan remux tertentu adalah proses output. Memilih MP3 320 kbps hanya menentukan target encoder dan **tidak mengembalikan detail yang sudah hilang dari sumber**.

## Metadata musik dan cover

Metadata otomatis ditanam bila tersedia. MP3 menyimpan thumbnail JPG terpisah dan menanamnya sebagai cover. YouTube Music memakai crop persegi 1:1.

```sh
ytconv download "LINK" --preset music
ytconv download "LINK" --metadata --thumbnail --metadata-files
```

Override manual:

```sh
ytconv download "LINK" --format mp3 \
  --artist "Nama Artis" \
  --title "Judul Lagu" \
  --album "Nama Album" \
  --track 3 \
  --year 2026 \
  --genre "Pop"
```

URL sumber tetap masuk ke metadata bawaan engine pada format yang mendukungnya.

## Cookies dan login

File Netscape:

```sh
ytconv download "LINK" --cookies cookies.txt
```

Browser desktop:

```sh
ytconv download "LINK" --cookies-from-browser chrome
ytconv download "LINK" --cookies-from-browser "firefox:default-release"
ytconv download "LINK" --cookies-from-browser "brave:Default"
```

Tutup browser sepenuhnya bila database cookies sedang terkunci. Cookies adalah kredensial sensitif: jangan dikirim ke orang lain, issue publik, screenshot, atau log. Termux dan iSH tidak dapat membaca database privat browser Android/iOS secara langsung; gunakan file cookies yang diekspor secara sah.

## Subtitle dan potong durasi

```sh
ytconv download "LINK" --subtitles --subtitle-langs "id,en"
ytconv download "LINK" --subtitle-only --subtitle-langs "id,en"
ytconv download "LINK" --from 00:01:20 --to 00:03:45
```

## Preset

```sh
ytconv --list-presets
ytconv download "LINK" --preset music
ytconv download "LINK" --preset mobile
ytconv playlist "LINK" --preset archive --archive downloaded.txt
```

Preset tersedia: `balanced`, `music`, `lossless`, `mobile`, `hd`, dan `archive`. Opsi eksplisit mengalahkan nilai preset.

## SSH, pipe, bot, dan automasi

```sh
ytconv --headless "LINK"
printf '%s\n' "LINK1" "LINK2" | ytconv --stdin --jobs 2 --continue-on-error
```

JSON metadata:

```sh
ytconv info "LINK" --json
```

Exit code:

| Kode | Arti |
|---:|---|
| 0 | Berhasil |
| 1 | Download/proses gagal |
| 2 | URL atau opsi tidak valid |
| 3 | Dependency belum tersedia |
| 4 | Login/cookies diperlukan |
| 5 | Gangguan sementara: jaringan, proxy, timeout, atau HTTP 429 |
| 130 | Dibatalkan |

## Diagnosis

```sh
ytconv doctor
ytconv repair
ytconv --self-test
ytconv --shell-info
ytconv clean
```

## Dokumentasi

- [Instalasi lengkap](docs/INSTALL.md)
- [Linux dan macOS](docs/LINUX.md)
- [CMD, PowerShell, SSH, Termux, dan iSH](docs/SHELLS.md)
- [Seluruh command](docs/COMMANDS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Checklist rilis](docs/RELEASE.md)
- [Changelog](CHANGELOG.md)

## Dukungan dan batasan

Tidak ada downloader yang dapat menjamin semua link, distro, arsitektur, dan perangkat selalu berhasil. Situs dapat mengubah API, meminta login, memblokir wilayah, menghapus post, memberi HTTP 429, atau memakai DRM. YTConv memperkuat fallback, retry, repair, diagnosis, dan pesan error, tetapi tidak menerobos akses yang tidak tersedia secara teknis atau hukum.

## Lisensi

MIT. yt-dlp, gallery-dl, FFmpeg, dan dependency lain memiliki lisensi masing-masing.
