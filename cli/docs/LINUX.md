# YTConv 1.3.0 di berbagai distro Linux

YTConv membutuhkan Node.js 18 atau lebih baru. Python 3 dan FFmpeg sangat disarankan; yt-dlp dan gallery-dl dapat memakai executable bundled, executable PATH, atau modul Python yang valid.

Installer universal:

```sh
sh ./scripts/install-unix.sh
```

Untuk hanya melihat rencana tanpa mengubah sistem:

```sh
sh ./scripts/install-unix.sh --print-plan
```

Installer memasang dependency sistem dengan hak administrator bila diperlukan, tetapi memasang paket npm ke `~/.local` milik pengguna. Installer **tidak** menjalankan `sudo npm install -g`.

## Debian, Ubuntu, Linux Mint, Pop!_OS, Kali, KDE neon

```sh
sudo apt-get update
sudo apt-get install -y nodejs npm python3 python3-pip ffmpeg
sh ./scripts/install-unix.sh
```

Periksa versi Node:

```sh
node --version
```

Bila lebih lama dari 18, gunakan paket Node.js resmi distro yang lebih baru atau version manager tepercaya.

## Fedora, RHEL, CentOS Stream, Rocky Linux, AlmaLinux, Nobara

```sh
sudo dnf install -y nodejs npm python3 python3-pip ffmpeg
sh ./scripts/install-unix.sh
```

Pada sebagian turunan RHEL, FFmpeg mungkin memerlukan repository multimedia yang memang dipilih pengguna. YTConv tidak mengaktifkan repository pihak ketiga secara otomatis.

## Arch Linux, Manjaro, EndeavourOS, CachyOS, Garuda

```sh
sudo pacman -Syu --needed nodejs npm python python-pip ffmpeg
sh ./scripts/install-unix.sh
```

CachyOS dan turunannya dideteksi sebagai keluarga Arch/pacman.

## openSUSE Leap dan Tumbleweed

```sh
sudo zypper --non-interactive install nodejs npm python3 python3-pip ffmpeg
sh ./scripts/install-unix.sh
```

## Alpine Linux

```sh
sudo apk add --no-cache nodejs npm python3 py3-pip ffmpeg
python3 -m pip install --user --break-system-packages -U yt-dlp gallery-dl
sh ./scripts/install-unix.sh
```

Alpine memakai musl, sehingga binary FFmpeg statis glibc tertentu mungkin tidak dapat dijalankan. YTConv 1.3.0 memvalidasi binary dan menggunakan FFmpeg sistem bila binary bundled tidak kompatibel.

## Void Linux

```sh
sudo xbps-install -Sy nodejs npm python3 python3-pip ffmpeg
sh ./scripts/install-unix.sh
```

## Gentoo

```sh
sudo emerge --ask=n net-libs/nodejs dev-lang/python media-video/ffmpeg
python3 -m pip install --user -U yt-dlp gallery-dl
sh ./scripts/install-unix.sh
```

## NixOS atau Nix profile

```sh
nix profile install nixpkgs#nodejs_22 nixpkgs#python3 nixpkgs#ffmpeg
sh ./scripts/install-unix.sh
```

Engine Python dapat dipasang melalui environment Nix yang sesuai. YTConv tidak mengubah konfigurasi sistem NixOS secara otomatis.

## macOS dengan Homebrew

```sh
brew install node python ffmpeg
sh ./scripts/install-unix.sh
```

## Setelah instalasi

```sh
ytconv --version
ytconv --self-test
ytconv doctor
ytconv --shell-info
```

Bila `ytconv` belum ditemukan:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

Tambahkan baris tersebut ke `~/.profile`, `~/.bashrc`, atau `~/.zshrc` sesuai shell.

## SSH, server, cron, dan container

Gunakan mode noninteraktif:

```sh
ytconv --headless "LINK"
```

Batch:

```sh
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

Pipe:

```sh
printf '%s\n' "LINK1" "LINK2" | ytconv --stdin --jobs 2 --continue-on-error
```

Untuk cron, tulis path lengkap ke executable dan folder output. Hindari cookies browser interaktif; gunakan file cookies Netscape dengan izin file yang ketat bila akses tersebut memang sah.

## Container dan distro yang belum terdaftar

YTConv umumnya dapat berjalan bila tersedia:

- Node.js 18+;
- npm;
- Python 3;
- FFmpeg;
- koneksi HTTPS dan sertifikat CA.

Jalankan:

```sh
ytconv --shell-info
ytconv doctor
```

Tidak mungkin menjamin setiap distro, arsitektur, dan link situs tanpa pengujian nyata. CI 1.3.0 menguji Windows, Ubuntu/Linux, macOS, Alpine/musl, Termux simulation, iSH syntax, dan rencana installer untuk beberapa keluarga distro utama. DRM, paywall, media privat tanpa akses, region lock, serta perubahan situs tetap berada di luar jaminan YTConv.
