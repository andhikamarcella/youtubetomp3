# Changelog

## 1.2.3 — cross-shell reliability and beginner release

### Diperbaiki

- Update tersedia tidak lagi memblokir pembukaan YTConv.
- Updater mencoba menjalankan `npm-cli.js` melalui executable Node aktif.
- Fallback Windows memakai `cmd.exe`; tidak melakukan spawn langsung ke `npm.cmd`.
- Pesan error umum sekarang berisi penyebab dan langkah perbaikan.
- Mode non-TTY tidak lagi mencoba membuka Ink TUI.
- Batch membuang baris kosong, komentar, dan URL duplikat.
- Dependency repair menjadi command resmi dan dapat dijalankan ulang.
- PowerShell mendapat jalur `ytconv.cmd` yang terdokumentasi dan diuji.

### Ditambahkan

- `--repair` / `--setup`.
- `--doctor` alias `--diagnose`.
- `--shell-info` / `--where`.
- `--self-test` dan `--clear-cache`.
- `--headless` / `--non-interactive`.
- `--stdin`, `--batch-file`, dan `--continue-on-error`.
- `--open-output`, `--no-color`, dan `--examples`.
- Installer PowerShell, CMD, Termux, Linux/SSH, dan iSH.
- Dokumentasi instalasi serta panduan shell terpisah.
- Frontend native iSH 1.2.3 dengan repair, batch, stdin, dan update nonblokir.
- CI lintas CMD, PowerShell, SSH/headless, Termux simulation, iSH, dan Node 18/20/22.

### Dipertahankan

- MP3 dengan thumbnail JPG, embedded cover, metadata, dan chapter.
- Cover YouTube Music crop 1:1.
- Fallback yt-dlp ↔ gallery-dl pada AUTO.
- Preset, subtitle, SponsorBlock, clipping, archive, proxy, dan output template.

## 1.2.1 — Windows updater hotfix

- Windows tidak lagi menjalankan `npm.cmd` langsung pada updater.
- Ditambahkan unit test updater Windows.

## 1.2.0 — maturity release

- Preset, headless inspection, advanced audio/video, subtitle, SponsorBlock, network controls, docs, dan iSH frontend.

## 1.1.5

- Koreksi nomor rilis.

## 1.1.4

- Format lanjutan, subtitle, sidecar metadata, clipping, dan archive.

## 1.1.3

- Thumbnail JPG, cover MP3, metadata, dan crop YouTube Music 1:1.
