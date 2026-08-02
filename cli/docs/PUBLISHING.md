# Publishing YTConv to npm

Panduan ini khusus maintainer YTConv. Jangan pernah menaruh token npm di source code, issue, screenshot, log, atau chat.

## Release channels

| Channel | Branch | Version | npm tag | Workflow |
| --- | --- | --- | --- | --- |
| Stable | `release/ytconv-1.5.5` | `1.5.5` | `latest` | `Publish YTConv Stable to npm` |
| Beta | `release/ytconv-1.6.0-beta` | `1.6.0-beta.1` | `beta` | `Publish YTConv Beta to npm` |

Beta tidak boleh dipublikasikan menggunakan tag `latest`.

## One-time npm and GitHub setup

1. Masuk ke akun npm yang menjadi owner package `ytconv` dan aktifkan 2FA.
2. Buat **Granular Access Token** dengan akses read/write ke package `ytconv`. Aktifkan bypass 2FA hanya untuk token automation yang disimpan di GitHub Actions.
3. Buka repository GitHub lalu masuk ke **Settings → Environments**.
4. Buat environment bernama tepat `npm`.
5. Di environment `npm`, tambahkan secret:

   ```text
   NPM_TOKEN=<granular npm automation token>
   ```

6. Disarankan menambahkan required reviewer pada environment `npm` agar publish harus disetujui terlebih dahulu.

Workflow sudah memakai environment `npm`, `id-token: write`, dry-run, test lengkap, pemeriksaan version/tag, serta verifikasi registry setelah publish.

## Pre-publish checklist

Pastikan login server produksi sudah aktif dan pengujian berikut berhasil:

```sh
ytconv login
ytconv auth status
ytconv "AUTHORIZED_MEDIA_URL"
ytconv logout
```

Periksa identitas package:

```sh
cd cli
node -p "require('./package.json').name"
node -p "require('./package.json').version"
node -p "require('./package.json').publishConfig.tag"
npm view ytconv versions --json
```

Jalankan validasi lokal sebelum menekan tombol publish:

```sh
npm install
npm run check
npm test
npm run check:ish
npm run test:ish
npm pack --dry-run
```

## Publish stable 1.5.5 through GitHub Actions

1. Pastikan semua perubahan stable sudah berada di branch `release/ytconv-1.5.5`.
2. Buka tab **Actions** di repository.
3. Pilih workflow **Publish YTConv Stable to npm**.
4. Tekan **Run workflow**.
5. Pilih branch `release/ytconv-1.5.5`.
6. Isi:

   ```text
   version: 1.5.5
   confirm: PUBLISH-STABLE
   ```

7. Jalankan workflow dan setujui environment `npm` apabila approval diaktifkan.
8. Tunggu seluruh step hijau, termasuk **Verify registry**.

Workflow akan menjalankan:

```sh
npm publish --tag latest --access public --provenance
```

Verifikasi hasil:

```sh
npm view ytconv@latest version
npm view ytconv@1.5.5 dist.integrity
npm view ytconv dist-tags --json
```

Expected:

```text
latest = 1.5.5
```

## Publish beta 1.6.0-beta.1 through GitHub Actions

1. Pastikan semua perubahan beta berada di branch `release/ytconv-1.6.0-beta`.
2. Buka tab **Actions**.
3. Pilih workflow **Publish YTConv Beta to npm**.
4. Tekan **Run workflow**.
5. Pilih branch `release/ytconv-1.6.0-beta`.
6. Isi:

   ```text
   version: 1.6.0-beta.1
   confirm: PUBLISH-BETA
   ```

7. Jalankan workflow dan tunggu seluruh step hijau.

Workflow akan menjalankan:

```sh
npm publish --tag beta --access public --provenance
```

Workflow juga memastikan tag `latest` tidak berubah.

Verifikasi hasil:

```sh
npm view ytconv@beta version
npm view ytconv@latest version
npm view ytconv@1.6.0-beta.1 dist.integrity
npm view ytconv dist-tags --json
```

Expected:

```text
beta   = 1.6.0-beta.1
latest = 1.5.5
```

## Manual local fallback

Gunakan hanya ketika GitHub Actions sedang bermasalah. Publishing melalui Actions lebih aman dan menghasilkan provenance.

```sh
npm login
npm whoami
cd cli
npm install
npm run check
npm test
npm run check:ish
npm run test:ish
npm pack --dry-run
```

Stable:

```sh
npm publish --tag latest --access public
```

Beta:

```sh
npm publish --tag beta --access public
```

Jangan menjalankan publish dari branch yang salah.

## Install verification

Stable:

```sh
npm install -g ytconv@latest --force
ytconv --version
```

Beta:

```sh
npm install -g ytconv@beta --force
ytconv --version
```

Windows PowerShell/CMD dapat memakai:

```powershell
npm.cmd install -g ytconv@latest --force
ytconv.cmd --version
```

## Version and tag recovery

Versi npm yang sudah dipublikasikan tidak dapat ditimpa. Ubah `package.json`, lockfile, dokumentasi, installer, dan test identity sebelum memublikasikan versi berikutnya.

Memperbaiki dist-tag tanpa menerbitkan ulang package:

```sh
npm dist-tag add ytconv@1.5.5 latest
npm dist-tag add ytconv@1.6.0-beta.1 beta
npm view ytconv dist-tags --json
```

Contoh versi berikutnya:

```text
Stable patch: 1.5.1
Beta next:    1.6.0-beta.2
```

## Common failures

### `ENEEDAUTH` or `E401`

- Pastikan secret bernama tepat `NPM_TOKEN` berada di environment `npm`.
- Pastikan token belum expired atau revoked.
- Pastikan token mempunyai read/write permission untuk package `ytconv`.

### `You cannot publish over the previously published versions`

Version tersebut sudah pernah dipublikasikan. Naikkan nomor version; jangan mencoba menimpa version lama.

### Beta accidentally changes `latest`

Pulihkan tag:

```sh
npm dist-tag add ytconv@1.5.5 latest
npm dist-tag add ytconv@1.6.0-beta.1 beta
```

### Package contents are wrong

Selalu periksa hasil berikut sebelum publish:

```sh
npm pack --dry-run
```

Pastikan `bin`, `src`, `scripts`, `ish`, `docs`, `README.md`, `CHANGELOG.md`, dan `LICENSE` ikut terkemas.
