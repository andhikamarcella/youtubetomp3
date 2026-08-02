# YTConv CLI 1.5.6

YTConv is a cross-platform media downloader and converter for Windows CMD/PowerShell, Linux, macOS, SSH/headless servers, Android Termux, and iPhone/iPad through iSH. It uses **yt-dlp**, **gallery-dl**, and **FFmpeg** for supported video, audio, images, carousels, Stories, Reels, mixed posts, and playlists.

> Download only media that you own, that is openly licensed, or that you are allowed to save. YTConv does not bypass DRM, paywalls, private-account access, regional restrictions, or copyright controls.

## Yang baru di 1.5.6

- FFmpeg, Ink, React, dan library Node lain dipasang otomatis oleh npm; yt-dlp dan gallery-dl disiapkan ketika paket dipasang dan diperiksa lagi saat pertama kali digunakan.
- `ytconv login instagram`, `facebook`, `x`, `tiktok`, `youtube`, `pinterest`, `reddit`, `threads`, `twitch`, dan provider lain membuka halaman login resmi di browser.
- Link yang memerlukan akun otomatis memakai sesi browser yang sudah ditautkan, tanpa ekspor atau unduh `cookies.txt`.
- Password, OTP, dan cookie mentah tetap berada di browser; YTConv hanya menyimpan nama browser/profil dengan izin file khusus pengguna.
- Akun cloud YTConv tidak lagi diwajibkan untuk download. Paket ini benar-benar CLI-only dan tidak bergantung pada deployment web/server.
- Update stable diperiksa dan dipasang otomatis pada terminal interaktif. Script, CI, dan headless tidak diubah diam-diam.
- Pesan error sekarang memberikan penyebab dan perintah solusi yang sesuai dengan platform/link.

## Instal stable 1.5.6

### Windows

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
ytconv.cmd doctor
```

Use `ytconv.cmd` when PowerShell execution policy blocks the generated `ytconv.ps1` shim.

### Linux, macOS, or SSH

```sh
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@latest --force
ytconv --version
ytconv doctor
```

The included `scripts/install-unix.sh` can install the operating-system dependencies on supported package managers without using `sudo npm install -g`.

### Android Termux

```sh
pkg update
pkg install -y nodejs python ffmpeg curl ca-certificates
termux-setup-storage
python -m pip install -U --no-cache-dir yt-dlp gallery-dl
npm install -g ytconv@latest --omit=optional --force
ytconv repair
ytconv doctor
```

Default output: `~/storage/downloads/YTConv`.

### iPhone/iPad through iSH

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/release/ytconv-1.5.6-cli-only-final/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
ytconv doctor
```

The browser can be opened on the same device or another device. Enter the eight-character code shown in the terminal and approve the CLI session.

## Login resmi Instagram/Facebook/X dan media sosial lain

```sh
ytconv login instagram
ytconv login facebook --browser edge
ytconv login x --browser "chrome:Profile 1"
ytconv social status
ytconv logout instagram
```

Alurnya sederhana:

1. YTConv mendeteksi browser yang tersedia dan meminta kamu memilih salah satunya.
2. Halaman login resmi media sosial dibuka. Masukkan password dan OTP hanya di halaman resmi tersebut.
3. Setelah login selesai, kembali ke terminal lalu tekan Enter.
4. YTConv menyimpan provider + browser/profil di `~/.ytconv/social-sessions.json`.
5. Saat link publik gagal karena login diperlukan, sesi browser itu dicoba otomatis.

Cookie sesi tetap berada di database browser dan dilindungi oleh enkripsi browser/OS (misalnya DPAPI di Windows atau Keychain di macOS). YTConv tidak menyimpan password, OTP, access token, maupun nilai cookie mentah, dan tidak mengirim sesi media sosial ke server YTConv.

Jika pembacaan sesi gagal, tutup browser sepenuhnya lalu coba lagi. Firefox sering menjadi pilihan paling kompatibel untuk pembacaan sesi lokal. Termux/iSH tidak boleh mengakses database privat browser Android/iOS; gunakan link publik atau metode resmi yang tersedia di perangkat tersebut.

Akun YTConv cloud bersifat opsional dan tetap tersedia melalui `ytconv account login`.

## Media commands

```sh
ytconv download "URL"
ytconv playlist "PLAYLIST_URL"
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
ytconv info "URL" --json
ytconv formats "URL"
ytconv subtitles "URL"
```

## Persistent configuration and profiles

```sh
ytconv config list
ytconv config set output "$HOME/Downloads/YTConv"
ytconv config set audioQuality 192
ytconv profile set music preset=music audioQuality=320
ytconv profile set phone preset=mobile resolution=720
ytconv profile use phone
ytconv --profile music download "URL"
```

Explicit command-line options override saved defaults. Use `--no-config` for a clean one-run session.

## Default media behavior

```text
Subtitles         enabled for video
SponsorBlock      enabled in non-destructive mark mode
Download archives enabled per output profile
Resume            enabled
```

One-run opt-outs:

```sh
ytconv download "URL" --no-subtitles
ytconv download "URL" --no-sponsorblock
ytconv download "URL" --no-archive
```

SponsorBlock `mark` adds chapter markers; it does not cut the media. Cutting requires the explicit `--sponsorblock remove` option.

## Formats, metadata, cookies, and diagnostics

```sh
ytconv download "URL" --audio-format mp3 --audio-quality 320
ytconv download "URL" --audio-format flac
ytconv download "URL" --video-format mp4 --resolution 1080
ytconv download "URL" --preset music
ytconv download "URL" --metadata --thumbnail --metadata-files
ytconv login instagram
ytconv download "URL_INSTAGRAM"
ytconv download "URL" --cookies-from-browser chrome
ytconv doctor
ytconv repair
ytconv --self-test
ytconv --shell-info
```

Cookies are account credentials. Use them only for media you are authorized to access and never include them in screenshots, logs, issues, or chat messages.

## History and shell completion

```sh
ytconv history
ytconv history --json
ytconv history --limit 50
ytconv history clear
ytconv completion bash
ytconv completion zsh
ytconv completion fish
ytconv completion powershell
```

History is capped and excludes cookies, tokens, proxy credentials, and browser session data.

## Release channels

```text
Stable: 1.5.6          npm install -g ytconv@latest
Beta:   1.6.0-beta.1   npm install -g ytconv@beta
```

The guarded beta workflow preserves the stable npm `latest` tag.

## Documentation

- [Account login and local fallback](docs/AUTH.md)
- [Complete installation guide](docs/INSTALL.md)
- [Linux distribution guide](docs/LINUX.md)
- [Command reference](docs/COMMANDS.md)
- [Shell guide](docs/SHELLS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
