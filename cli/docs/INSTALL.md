# Instalasi lengkap YTConv 1.2.3

## Syarat umum

- Node.js 18 atau lebih baru untuk paket npm.
- Internet untuk instalasi dan update engine.
- Ruang penyimpanan untuk media hasil.
- FFmpeg diperlukan untuk merge video, ekstraksi audio, cover, thumbnail, subtitle, dan konversi.

## Windows CMD

1. Pasang Node.js LTS.
2. Tutup CMD lama dan buka CMD baru.
3. Jalankan:

```cmd
node --version
npm.cmd --version
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@1.2.3 --force
ytconv.cmd --version
ytconv.cmd --repair
ytconv.cmd --self-test
```

4. Buka aplikasi:

```cmd
ytconv.cmd
```

Installer dari repository:

```cmd
cd C:\Users\andhi\youtubetomp3\cli
scripts\install-windows.cmd
```

## Windows PowerShell

```powershell
node --version
npm.cmd --version
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@1.2.3 --force
ytconv.cmd --version
ytconv.cmd --repair
ytconv.cmd --self-test
```

Installer repository:

```powershell
cd C:\Users\andhi\youtubetomp3\cli
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

PowerShell error `running scripts is disabled`:

```powershell
ytconv.cmd --version
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Periksa semua shim:

```powershell
Get-Command ytconv -All
Get-Command npm -All
```

## Termux

Gunakan Termux dari F-Droid atau GitHub Releases.

```sh
pkg update
pkg upgrade -y
pkg install -y nodejs python ffmpeg
termux-setup-storage
python -m pip install -U --no-cache-dir yt-dlp gallery-dl
npm uninstall -g ytconv || true
npm install -g ytconv@1.2.3 --omit=optional --force
ytconv --repair
ytconv --self-test
ytconv --diagnose
```

Installer repository:

```sh
sh scripts/install-termux.sh
```

Hasil default:

```text
/storage/emulated/0/Download/YTConv
```

## Linux/macOS/SSH

```sh
node --version
npm --version
npm install -g ytconv@1.2.3 --force
ytconv --repair
ytconv --self-test
```

Installer repository:

```sh
sh scripts/install-unix.sh
```

Untuk server tanpa tampilan:

```sh
ytconv --headless "LINK"
```

Bila global npm tidak dapat ditulis, jangan langsung memakai `sudo npm`. Gunakan npx:

```sh
npx -y ytconv@1.2.3 --headless "LINK"
```

Atau atur prefix akun:

```sh
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
printf '\nexport PATH="$HOME/.npm-global/bin:$PATH"\n' >> "$HOME/.profile"
. "$HOME/.profile"
npm install -g ytconv@1.2.3
```

## iSH iPhone/iPad

iSH memakai frontend Python native, bukan paket npm/Ink.

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/codex/add-ytconv-cli/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
ytconv --repair
ytconv --diagnose
```

Hasil:

```text
Files → iSH → root → Downloads → YTConv
```

## Instalasi dari branch GitHub sebelum publish

CMD:

```cmd
cd C:\Users\andhi\youtubetomp3
git switch codex/add-ytconv-cli
git pull --ff-only origin codex/add-ytconv-cli
cd cli
npm install
npm run check
npm test
npm install -g . --force
ytconv.cmd --version
```

PowerShell memakai perintah yang sama, tetapi panggil `npm.cmd` dan `ytconv.cmd` bila shim `.ps1` diblokir.
