# Changelog

Perubahan penting YTConv CLI mengikuti Semantic Versioning.

## 1.3.0 — playlist, transparency, automation, and Linux distro release

### Ditambahkan

- Command pemula: `download`, `playlist`, `batch`, `info`, `formats`, `subtitles`, `doctor`, `repair`, dan `clean`.
- Batch paralel terbatas `--jobs 1–8`, `--continue-on-error`, stdin, file batch, dan laporan `--result-json`.
- `--retries`, `--fragment-retries`, `--file-access-retries`, dan `--retry-sleep` tervalidasi.
- `--resume`, `--no-resume`, serta `--cleanup-part` yang tidak menghapus file worker lain.
- `--skip-playlist-after-errors`, playlist range, max downloads, serta archive anti-duplikat.
- Format source transparan dalam teks/JSON: codec, resolusi, FPS, bitrate, ukuran perkiraan, dan label `original`.
- Rencana output membedakan original, remux, dan converted; target MP3 320 kbps tidak diklaim meningkatkan sumber.
- Metadata override `--artist`, `--title`, `--album`, `--track`, `--year`, dan `--genre`.
- `--cookies-from-browser` untuk browser desktop yang didukung engine.
- `--subtitle-only`, alias `--from/--to`, serta generic `--format/--quality`.
- Exit code stabil 0, 1, 2, 3, 4, 5, dan 130.
- Deteksi `/etc/os-release`, package manager, distro, dan rencana dependency.
- Installer user-level untuk apt, dnf, pacman, zypper, apk, xbps, emerge, Nix, Homebrew, Windows, Termux, dan iSH.
- Dokumentasi Linux terpisah untuk Debian/Ubuntu, Fedora/RHEL, Arch/CachyOS, openSUSE, Alpine, Void, Gentoo, NixOS, dan macOS.
- CI macOS, Alpine/musl, matriks Node 18/20/22, Windows CMD/PowerShell, Ubuntu/Linux, SSH/headless, Termux simulation, iSH, dan smoke test distro installer.

### Diperbaiki

- Headless sekarang meneruskan seluruh opsi lanjutan ke downloader; sebelumnya sebagian opsi hanya bekerja di TUI.
- Retry sleep dinormalisasi agar tidak membentuk argumen `fragment::...` atau `file_access::...`.
- Binary FFmpeg bundled divalidasi dengan menjalankannya; Alpine/musl dapat menggunakan FFmpeg sistem bila binary glibc tidak kompatibel.
- yt-dlp dapat memakai bundled binary, executable PATH, atau modul Python.
- Batch membuang komentar, baris kosong, dan URL duplikat.
- Progress menampilkan persentase, ukuran, kecepatan, dan ETA bila engine menyediakan data.
- Cookies browser eksplisit tidak lagi tertimpa mode auto.
- Doctor memeriksa distro, package manager, ffprobe, folder output, Node, engine, dan updater.

### Tetap dipertahankan

- MP3 menyimpan thumbnail JPG terpisah dan cover tertanam.
- Crop cover YouTube Music persegi 1:1.
- Metadata dan chapter tertanam.
- Subtitle biasa/otomatis, SRT, embed, SponsorBlock, normalisasi audio, sidecar metadata, clipping, proxy, rate limit, dan output template.
- Fallback yt-dlp ↔ gallery-dl dalam mode AUTO.
- Update nonblokir dan updater Windows yang tidak melakukan spawn langsung ke `npm.cmd`.

## 1.2.3 — cross-shell reliability and beginner release

- CMD, PowerShell, SSH/non-TTY, Termux, dan iSH distabilkan.
- Updater Windows memakai Node/npm CLI dengan fallback `cmd.exe`.
- Ditambahkan repair, doctor, shell-info, self-test, clear-cache, headless, stdin, batch, dan pesan error yang dapat ditindaklanjuti.

## 1.2.1 — Windows updater hotfix

- Memperbaiki `spawnSync npm.cmd EINVAL`.

## 1.2.0 — final maturity release

- Preset, SponsorBlock, normalisasi, subtitle, sidecar, clipping, archive, proxy, rate limit, dry-run, JSON, dan dokumentasi lengkap.

## 1.1.5

- Koreksi nomor rilis setelah 1.1.4 terpublikasi.

## 1.1.4

- Format audio/video lanjutan, subtitle, sidecar metadata, potong durasi, dan archive.

## 1.1.3

- Thumbnail JPG terpisah, cover MP3, metadata, dan crop 1:1 YouTube Music.

## 1.1.2

- Perbaikan instalasi Termux dan dependency FFmpeg optional.
