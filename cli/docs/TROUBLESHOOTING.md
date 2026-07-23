# Troubleshooting YTConv 1.3.0

## Urutan pemeriksaan aman

```sh
ytconv clean
ytconv repair
ytconv --self-test
ytconv doctor
ytconv --shell-info
```

Saat melaporkan bug, sertakan hasil command tersebut tanpa cookies, token, atau kredensial proxy.

## Versi npm yang salah saat publish

Periksa folder dan branch:

```cmd
cd C:\Users\andhi\youtubetomp3\cli
node -p "require('./package.json').version"
git branch --show-current
git status --short
```

Versi harus `1.3.0` dan branch harus `codex/add-ytconv-cli`. npm tidak mengizinkan versi yang sudah pernah dipublikasikan untuk ditimpa.

## `spawnSync npm.cmd EINVAL`

Penyebab: updater lama menjalankan file `.cmd` langsung. YTConv baru menjalankan npm CLI melalui Node, dengan fallback `cmd.exe`.

CMD:

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@1.3.0 --force
ytconv.cmd --version
```

## PowerShell: scripts are disabled

Gunakan shim CMD:

```powershell
ytconv.cmd --version
ytconv.cmd doctor
```

Atau untuk akun sendiri:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## `ytconv` tidak ditemukan

Windows:

```cmd
where ytconv
where npm
npm.cmd prefix -g
```

Linux/macOS:

```sh
command -v ytconv
type -a ytconv
npm prefix -g
export PATH="$HOME/.local/bin:$PATH"
```

## Permission denied / EACCES

Jangan memakai `sudo npm install -g`. Gunakan prefix pengguna:

```sh
npm config set prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ytconv@1.3.0 --force
```

## FFmpeg atau ffprobe tidak ditemukan

```sh
ytconv --shell-info
ytconv repair
ytconv doctor
```

Doctor menampilkan command package manager untuk distro. ffprobe bersifat opsional untuk sebagian fitur diagnosis, sedangkan FFmpeg diperlukan untuk konversi/merge.

## Alpine: binary FFmpeg tidak dapat dijalankan

Alpine memakai musl. Instal FFmpeg sistem:

```sh
apk add --no-cache ffmpeg
```

YTConv 1.3.0 memvalidasi binary bundled dan memakai FFmpeg sistem bila binary bundled tidak kompatibel.

## Link bisa dibuka di browser tetapi gagal di YTConv

Kemungkinan:

- media meminta login;
- cookies kedaluwarsa;
- post privat atau dihapus;
- region lock;
- extractor situs berubah;
- DRM/paywall;
- browser masih mengunci database cookies.

Coba:

```sh
ytconv info "LINK"
ytconv download "LINK" --cookies-from-browser chrome
ytconv download "LINK" --cookies cookies.txt
```

Tutup browser sepenuhnya sebelum membaca cookies browser.

## Cookies browser gagal dibaca

Windows/macOS/Linux desktop:

```sh
ytconv download "LINK" --cookies-from-browser chrome
ytconv download "LINK" --cookies-from-browser "firefox:default-release"
```

Bila tetap gagal, ekspor file Netscape secara sah dan gunakan `--cookies`. Termux/iSH tidak dapat mengambil database privat browser Android/iOS.

Cookies adalah kredensial sensitif. Jangan kirim ke issue, chat publik, screenshot, atau orang lain.

## HTTP 429 / Too Many Requests

Kurangi paralelisme dan beri jeda:

```sh
ytconv download "LINK" --concurrent-fragments 1 --retry-sleep "linear=2:20:3"
ytconv batch links.txt --jobs 1 --continue-on-error
```

Tunggu sebelum mencoba ulang. Retry agresif dapat memperpanjang pembatasan.

## Timeout, DNS, proxy, atau sertifikat

```sh
ytconv doctor
ytconv --shell-info
```

Matikan proxy untuk pengujian atau pastikan format URL benar:

```text
http://host:port
socks5://host:port
```

Periksa waktu perangkat dan sertifikat CA, terutama di iSH/Alpine.

## Requested format is not available

Lihat format original:

```sh
ytconv formats "LINK"
ytconv formats "LINK" --json
```

Turunkan resolusi atau gunakan container AUTO/MKV:

```sh
ytconv download "LINK" --video-format auto --resolution 720
```

## MP3 320 kbps terdengar sama

Normal. 320 kbps adalah target hasil encoder, bukan peningkatan kualitas sumber. Periksa bitrate audio original melalui:

```sh
ytconv formats "LINK"
```

## Metadata manual tidak muncul

Pastikan format mendukung field tersebut dan metadata ditanam:

```sh
ytconv download "LINK" --format mp3 --artist "Artis" --title "Judul" --album "Album"
```

Sebagian player tidak menampilkan seluruh field walaupun file menyimpannya.

## Thumbnail atau cover gagal

Pastikan FFmpeg siap:

```sh
ytconv doctor
ytconv repair
```

WAV tidak mendapat embedded cover melalui jalur ini. MP3 mencoba cover tertanam dan JPG terpisah.

## YouTube Music cover tidak persegi

URL harus berasal dari `music.youtube.com`, dan FFmpeg harus tersedia. URL YouTube biasa sengaja tidak dicrop.

## Subtitle tidak ditemukan

```sh
ytconv subtitles "LINK"
ytconv download "LINK" --subtitle-only --subtitle-langs "id,en"
```

Tidak semua video mempunyai subtitle manual/otomatis. Live chat dikecualikan secara default.

## Potongan durasi tidak tepat satu frame

Clipping bergantung pada keyframe dan codec. YTConv meminta keyframe pada titik potong, tetapi pergeseran kecil tetap mungkin.

## SponsorBlock tidak bekerja

Segmen mungkin tidak tersedia. Coba mark:

```sh
ytconv download "LINK" --sponsorblock mark
```

SponsorBlock umumnya tidak tersedia di luar video yang mempunyai data komunitas.

## Batch berhenti terlalu cepat

Gunakan:

```sh
ytconv batch links.txt --continue-on-error --jobs 2 --result-json report.json
```

Subcommand `batch` otomatis mengaktifkan continue-on-error. Exit code tetap nonzero bila ada kegagalan.

## File `.part` tertinggal

Resume aktif secara default:

```sh
ytconv download "LINK" --resume
```

Untuk membersihkan file sementara baru setelah gagal:

```sh
ytconv download "LINK" --cleanup-part
```

Cleanup dinonaktifkan saat batch paralel agar worker tidak menghapus file worker lain.

## Output template ditolak

Template harus relatif, tidak mengandung segmen `..`, dan wajib memuat `%(ext)s`:

```sh
ytconv download "LINK" --output-template "%(uploader)s/%(title)s.%(ext)s"
```

## iSH kehabisan memori atau lambat

Gunakan satu pekerjaan, resolusi lebih kecil, dan hindari konversi berat:

```sh
ytconv download "LINK" --preset mobile
ytconv batch links.txt --jobs 1 --continue-on-error
```

Frontend iSH sengaja memproses batch secara berurutan.

## Exit code untuk script

- `0`: berhasil
- `1`: proses gagal
- `2`: URL/opsi salah
- `3`: dependency hilang
- `4`: autentikasi diperlukan
- `5`: gangguan sementara
- `130`: dibatalkan

## Log

```sh
ytconv download "LINK" --log-file ytconv.log
```

Sebelum membagikan log, hapus link privat, path sensitif, username, proxy, dan informasi akun. Jangan pernah memasukkan isi cookies.
