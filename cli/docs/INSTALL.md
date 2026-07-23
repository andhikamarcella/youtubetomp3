# Instalasi lengkap YTConv 1.3.0

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

## Windows CMD

Instalasi publik:

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@1.3.0 --force
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
npm.cmd install -g ytconv@1.3.0 --force
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

```sh
sh ./scripts/install-unix.sh
```

Lihat rencana tanpa perubahan:

```sh
sh ./scripts/install-unix.sh --print-plan
```

Installer mendukung keluarga apt, dnf, pacman, zypper, apk, xbps, emerge, Nix, dan Homebrew. Dependency OS mungkin meminta sudo, tetapi npm dipasang ke `~/.local` tanpa `sudo npm install -g`.

Setelah selesai:

```sh
export PATH="$HOME/.local/bin:$PATH"
ytconv --version
ytconv --self-test
ytconv doctor
```

Panduan per distro: [LINUX.md](LINUX.md).

## macOS

```sh
brew install node python ffmpeg
sh ./scripts/install-unix.sh
```

## Android Termux

Gunakan Termux dari sumber yang masih dipelihara.

```sh
pkg update
pkg install -y nodejs python ffmpeg
termux-setup-storage
python -m pip install -U --no-cache-dir yt-dlp gallery-dl
npm uninstall -g ytconv
npm install -g ytconv@1.3.0 --omit=optional --force
ytconv repair
ytconv --self-test
```

Hasil default:

```text
~/storage/downloads/YTConv
```

Jika izin penyimpanan belum muncul, setujui dialog Android lalu jalankan ulang `termux-setup-storage`.

## iPhone/iPad dengan iSH

iSH menggunakan frontend Python native agar tidak tergantung TUI Node modern.

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

Hasil berada di `~/Downloads/YTConv` dan dapat dibuka lewat Files → iSH.

## SSH/server tanpa TUI

```sh
npm install -g ytconv@1.3.0 --force
ytconv --headless "LINK"
```

Batch:

```sh
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

## npx

```sh
npx -y ytconv@1.3.0 --help
npx -y ytconv@1.3.0 download "LINK"
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

## Update

```sh
npm install -g ytconv@latest --force
```

Atau:

```sh
ytconv update
```

Update yang gagal tidak menghapus versi lama dan tidak memblokir aplikasi.

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

Hasil download tidak dihapus saat uninstall.

## Verifikasi akhir

```sh
ytconv --version
ytconv --self-test
ytconv doctor
ytconv --shell-info
ytconv --examples
```

Tidak semua kombinasi distro, arsitektur, browser, dan situs dapat dijamin. Gunakan doctor dan shell-info ketika lingkungan berbeda dari matriks CI.
