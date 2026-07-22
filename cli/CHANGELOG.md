# Changelog

Semua perubahan penting YTConv CLI dicatat di sini. Format versi mengikuti Semantic Versioning.

## 1.2.1 — Windows updater hotfix

### Diperbaiki

- Self-updater Windows tidak lagi menjalankan `npm.cmd` secara langsung, yang dapat menghasilkan `spawnSync npm.cmd EINVAL` pada sebagian versi Node.js/Windows.
- Windows sekarang menjalankan update melalui `cmd.exe /d /s /c "npm install -g ytconv@latest"`.
- Ditambahkan unit test dan pemeriksaan GitHub Actions khusus invocation updater Windows.
- Pesan kegagalan tetap menampilkan command manual yang aman bila npm atau izin global bermasalah.

### Catatan upgrade

- Instalasi global 1.1.5 atau 1.2.0 yang updater-nya sudah gagal tidak dapat memperbaiki dirinya sendiri. Jalankan `npm install -g ytconv@1.2.1 --force` setelah 1.2.1 dipublikasikan.
- Untuk menguji branch sebelum publish, jalankan `npm install -g . --force` dari folder `cli`.
- Frontend native iSH tetap versi 1.2.0 karena bug ini hanya menyentuh proses self-update npm pada Windows.

## 1.2.0 — Final maturity release

### Ditambahkan

- Preset `balanced`, `music`, `lossless`, `mobile`, `hd`, dan `archive`.
- Format audio AAC, ALAC, dan Vorbis; opsi kualitas 96 kbps.
- `--dry-run`, `--json`, `--list-formats`, dan `--list-subs`.
- SponsorBlock mode `mark` dan `remove`.
- Normalisasi audio FFmpeg `loudnorm` dan opsi menyimpan video asli.
- Rate limit, proxy, kontrol fragmen paralel, live-from-start, playlist range, dan batas jumlah download.
- Output template tervalidasi, nama file terbatas/ASCII, overwrite eksplisit, dan log sesi.
- Shortcut TUI untuk mode, format audio, container video, subtitle, dan thumbnail.
- Dokumentasi command, platform, troubleshooting, serta checklist rilis.
- Paritas fitur inti pada frontend native iSH 1.2.0.

### Diperbaiki

- Nilai command-line sekarang tampil dan digunakan konsisten oleh TUI.
- Proxy dapat digunakan pada pemeriksaan metadata dan download.
- Pengaturan eksplisit mengalahkan preset tanpa bergantung pada urutan argumen.
- Template output dibatasi di dalam folder tujuan untuk mencegah path traversal.
- JSON automation tidak tercampur dengan pesan update checker.

### Dipertahankan

- MP3 menyimpan thumbnail JPG terpisah dan cover tertanam.
- Metadata dan chapter tertanam.
- YouTube Music crop thumbnail 1:1.
- Fallback yt-dlp/gallery-dl untuk mode AUTO.
- Kompatibilitas CMD Windows, Linux, macOS, Termux, dan iSH.

## 1.1.5

- Koreksi nomor rilis setelah 1.1.4 terpublikasi.

## 1.1.4

- Format audio/video lanjutan, subtitle, sidecar metadata, potong durasi, dan download archive.

## 1.1.3

- Thumbnail JPG terpisah, cover MP3, metadata, dan crop 1:1 YouTube Music.

## 1.1.2

- Perbaikan instalasi Termux dan dependency FFmpeg optional.
