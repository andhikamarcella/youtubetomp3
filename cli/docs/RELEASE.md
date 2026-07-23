# Checklist rilis YTConv 1.3.0

## 1. Sinkronkan branch

```sh
git switch codex/add-ytconv-cli
git pull --ff-only origin codex/add-ytconv-cli
cd cli
git status --short
```

Simpan perubahan lokal dengan stash sebelum pull bila diperlukan.

## 2. Verifikasi versi

```sh
node -p "require('./package.json').version"
node ./bin/ytconv.js --version
python3 ./ish/ytconv.py --version
cat ish/VERSION
```

Semuanya harus menampilkan `1.3.0`.

## 3. Instal dan test

```sh
npm install
npm run check
npm test
npm run check:ish
npm run test:ish
```

## 4. Smoke test command

```sh
node ./bin/ytconv.js --help
node ./bin/ytconv.js --examples
node ./bin/ytconv.js --list-presets
node ./bin/ytconv.js --shell-info
node ./bin/ytconv.js --self-test
node ./bin/ytconv.js doctor
```

Uji parser tanpa download:

```sh
node ./bin/ytconv.js info "LINK_YANG_SAH" --json
node ./bin/ytconv.js formats "LINK_YANG_SAH" --json
node ./bin/ytconv.js subtitles "LINK_YANG_SAH"
```

## 5. Uji fitur media nyata

Gunakan media milik sendiri atau media yang diizinkan:

```sh
node ./bin/ytconv.js download "LINK_VIDEO" --preset mobile
node ./bin/ytconv.js download "LINK_MUSIC" --preset music
node ./bin/ytconv.js playlist "LINK_PLAYLIST" --playlist-items "1-2" --archive downloaded.txt
node ./bin/ytconv.js batch links.txt --jobs 2 --continue-on-error --result-json report.json
node ./bin/ytconv.js download "LINK" --subtitle-only --subtitle-langs "id,en"
```

Periksa:

- progress, ETA, speed, dan ukuran tidak merusak output;
- resume melanjutkan `.part`;
- archive melewati item lama;
- metadata manual tertanam;
- MP3 mempunyai JPG terpisah dan cover;
- YouTube Music crop persegi;
- JSON valid;
- batch report mencatat sukses/gagal;
- exit code sesuai.

## 6. CI wajib hijau

GitHub Actions harus berhasil untuk:

- Node 18, 20, dan 22;
- Windows CMD;
- Windows PowerShell;
- Ubuntu/Linux penuh;
- macOS;
- Alpine/musl dengan FFmpeg sistem;
- SSH/headless;
- Termux package simulation;
- frontend native iSH;
- installer plan Debian/Ubuntu, Fedora, Arch/CachyOS-family, openSUSE, Alpine, Void, Gentoo, dan NixOS;
- npm package preview dan seluruh dokumentasi.

## 7. Preview paket npm

```sh
npm publish --dry-run
npm pack --json > package-preview.json
```

Cari:

```text
name: ytconv
version: 1.3.0
```

Paket harus memuat `bin`, `src`, `scripts`, `ish`, `docs`, README, changelog, dan license. Paket tidak boleh memuat cookies, `.env`, log pribadi, hasil download, token, atau file rahasia.

## 8. Pastikan versi belum terbit

```sh
npm view ytconv versions --json
npm view ytconv version --prefer-online
```

`1.3.0` tidak boleh sudah ada. npm tidak mengizinkan versi terbit ditimpa.

## 9. Login dan ownership

```sh
npm whoami
npm owner ls ytconv
```

## 10A. Publish manual dari CMD/PowerShell

```cmd
npm.cmd publish --access public
```

Dengan OTP:

```cmd
npm.cmd publish --access public --otp=123456
```

Publish manual tidak otomatis menghasilkan provenance GitHub Actions.

## 10B. Publish dengan npm provenance

Gunakan workflow manual `.github/workflows/publish-ytconv.yml` setelah konfigurasi npm trusted publishing atau secret `NPM_TOKEN` selesai. Workflow memakai OIDC `id-token: write`, memeriksa versi, menjalankan test, lalu:

```sh
npm publish --access public --provenance
```

Jangan menjalankan workflow publish sebelum seluruh CI hijau dan nomor versi dipastikan belum terbit.

## 11. Verifikasi registry

```sh
npm view ytconv version --prefer-online
npm view ytconv@1.3.0 dist.integrity
npm view ytconv@1.3.0 repository
```

Versi latest harus `1.3.0`.

## 12. Tes paket publik bersih

Windows:

```cmd
npm.cmd uninstall -g ytconv
npm.cmd cache verify
npm.cmd install -g ytconv@1.3.0 --force
ytconv.cmd --version
ytconv.cmd --self-test
ytconv.cmd doctor
```

Linux/macOS:

```sh
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@1.3.0 --force
ytconv --version
ytconv --self-test
ytconv doctor
```

Termux:

```sh
npm install -g ytconv@1.3.0 --omit=optional --force
ytconv --self-test
```

## 13. Setelah publish

- Jangan mencoba memublikasikan ulang `1.3.0`.
- Perbaikan berikutnya memakai `1.3.1` atau versi baru sesuai Semantic Versioning.
- Jangan merge PR #145 sampai paket publik diuji dan pengguna secara eksplisit meminta merge.
- Catat masalah link yang berasal dari DRM, paywall, akses privat, region lock, atau perubahan situs sebagai batasan eksternal, bukan janji palsu bahwa semua link pasti berhasil.
