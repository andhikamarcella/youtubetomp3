# YTConv 1.5.0 Beta

Versi npm: `1.5.0-beta.1`

Rilis beta ini menguji tiga default baru sebelum dipertimbangkan untuk rilis stabil:

- subtitle aktif otomatis untuk mode video;
- SponsorBlock aktif otomatis dengan mode `mark`;
- archive anti-duplikat aktif otomatis untuk yt-dlp dan gallery-dl.

## Mengapa SponsorBlock memakai `mark`

Mode `mark` menambahkan chapter/penanda untuk segmen yang tersedia tanpa langsung memotong isi media. Ini lebih aman sebagai default daripada `remove`. Pengguna yang memang ingin menghapus segmen dapat menjalankan:

```bash
ytconv download "LINK" --sponsorblock remove
```

SponsorBlock terutama berguna pada YouTube. Situs lain mungkin tidak memiliki data segmen dan download tetap dilanjutkan.

## Archive otomatis

YTConv membuat archive di:

```text
~/.ytconv/archives/
```

Archive dipisahkan menurut profil agar download audio dan video tidak saling menghalangi. Contoh:

```text
yt-dlp-audio-mp3-320.txt
yt-dlp-video-mp4-1080.txt
gallery-dl-auto-balanced.sqlite3
```

Archive yt-dlp berbentuk file teks ID. Archive gallery-dl berbentuk database SQLite. Kedua format tidak digabungkan dalam satu file.

Lokasi archive dapat dilihat melalui:

```bash
ytconv doctor
```

Archive khusus tetap bisa dipilih:

```bash
ytconv playlist "LINK" --archive downloaded.txt
```

Untuk gallery-dl, YTConv membuat pasangan archive `downloaded.txt.gallery.sqlite3` agar file teks yt-dlp tidak tercampur dengan database gallery-dl.

## Mematikan default

```bash
ytconv download "LINK" --no-subtitles
ytconv download "LINK" --no-sponsorblock
ytconv download "LINK" --no-archive
```

Ketiganya sekaligus:

```bash
ytconv download "LINK" --no-subtitles --no-sponsorblock --no-archive
```

Opsi lama tetap berlaku:

```bash
ytconv download "LINK" --subtitle-langs "id,en"
ytconv download "LINK" --sponsorblock off
ytconv download "LINK" --sponsorblock remove
ytconv download "LINK" --archive "D:\\YTConv\\downloaded.txt"
```

## Instalasi beta

Jangan memakai `ytconv@latest`, karena tag tersebut tetap untuk versi stabil.

### CMD

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
ytconv.cmd --version
ytconv.cmd doctor
```

### PowerShell

```powershell
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
ytconv.cmd --version
ytconv.cmd doctor
```

### Linux, macOS, SSH

```bash
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@beta --force
ytconv --version
ytconv doctor
```

### Termux

```bash
pkg install -y nodejs python ffmpeg
python -m pip install -U yt-dlp gallery-dl
npm install -g ytconv@beta --omit=optional --force
ytconv doctor
```

### iSH

```sh
curl -fsSL https://raw.githubusercontent.com/andhikamarcella/youtubetomp3/codex/add-ytconv-cli/cli/scripts/install-ish.sh -o /tmp/ytconv-ish.sh
sh /tmp/ytconv-ish.sh
ytconv --version
ytconv doctor
```

## Publish beta

Periksa versi lokal:

```bash
node -p "require('./package.json').version"
```

Harus menampilkan:

```text
1.5.0-beta.1
```

Periksa bahwa nomor belum dipakai:

```bash
npm view ytconv versions --json
npm view ytconv dist-tags --json
npm publish --dry-run
```

Publish dengan tag beta:

```bash
npm publish --tag beta --access public
```

Verifikasi:

```bash
npm view ytconv@beta version --prefer-online
npm view ytconv dist-tags --json
```

Tag `latest` tidak boleh berubah akibat publish beta.

## Hal yang perlu diuji

- video dengan subtitle manual;
- video yang hanya memiliki subtitle otomatis;
- video tanpa subtitle;
- YouTube dengan data SponsorBlock;
- situs tanpa data SponsorBlock;
- download yang sama dua kali untuk memastikan archive melewati duplikat;
- audio dan video dari ID yang sama untuk memastikan archive profil terpisah;
- carousel/gallery yang sama dua kali;
- opt-out `--no-subtitles`, `--no-sponsorblock`, dan `--no-archive`;
- CMD, PowerShell, Linux/macOS, SSH, Termux, dan iSH.

Beta tidak menjamin semua situs atau semua perangkat selalu berhasil. DRM, paywall, akses privat tanpa izin, region lock, post terhapus, perubahan API, dan HTTP 429 tetap dapat menyebabkan kegagalan.
