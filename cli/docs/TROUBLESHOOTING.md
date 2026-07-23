# Troubleshooting YTConv 1.5.0 Beta

Versi npm: `1.5.0-beta.1`

## Urutan pemeriksaan aman

```sh
ytconv clean
ytconv repair
ytconv --self-test
ytconv doctor
ytconv --shell-info
```

`ytconv clean` hanya menghapus cache update/error. Archive download di `~/.ytconv/archives` tetap dipertahankan.

Saat melaporkan bug, sertakan hasil command tersebut tanpa cookies, token, atau kredensial proxy.

## Versi salah saat publish atau install

Periksa folder, branch, versi, dan tag:

```cmd
cd C:\Users\andhi\youtubetomp3\cli
node -p "require('./package.json').version"
node -p "require('./package.json').publishConfig.tag"
git branch --show-current
git status --short
```

Hasil harus:

```text
1.5.0-beta.1
beta
codex/add-ytconv-cli
```

npm tidak mengizinkan versi yang pernah dipublikasikan untuk ditimpa.

Instal beta dengan:

```cmd
npm.cmd install -g ytconv@beta --force
```

Bukan `ytconv@latest`.

## `spawnSync npm.cmd EINVAL`

Updater baru tidak menjalankan `npm.cmd` secara langsung. Ia memakai npm CLI melalui Node, dengan fallback `cmd.exe`.

Pemulihan CMD:

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
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
npm install -g ytconv@beta --force
```

## Default beta tidak aktif

Periksa:

```sh
ytconv --version
ytconv --self-test
ytconv doctor
```

Doctor harus menunjukkan:

```text
Subtitle          ON
SponsorBlock      mark
Archive yt-dlp    path file
Archive gallery   path file
```

Bila masih memakai versi lama:

```sh
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@beta --force
```

## Subtitle aktif tetapi tidak ada file subtitle

Tidak semua video mempunyai subtitle manual atau otomatis. Periksa:

```sh
ytconv subtitles "LINK"
ytconv download "LINK" --subtitle-only --subtitle-langs "id,en"
```

Live chat dikecualikan secara default. Ketiadaan subtitle tidak seharusnya menggagalkan download media utama.

Matikan subtitle untuk satu proses:

```sh
ytconv download "LINK" --no-subtitles
```

## SponsorBlock tidak menandai apa pun

Default `mark` hanya bekerja bila data segmen tersedia. SponsorBlock terutama tersedia untuk YouTube.

```sh
ytconv download "LINK" --sponsorblock mark
```

Hapus segmen secara eksplisit:

```sh
ytconv download "LINK" --sponsorblock remove
```

Matikan:

```sh
ytconv download "LINK" --no-sponsorblock
```

Mode default `mark` tidak memotong media.

## Download langsung dilewati karena archive

Media dengan profil output yang sama sudah tercatat. Lihat archive melalui:

```sh
ytconv doctor
```

Archive otomatis berada di:

```text
~/.ytconv/archives
```

Unduh tanpa archive untuk satu proses:

```sh
ytconv download "LINK" --no-archive
```

Gunakan archive khusus:

```sh
ytconv download "LINK" --archive downloaded.txt
```

YTConv membuat `downloaded.txt.gallery.sqlite3` untuk gallery-dl karena format archive gallery-dl berbeda dari file teks yt-dlp.

## `ytconv clean` menghapus archive

Pada beta yang benar, ini tidak boleh terjadi. Perbarui:

```sh
npm install -g ytconv@beta --force
```

Lalu jalankan test:

```sh
ytconv --self-test
ytconv clean
```

Archive di `~/.ytconv/archives` harus tetap ada.

## FFmpeg atau ffprobe tidak ditemukan

```sh
ytconv --shell-info
ytconv repair
ytconv doctor
```

Doctor menampilkan command package manager untuk distro. ffprobe opsional untuk sebagian diagnosis, sedangkan FFmpeg diperlukan untuk konversi/merge.

## Alpine: binary FFmpeg tidak dapat dijalankan

Alpine memakai musl. Instal FFmpeg sistem:

```sh
apk add --no-cache ffmpeg
```

YTConv memvalidasi binary bundled dan dapat memakai FFmpeg sistem bila binary glibc tidak kompatibel.

## Link bisa dibuka di browser tetapi gagal

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

Desktop:

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

Format proxy:

```text
http://host:port
socks5://host:port
```

Periksa waktu perangkat dan sertifikat CA, terutama di iSH/Alpine.

## Requested format is not available

```sh
ytconv formats "LINK"
ytconv formats "LINK" --json
ytconv download "LINK" --video-format auto --resolution 720
```

## MP3 320 kbps terdengar sama

Normal. 320 kbps adalah target encoder, bukan peningkatan kualitas sumber. Periksa bitrate original melalui:

```sh
ytconv formats "LINK"
```

## Metadata manual tidak muncul

```sh
ytconv download "LINK" --format mp3 --artist "Artis" --title "Judul" --album "Album"
```

Sebagian player tidak menampilkan seluruh field walaupun file menyimpannya.

## Thumbnail atau cover gagal

```sh
ytconv doctor
ytconv repair
```

WAV tidak mendapat embedded cover melalui jalur ini. MP3 mencoba cover tertanam dan JPG terpisah.

## YouTube Music cover tidak persegi

URL harus berasal dari `music.youtube.com`, dan FFmpeg harus tersedia. URL YouTube biasa sengaja tidak dicrop.

## Potongan durasi tidak tepat satu frame

Clipping bergantung pada keyframe dan codec. Pergeseran kecil tetap mungkin.

## Batch berhenti terlalu cepat

```sh
ytconv batch links.txt --continue-on-error --jobs 2 --result-json report.json
```

Subcommand `batch` otomatis mengaktifkan continue-on-error. Exit code tetap nonzero bila ada kegagalan.

## File `.part` tertinggal

Resume aktif secara default:

```sh
ytconv download "LINK" --resume
```

Bersihkan file sementara baru setelah gagal:

```sh
ytconv download "LINK" --cleanup-part
```

Cleanup dinonaktifkan saat batch paralel agar worker tidak menghapus file worker lain.

## Output template ditolak

Template harus relatif, tidak mengandung `..`, dan wajib memuat `%(ext)s`:

```sh
ytconv download "LINK" --output-template "%(uploader)s/%(title)s.%(ext)s"
```

## iSH lambat atau kehabisan memori

Gunakan resolusi lebih kecil dan batch berurutan:

```sh
ytconv download "LINK" --preset mobile
ytconv batch links.txt --jobs 1 --continue-on-error
```

## Exit code

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
