# Checklist rilis YTConv 1.2.1

Dokumen ini adalah checklist final sebelum memublikasikan paket `ytconv@1.2.1` ke npm. Versi ini merupakan hotfix Windows untuk `spawnSync npm.cmd EINVAL`. Jangan menggunakan ulang nomor versi yang sudah pernah terbit.

## 1. Ambil branch final

```bash
git switch codex/add-ytconv-cli
git pull --ff-only origin codex/add-ytconv-cli
cd cli
```

## 2. Pastikan identitas rilis konsisten

```bash
node -p "require('./package.json').version"
node ./bin/ytconv.js --version
```

Keduanya wajib menampilkan:

```text
1.2.1
```

Periksa juga:

- `package.json` versi `1.2.1`;
- `README.md` berjudul YTConv CLI 1.2.1;
- `CHANGELOG.md` memiliki bagian 1.2.1;
- test rilis mengharapkan 1.2.1;
- workflow smoke test mengharapkan 1.2.1;
- PR #145 menyebut Windows updater hotfix 1.2.1;
- frontend native iSH tetap 1.2.0 karena tidak memakai self-updater npm Windows.

## 3. Instal dependency

```bash
npm install
```

Gunakan `npm ci` hanya pada checkout yang memiliki lockfile yang sesuai.

## 4. Jalankan pemeriksaan wajib

```bash
npm run check
npm test
npm run check:ish
npm run test:ish
node ./bin/ytconv.js --help
node ./bin/ytconv.js --list-presets
node ./bin/ytconv.js --diagnose
```

GitHub Actions wajib hijau untuk:

- Node.js 18, 20, dan 22;
- Linux;
- Windows CMD/PowerShell;
- unit test invocation `cmd.exe /d /s /c`;
- frontend native iSH;
- yt-dlp, gallery-dl, dan FFmpeg;
- preview paket npm;
- simulasi instalasi Termux tanpa optional dependency desktop.

## 5. Uji updater tanpa menjalankan publish

```bash
node -e "import('./src/update.js').then(({selfUpdateInvocation}) => console.log(selfUpdateInvocation({platform:'win32', env:{ComSpec:'cmd.exe'}})))"
```

Hasil Windows wajib berbentuk:

```text
command: cmd.exe
args: /d /s /c npm install -g ytconv@latest
```

Kode tidak boleh kembali memanggil `npm.cmd` secara langsung.

## 6. Uji command tanpa download

Gunakan link publik yang memang boleh diuji:

```bash
node ./bin/ytconv.js --dry-run "LINK"
node ./bin/ytconv.js --json "LINK"
node ./bin/ytconv.js --list-formats "LINK"
node ./bin/ytconv.js --list-subs "LINK"
```

Pastikan `--json` hanya menghasilkan JSON valid pada stdout.

## 7. Uji konversi manual minimum

Gunakan media milik sendiri atau media yang diizinkan:

```bash
node ./bin/ytconv.js --preset music "LINK_YOUTUBE_MUSIC"
node ./bin/ytconv.js --preset mobile "LINK_VIDEO"
node ./bin/ytconv.js --image "LINK_CAROUSEL"
node ./bin/ytconv.js --subtitles --subtitle-langs "id,en" "LINK_VIDEO"
```

Periksa:

- MP3 memiliki metadata, chapter bila tersedia, cover tertanam, dan thumbnail JPG terpisah;
- thumbnail YouTube Music berbentuk persegi 1:1;
- video dan audio dapat diputar;
- subtitle SRT tersimpan dan tertanam bila container mendukung;
- carousel menghasilkan seluruh item yang tersedia;
- nama file valid di Windows;
- fallback AUTO tidak mengubah mode yang dipaksa pengguna.

## 8. Preview isi paket npm

```bash
npm publish --dry-run
npm pack --json
```

Paket wajib memuat:

- `bin/`;
- `src/`;
- `scripts/`;
- `ish/`;
- `docs/`;
- `README.md`;
- `CHANGELOG.md`;
- `LICENSE`.

Pastikan paket tidak memuat cookies, log pribadi, hasil download, token, `.env`, atau rahasia lain.

## 9. Pastikan nomor belum terbit

```bash
npm view ytconv versions --json
npm view ytconv version --prefer-online
```

`1.2.1` tidak boleh sudah ada. npm tidak mengizinkan isi versi yang sudah dipublikasikan untuk ditimpa.

## 10. Login dan verifikasi pemilik paket

```bash
npm whoami
npm owner ls ytconv
```

Akun aktif harus memiliki izin publish untuk paket `ytconv`.

## 11. Publish

```bash
npm publish --access public
```

Bila diminta OTP:

```bash
npm publish --access public --otp=123456
```

Ganti `123456` dengan kode aktif dari aplikasi autentikator.

## 12. Verifikasi registry

```bash
npm view ytconv version --prefer-online
npm view ytconv@1.2.1 dist.integrity
```

Versi terbaru wajib menampilkan `1.2.1`.

## 13. Uji paket publik dari instalasi bersih

```bash
npm uninstall -g ytconv
npm cache verify
npm install -g ytconv@1.2.1 --force
ytconv --version
ytconv --help
ytconv --list-presets
ytconv --diagnose
```

Lakukan satu `--dry-run` dan satu download manual yang sah setelah instalasi publik.

## 14. Uji jalur update Windows berikutnya

Perbaikan 1.2.1 baru benar-benar melindungi pembaruan berikutnya. Sebelum rilis selanjutnya, unit test harus memastikan Windows tetap memakai `cmd.exe`, bukan `npm.cmd` langsung.

## 15. Setelah publish

- Jangan mengubah atau mencoba memublikasikan ulang `1.2.1`.
- Perbaikan berikutnya wajib memakai versi baru, misalnya `1.2.2`.
- Jangan merge PR #145 sampai paket publik sudah diuji dan pengguna memang meminta merge.
- Jangan menyatakan seluruh situs pasti berhasil; hasil tetap bergantung pada engine, akses akun, region, perubahan situs, dan DRM.
