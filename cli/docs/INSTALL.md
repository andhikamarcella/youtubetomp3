# Instalasi lengkap YTConv 1.5.0 Beta

Versi npm: `1.5.0-beta.1`

Gunakan dist-tag `beta`. Jangan memakai `@latest` untuk memasang prerelease ini.

## Persyaratan

- Node.js 18 atau lebih baru untuk paket npm.
- npm.
- FFmpeg untuk merge, konversi, cover, subtitle, dan clipping.
- Python 3 disarankan sebagai fallback yt-dlp/gallery-dl.
- Koneksi HTTPS dan sertifikat CA yang benar.

Periksa:

```sh
node --version
npm --version
ffmpeg -version
```

## Default beta

Setelah instalasi:

```text
subtitle       ON untuk video
SponsorBlock   ON mode mark
archive        ON per profil
```

Matikan per proses dengan:

```text
--no-subtitles --no-sponsorblock --no-archive
```

## Windows CMD

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
where ytconv
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

Installer repository:

```cmd
cd C:\path\ke\youtubetomp3\cli
scripts\install-windows.cmd --local
```

## Windows PowerShell

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
Get-Command ytconv -All
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

Installer repository:

```powershell
cd C:\path\ke\youtubetomp3\cli
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1 -Local
```

Gunakan `ytconv.cmd` bila PowerShell menolak shim `ytconv.ps1`. Opsi permanen untuk akun sendiri:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Linux universal

Dari source repository:

```sh
sh ./scripts/install-unix.sh
```

Lihat rencana tanpa perubahan:

```sh
sh ./scripts/install-unix.sh --print-plan
```

Installer mendukung keluarga apt, dnf, pacman, zypper, apk, xbps, emerge, Nix, dan Homebrew. Dependency OS mungkin meminta sudo, tetapi npm dipasang ke `~/.local` tanpa `sudo npm install -g`.

Instalasi langsung dari npm:

```sh
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@beta --force
ytconv --version
ytconv --self-test
ytconv doctor
```

Panduan per distro: [LINUX.md](LINUX.md).

## macOS

```sh
brew install node python ffmpeg
npm install -g ytconv@beta --force
ytconv doctor
```

Atau jalankan `sh ./scripts/install-unix.sh` dari source.

## Android Termux

Gunakan Termux dari sumber yang masih dipelihara.

```sh
pkg update
pkg install -y nodejs python ffmpeg
termux-setup-storage
python -m pip install -U --no-cache-dir yt-dlp gallery-dl
npm uninstall -g ytconv
npm install -g ytconv@beta --omit=optional --force
ytconv repair
ytconv --self-test
ytconv doctor
```

Installer source:

```sh
sh ./scripts/install-termux.sh
```

Hasil default:

```text
~/storage/downloads/YTConv
```

## iPhone/iPad dengan iSH

iSH menggunakan frontend Python native beta agar tidak tergantung TUI Node modern.

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/codex/add-ytconv-cli/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
```

Periksa:

```sh
ytconv --version
ytconv doctor
ytconv repair
```

Hasil berada di `~/Downloads/YTConv` dan dapat dibuka melalui Files → iSH.

## SSH/server tanpa TUI

```sh
npm install -g ytconv@beta --force
ytconv --headless "LINK"
```

Batch:

```sh
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

## npx

```sh
npx -y ytconv@beta --help
npx -y ytconv@beta download "LINK"
```

## Instalasi source lokal sebelum publish

```sh
git switch codex/add-ytconv-cli
git pull --ff-only origin codex/add-ytconv-cli
cd cli
npm install
npm run check
npm test
npm install -g . --force
ytconv --version
```

PowerShell:

```powershell
npm.cmd install
npm.cmd run check
npm.cmd test
npm.cmd install -g . --force
ytconv.cmd --version
```

## Update beta

```sh
npm install -g ytconv@beta --force
```

Atau:

```sh
ytconv update
```

Updater prerelease mengikuti channel `beta`. Update yang gagal tidak menghapus versi lama dan tidak memblokir aplikasi.

## Pindah kembali ke stabil

```sh
npm uninstall -g ytconv
npm install -g ytconv@latest --force
```

## Uninstall

CMD/PowerShell:

```cmd
npm.cmd uninstall -g ytconv
where ytconv
```

Linux/macOS/Termux:

```sh
npm uninstall -g ytconv
command -v ytconv || true
```

iSH native:

```sh
rm -f /usr/local/bin/ytconv
rm -rf /usr/local/lib/ytconv-ish
```

Hasil download dan archive tidak dihapus otomatis saat uninstall.

## Verifikasi akhir

```sh
ytconv --version
ytconv --self-test
ytconv doctor
ytconv --shell-info
ytconv --examples
```

Versi harus `1.5.0-beta.1`. Doctor harus menunjukkan subtitle ON, SponsorBlock mark, serta archive yt-dlp dan gallery-dl.

Tidak semua kombinasi distro, arsitektur, browser, dan situs dapat dijamin. Gunakan doctor dan shell-info ketika lingkungan berbeda dari matriks CI.
