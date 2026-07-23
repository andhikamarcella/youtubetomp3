# Checklist rilis YTConv 1.5.0 Beta

Versi npm: `1.5.0-beta.1`

## 1. Sinkronkan branch

```sh
git switch codex/add-ytconv-cli
git pull --ff-only origin codex/add-ytconv-cli
cd cli
git status --short
```

Simpan perubahan lokal dengan stash sebelum pull bila diperlukan.

## 2. Verifikasi versi dan dist-tag

```sh
node -p "require('./package.json').version"
node -p "require('./package.json').publishConfig.tag"
node ./bin/ytconv.js --version
python3 ./ish/ytconv-beta.py --version
cat ish/VERSION
```

Hasil wajib:

```text
1.5.0-beta.1
beta
```

`publishConfig.tag` harus `beta` agar prerelease tidak menggantikan `latest`.

## 3. Instal dan test

```sh
npm install
npm run check
npm test
npm run check:ish
npm run test:ish
```

## 4. Verifikasi default beta

```sh
node ./bin/ytconv.js --help
node ./bin/ytconv.js --self-test
node ./bin/ytconv.js doctor
```

Pastikan help/doctor menunjukkan:

```text
subtitle ON
SponsorBlock ON mode mark
archive ON
```

Pastikan opt-out tersedia:

```text
--no-subtitles
--no-sponsorblock
--no-archive
```

## 5. Uji cache tanpa menghapus archive

Buat satu archive uji di `~/.ytconv/archives`, jalankan:

```sh
node ./bin/ytconv.js clean
```

File archive harus tetap ada. Hanya cache update/error yang boleh dihapus.

## 6. Smoke test command

```sh
node ./bin/ytconv.js --examples
node ./bin/ytconv.js --list-presets
node ./bin/ytconv.js --shell-info
node ./bin/ytconv.js info "LINK_YANG_SAH" --json
node ./bin/ytconv.js formats "LINK_YANG_SAH" --json
node ./bin/ytconv.js subtitles "LINK_YANG_SAH"
```

## 7. Uji fitur media nyata

Gunakan media milik sendiri atau media yang diizinkan.

### Subtitle default

```sh
node ./bin/ytconv.js download "LINK_VIDEO"
node ./bin/ytconv.js download "LINK_VIDEO" --no-subtitles
```

Periksa video dengan subtitle manual, subtitle otomatis, dan tanpa subtitle.

### SponsorBlock

```sh
node ./bin/ytconv.js download "LINK_YOUTUBE"
node ./bin/ytconv.js download "LINK_YOUTUBE" --sponsorblock remove
node ./bin/ytconv.js download "LINK_YOUTUBE" --no-sponsorblock
```

Default `mark` tidak boleh memotong media. Situs tanpa data SponsorBlock harus tetap dapat diproses.

### Archive

```sh
node ./bin/ytconv.js download "LINK" --preset music
node ./bin/ytconv.js download "LINK" --preset music
node ./bin/ytconv.js download "LINK" --video-format mp4 --resolution 1080
node ./bin/ytconv.js download "LINK" --no-archive
```

Periksa:

- download kedua dengan profil yang sama dilewati;
- audio dan video memakai archive berbeda;
- archive yt-dlp berbentuk file teks;
- archive gallery-dl memakai file terpisah;
- `--no-archive` benar-benar mengizinkan proses tanpa pencatatan archive.

### Playlist dan batch

```sh
node ./bin/ytconv.js playlist "LINK_PLAYLIST" --playlist-items "1-2"
node ./bin/ytconv.js batch links.txt --jobs 2 --continue-on-error --result-json report.json
```

## 8. CI wajib hijau

GitHub Actions harus berhasil untuk:

- Node 18, 20, dan 22;
- Windows CMD;
- Windows PowerShell;
- Ubuntu/Linux penuh;
- macOS;
- Alpine/musl;
- SSH/headless;
- Termux package simulation;
- frontend native iSH beta;
- installer plan Debian/Ubuntu, Fedora, Arch/CachyOS-family, openSUSE, Alpine, Void, Gentoo, dan NixOS;
- npm package preview dan dokumentasi beta.

## 9. Preview paket npm

```sh
npm publish --dry-run
npm pack --json > package-preview.json
```

Preview wajib menunjukkan:

```text
name: ytconv
version: 1.5.0-beta.1
tag: beta
```

Paket harus memuat:

```text
src/beta-defaults.js
src/gallery-beta.js
ish/ytconv-beta.py
docs/BETA.md
```

Paket tidak boleh memuat cookies, `.env`, log pribadi, hasil download, token, atau file rahasia.

## 10. Pastikan versi belum terbit

```sh
npm view ytconv versions --json
npm view ytconv dist-tags --json
npm view ytconv@beta version --prefer-online
```

`1.5.0-beta.1` tidak boleh sudah ada. npm tidak mengizinkan versi terbit ditimpa.

Catat nilai dist-tag `latest` sebelum publish; nilainya tidak boleh berubah setelah publish beta.

## 11. Login dan ownership

```sh
npm whoami
npm owner ls ytconv
```

## 12. Publish beta manual

CMD/PowerShell:

```cmd
npm.cmd publish --tag beta --access public
```

Dengan OTP:

```cmd
npm.cmd publish --tag beta --access public --otp=123456
```

Linux/macOS:

```sh
npm publish --tag beta --access public
```

Jangan publish prerelease ini dengan tag `latest`.

## 13. Verifikasi registry

```sh
npm view ytconv@beta version --prefer-online
npm view ytconv@1.5.0-beta.1 dist.integrity
npm view ytconv dist-tags --json
```

Hasil beta harus `1.5.0-beta.1`. Dist-tag `latest` harus tetap menunjuk rilis stabil sebelumnya.

## 14. Tes paket publik bersih

Windows:

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@beta --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

Linux/macOS:

```sh
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@beta --force
ytconv --version
ytconv --self-test
ytconv doctor
```

Termux:

```sh
npm install -g ytconv@beta --omit=optional --force
ytconv --self-test
ytconv doctor
```

## 15. Setelah publish

- Jangan mencoba memublikasikan ulang `1.5.0-beta.1`.
- Perbaikan beta berikutnya memakai `1.5.0-beta.2`.
- Rilis stabil berikutnya hanya boleh memakai `1.5.0` setelah pengujian beta selesai.
- Jangan merge PR #145 sampai paket publik diuji dan pengguna secara eksplisit meminta merge.
- DRM, paywall, akses privat tanpa izin, region lock, post terhapus, dan perubahan situs tetap merupakan batasan eksternal.
