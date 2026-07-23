# YTConv CLI 1.2.3

YTConv adalah downloader dan converter media sosial untuk pengguna awam maupun terminal automation. Rilis 1.2.3 berfokus pada kestabilan **CMD, PowerShell, SSH/Linux non-TTY, Termux, dan iSH**.

YTConv memakai yt-dlp, gallery-dl, dan FFmpeg. Dukungan situs mengikuti kemampuan engine tersebut. YTConv tidak melewati DRM, paywall, akun privat tanpa akses, atau pembatasan hak cipta.

## Hal baru di 1.2.3

- Update tidak lagi memblokir aplikasi saat update otomatis gagal.
- Updater memilih `npm-cli.js` dan menjalankannya melalui Node, sehingga tidak bergantung pada `npm.cmd`/PowerShell shim bila jalur npm tersedia.
- Fallback Windows masih memakai `cmd.exe`, bukan spawn langsung ke file `.cmd`.
- Mode headless untuk SSH, CI, pipe, dan script.
- Batch URL dari file atau stdin.
- `--repair`, `--shell-info`, `--self-test`, dan `--clear-cache`.
- Pesan error menjelaskan penyebab dan langkah yang bisa langsung disalin.
- Installer khusus PowerShell, CMD, Termux, Linux/SSH, dan iSH.
- iSH native frontend diperbarui ke 1.2.3 dan mendapat repair, batch, stdin, serta update nonblokir.
- CI menguji CMD, PowerShell, Linux headless, Node 18/20/22, Termux simulation, dan iSH.

## Instalasi cepat

### Windows CMD

```cmd
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@1.2.3 --force
ytconv.cmd --version
ytconv.cmd --self-test
```

### Windows PowerShell

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@1.2.3 --force
ytconv.cmd --version
ytconv.cmd --self-test
```

PowerShell dapat memblokir shim `ytconv.ps1`. Cara paling aman adalah menjalankan `ytconv.cmd`. Untuk mengizinkan script npm bagi akun sendiri:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Termux

```sh
pkg update
pkg install -y nodejs python ffmpeg
termux-setup-storage
python -m pip install -U yt-dlp gallery-dl
npm install -g ytconv@1.2.3 --omit=optional --force
ytconv --repair
ytconv --self-test
```

### Linux/macOS/SSH

```sh
npm install -g ytconv@1.2.3 --force
ytconv --self-test
ytconv --headless "LINK"
```

### iSH iPhone/iPad

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/codex/add-ytconv-cli/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --diagnose
```

Tutorial terpisah: [INSTALL.md](docs/INSTALL.md) dan [SHELLS.md](docs/SHELLS.md).

## Penggunaan paling mudah

Buka terminal lalu:

```text
ytconv
```

Paste link, pilih pengaturan, lalu convert.

Preset cepat:

```sh
ytconv --preset music "LINK"
ytconv --preset mobile "LINK"
ytconv --preset hd "LINK"
ytconv --preset archive --playlist "LINK_PLAYLIST"
```

## Mode headless untuk SSH dan script

```sh
ytconv --headless "LINK"
ytconv --headless --preset music "LINK"
ytconv --headless --output "$HOME/downloads" "LINK"
```

Saat stdin atau stdout bukan TTY, YTConv otomatis memakai mode headless.

## Batch download

Buat `links.txt`:

```text
# Komentar boleh
https://example.com/link-1
https://example.com/link-2
```

Jalankan:

```sh
ytconv --batch-file links.txt --continue-on-error
```

Atau melalui pipe:

```sh
printf "%s\n" "LINK1" "LINK2" | ytconv --stdin --continue-on-error
```

PowerShell:

```powershell
Get-Content .\links.txt | ytconv.cmd --stdin --continue-on-error
```

CMD:

```cmd
type links.txt | ytconv.cmd --stdin --continue-on-error
```

## Perbaikan otomatis

```sh
ytconv --repair
ytconv --diagnose
ytconv --shell-info
ytconv --self-test
```

`--repair` menyiapkan atau memperbarui yt-dlp, gallery-dl, dan FFmpeg sesuai platform. `--shell-info` menunjukkan shell, PATH, Node, npm, lokasi YTConv, TTY, dan strategi updater.

## Update

```sh
ytconv --check-update
ytconv --update
```

Update yang tersedia hanya memberi peringatan. YTConv tetap dapat digunakan walaupun registry offline atau update gagal.

Update manual 1.2.3:

```sh
npm install -g ytconv@1.2.3 --force
```

## Audio

```sh
ytconv --audio --audio-format mp3 --audio-quality 320 "LINK"
ytconv --preset music "LINK"
ytconv --audio-format flac --thumbnail "LINK"
ytconv --normalize-audio --audio "LINK"
```

MP3 otomatis menyimpan thumbnail JPG, cover tertanam, metadata, dan chapter bila tersedia. Link `music.youtube.com` mendapat crop cover 1:1.

## Video dan subtitle

```sh
ytconv --video-format mp4 --resolution 1080 "LINK"
ytconv --video-format mkv --subtitles --subtitle-langs "id,en" "LINK"
```

## Gambar, carousel, dan post campuran

```sh
ytconv --image "LINK"
ytconv --image-format jpg "LINK"
ytconv --stories "LINK_INSTAGRAM"
ytconv --all-media "LINK_INSTAGRAM"
```

AUTO mencoba engine yang paling cocok dan dapat berpindah antara yt-dlp dan gallery-dl. Mode yang dipaksa pengguna tidak diam-diam diubah.

## Pemeriksaan tanpa download

```sh
ytconv --dry-run "LINK"
ytconv --json "LINK"
ytconv --list-formats "LINK"
ytconv --list-subs "LINK"
```

## Cookies

```sh
ytconv --cookies "PATH/cookies.txt" "LINK"
```

Gunakan cookies Netscape dari akun yang sah dan memang memiliki akses. Jangan mengunggah atau membagikan file cookies.

## Lokasi hasil

```sh
ytconv --output "D:\Media\YTConv" "LINK"
ytconv --output "$HOME/Downloads/YTConv" "LINK"
ytconv --open-output --headless "LINK"
```

Default desktop: folder Downloads. Default Termux: `~/storage/downloads/YTConv`. Default iSH: `~/Downloads/YTConv`.

## Troubleshooting paling cepat

```sh
ytconv --clear-cache
ytconv --repair
ytconv --diagnose
ytconv --shell-info
```

Dokumentasi error lengkap: [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Dokumentasi

- [Instalasi lengkap semua platform](docs/INSTALL.md)
- [CMD, PowerShell, SSH, Termux, dan iSH](docs/SHELLS.md)
- [Semua command](docs/COMMANDS.md)
- [Platform dan batasan](docs/PLATFORMS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Checklist publish](docs/RELEASE.md)
- [Changelog](CHANGELOG.md)

## Batasan nyata

Tidak mungkin menjamin setiap link semua situs selalu berhasil. Situs dapat mengubah API, meminta login, membatasi region, memberi HTTP 429, menghapus post, atau memakai DRM. YTConv 1.2.3 memperkuat diagnosis, fallback, repair, dan penjelasan error, tetapi tidak menjanjikan akses yang secara teknis atau hukum tidak tersedia.

## Lisensi

MIT. Engine pihak ketiga memiliki lisensinya masing-masing.
