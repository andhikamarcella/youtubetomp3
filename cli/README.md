# YTConv CLI 1.5.0 Beta

Versi npm: **`1.5.0-beta.1`**

YTConv adalah downloader dan converter media sosial untuk CMD, PowerShell, Linux, macOS, SSH/headless, Android Termux, dan iPhone/iPad melalui frontend native iSH. YTConv memakai **yt-dlp**, **gallery-dl**, dan **FFmpeg** untuk video, audio, gambar, carousel, Story, Reel, post campuran, serta playlist.

> Gunakan hanya untuk media milik sendiri, berlisensi bebas, atau yang memang diizinkan untuk diunduh. YTConv tidak melewati DRM, paywall, akun privat tanpa akses, region lock, atau pembatasan hak cipta.

## Default baru pada versi beta

Tiga fitur sekarang aktif otomatis:

- **Subtitle ON** untuk mode video.
- **SponsorBlock ON** dengan mode aman `mark`.
- **Archive anti-duplikat ON** untuk yt-dlp dan gallery-dl.

SponsorBlock `mark` hanya menambahkan chapter/penanda ketika data tersedia. Default ini **tidak memotong media**.

Matikan sesuai kebutuhan:

```bash
ytconv download "LINK" --no-subtitles
ytconv download "LINK" --no-sponsorblock
ytconv download "LINK" --no-archive
```

Ketiganya sekaligus:

```bash
ytconv download "LINK" --no-subtitles --no-sponsorblock --no-archive
```

Archive otomatis disimpan per profil di:

```text
~/.ytconv/archives/
```

Audio, video, dan gallery menggunakan archive terpisah agar format berbeda tidak saling menghalangi. Detail lengkap tersedia di [docs/BETA.md](docs/BETA.md).

## Instalasi beta

Gunakan tag **`beta`**, bukan `latest`.

### Windows CMD

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

### Windows PowerShell

Gunakan shim `.cmd` agar tidak terganggu Execution Policy:

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

### Linux, macOS, dan SSH

```bash
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@beta --force
ytconv --version
ytconv --self-test
ytconv doctor
```

Installer source untuk keluarga apt, dnf, pacman, zypper, apk, xbps, emerge, Nix, dan Homebrew:

```bash
sh ./scripts/install-unix.sh
```

### Android Termux

```bash
pkg update
pkg install -y nodejs python ffmpeg
termux-setup-storage
python -m pip install -U yt-dlp gallery-dl
npm install -g ytconv@beta --omit=optional --force
ytconv repair
ytconv doctor
```

Hasil default: `~/storage/downloads/YTConv`.

### iPhone/iPad melalui iSH

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/codex/add-ytconv-cli/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
ytconv doctor
```

Hasil default: `~/Downloads/YTConv`.

### Tanpa instalasi global

```bash
npx -y ytconv@beta --help
npx -y ytconv@beta download "LINK"
```

## Command utama

```bash
ytconv download "LINK"
ytconv playlist "LINK_PLAYLIST"
ytconv batch links.txt
ytconv info "LINK"
ytconv formats "LINK"
ytconv subtitles "LINK"
ytconv doctor
ytconv repair
ytconv clean
```

Sintaks lama tetap didukung:

```bash
ytconv "LINK" --preset music
```

## Subtitle

Subtitle manual dan otomatis dicoba, dikonversi ke SRT, lalu ditanam bila container mendukungnya:

```bash
ytconv download "LINK"
ytconv download "LINK" --subtitle-langs "id,en"
ytconv download "LINK" --subtitle-only --subtitle-langs "id,en"
```

Matikan untuk satu download:

```bash
ytconv download "LINK" --no-subtitles
```

Tidak semua video memiliki subtitle. Ketiadaan subtitle tidak seharusnya menggagalkan download media utama.

## SponsorBlock

Default aman:

```bash
ytconv download "LINK"
```

Setara dengan mode `mark`.

Hapus segmen secara eksplisit:

```bash
ytconv download "LINK" --sponsorblock remove
```

Matikan:

```bash
ytconv download "LINK" --no-sponsorblock
```

SponsorBlock terutama tersedia untuk YouTube. Situs lain mungkin tidak memiliki data segmen.

## Archive anti-duplikat

Archive otomatis aktif. Download media yang sama dengan profil yang sama akan dilewati.

Archive khusus:

```bash
ytconv playlist "LINK" --archive downloaded.txt
```

Matikan:

```bash
ytconv download "LINK" --no-archive
```

Untuk archive khusus, YTConv memakai:

```text
downloaded.txt
```

untuk yt-dlp dan:

```text
downloaded.txt.gallery.sqlite3
```

untuk gallery-dl. File tersebut tidak boleh digabung karena formatnya berbeda.

## Playlist dan batch

```bash
ytconv playlist "LINK"
ytconv playlist "LINK" --playlist-items "1-10"
ytconv playlist "LINK" --max-downloads 25 --skip-playlist-after-errors 5
ytconv batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

