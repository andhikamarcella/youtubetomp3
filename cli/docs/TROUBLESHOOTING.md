# Troubleshooting YTConv 1.2.3

## Urutan perbaikan aman

```sh
ytconv --clear-cache
ytconv --repair
ytconv --self-test
ytconv --diagnose
ytconv --shell-info
```

## `spawnSync npm.cmd EINVAL`

Penyebab: updater lama menjalankan `npm.cmd` langsung.

CMD:

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@1.2.3 --force
ytconv.cmd --version
```

PowerShell:

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@1.2.3 --force
ytconv.cmd --version
```

1.2.3 lebih dahulu mencoba `npm-cli.js` melalui Node. Bila tidak ditemukan, Windows memakai `cmd.exe` fallback.

## PowerShell `running scripts is disabled`

Gunakan shim CMD:

```powershell
ytconv.cmd --version
```

Atau ubah policy untuk akun sendiri:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Lihat command yang dipilih:

```powershell
Get-Command ytconv -All
```

## `ytconv is not recognized` / command not found

CMD:

```cmd
where node
where npm
where ytconv
npm.cmd config get prefix
```

PowerShell:

```powershell
Get-Command node -All
Get-Command npm -All
Get-Command ytconv -All
```

Unix:

```sh
command -v node
command -v npm
command -v ytconv
npm config get prefix
```

Tutup terminal setelah instalasi global dan buka terminal baru.

## SSH/CI berhenti atau tampilan TUI rusak

Gunakan mode headless:

```sh
ytconv --headless "LINK"
```

Untuk pipe:

```sh
cat links.txt | ytconv --stdin --continue-on-error
```

## Termux tidak dapat menulis ke Download

```sh
termux-setup-storage
ls -la ~/storage/downloads
ytconv --repair
```

Bila Android menolak izin, buka Settings → Apps → Termux → Files and media.

## Termux `pip` gagal

```sh
pkg update
pkg install -y python ffmpeg
python -m pip install -U --no-cache-dir yt-dlp gallery-dl
```

YTConv juga mencoba paket `python-yt-dlp` bila tersedia.

## iSH dependency hilang

```sh
ytconv --repair
ytconv --diagnose
```

Instal ulang frontend:

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/codex/add-ytconv-cli/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
```

## Cookies/login/private

Gunakan cookies Netscape dari akun yang memang memiliki akses:

```sh
ytconv --cookies cookies.txt "LINK"
```

Tutup browser desktop bila database cookies terkunci. Jangan bagikan cookies.

## HTTP 429

Tunggu beberapa menit. Jangan retry agresif.

```sh
ytconv --concurrent-fragments 1 --rate-limit 1M "LINK"
```

## Requested format is not available

```sh
ytconv --list-formats "LINK"
ytconv --resolution best --video-format auto "LINK"
```

## FFmpeg/thumbnail/subtitle gagal

```sh
ytconv --repair
ytconv --diagnose
```

WAV tidak mendukung embedded cover. Tidak semua sumber memiliki subtitle atau chapter.

## Link unsupported

Update engine:

```sh
ytconv --repair
```

Situs dapat mengubah API. Sertakan output diagnosis saat melaporkan bug.

## Global dan lokal berbeda versi

Kode repository:

```cmd
node .\bin\ytconv.js --version
```

Instalasi global:

```cmd
ytconv.cmd --version
where ytconv
```

PowerShell:

```powershell
Get-Command ytconv -All
```

## Data yang perlu dilampirkan saat laporan

```sh
ytconv --version
ytconv --self-test
ytconv --diagnose
ytconv --shell-info
```

Tambahkan sistem operasi, shell, command yang dipakai, dan pesan error. Jangan kirim cookies, token, password proxy, atau link privat tanpa sensor.