## Retry dan resume

```bash
ytconv download "LINK" \
  --retries 20 \
  --fragment-retries 30 \
  --file-access-retries 5 \
  --retry-sleep "linear=1:10:2" \
  --resume
```

Resume aktif secara default. Matikan dengan `--no-resume`.

## Format dan kualitas

```bash
ytconv formats "LINK"
ytconv formats "LINK" --json
ytconv info "LINK" --json
ytconv download "LINK" --format mp3 --quality 192
ytconv download "LINK" --format mp4 --quality 1080p
```

MP3 320 kbps adalah target encoder dan tidak meningkatkan detail di atas sumber.

## Metadata dan cover

```bash
ytconv download "LINK" --preset music
ytconv download "LINK" --metadata --thumbnail --metadata-files
ytconv download "LINK" --format mp3 \
  --artist "Nama Artis" \
  --title "Judul Lagu" \
  --album "Nama Album" \
  --track 3 \
  --year 2026 \
  --genre "Pop"
```

MP3 menyimpan thumbnail JPG terpisah dan embedded cover. YouTube Music memakai crop persegi 1:1.

## Cookies dan login

```bash
ytconv download "LINK" --cookies cookies.txt
ytconv download "LINK" --cookies-from-browser chrome
ytconv download "LINK" --cookies-from-browser "firefox:default-release"
```

Cookies adalah kredensial sensitif. Jangan membagikannya melalui chat, screenshot, log, atau issue publik.

## Potong durasi

```bash
ytconv download "LINK" --from 00:01:20 --to 00:03:45
```

## SSH dan automasi

```bash
ytconv --headless "LINK"
printf '%s\n' "LINK1" "LINK2" | ytconv --stdin --jobs 2 --continue-on-error
ytconv info "LINK" --json
```

## Diagnosis

```bash
ytconv doctor
ytconv repair
ytconv --self-test
ytconv --shell-info
ytconv clean
```

Doctor menampilkan status subtitle, SponsorBlock, archive yt-dlp, archive gallery-dl, dependency, distro, dan folder output.

## Publish beta

```bash
node -p "require('./package.json').version"
npm view ytconv versions --json
npm publish --dry-run
npm publish --tag beta --access public
npm view ytconv@beta version --prefer-online
npm view ytconv dist-tags --json
```

Publish beta tidak boleh mengubah dist-tag `latest`.

## Dokumentasi

- [Default dan pengujian beta](docs/BETA.md)
- [Instalasi lengkap](docs/INSTALL.md)
- [Linux dan macOS](docs/LINUX.md)
- [CMD, PowerShell, SSH, Termux, dan iSH](docs/SHELLS.md)
- [Seluruh command](docs/COMMANDS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Checklist rilis](docs/RELEASE.md)
- [Changelog](CHANGELOG.md)

## Dukungan dan batasan

Tidak ada downloader yang dapat menjamin semua link, distro, arsitektur, dan perangkat selalu berhasil. Situs dapat mengubah API, meminta login, memblokir wilayah, menghapus post, memberi HTTP 429, atau memakai DRM. YTConv memperkuat fallback, retry, repair, diagnosis, dan pesan error, tetapi tidak menerobos akses yang tidak tersedia secara teknis atau hukum.

## Lisensi

MIT. yt-dlp, gallery-dl, FFmpeg, dan dependency lain memiliki lisensi masing-masing.
