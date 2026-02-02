# Sync Sticker Umum (Cloudinary → Firestore) di Railway

Tujuan: ambil semua file di folder Cloudinary `stickers/umum` lalu *upsert* ke koleksi Firestore `stickers` agar tab **Umum** di web chat tidak perlu input manual satu-satu.

Script: `scripts/sync_stickers_firestore.mjs`

## Cara Pakai di Railway (paling simpel)

1. Deploy repo ini ke Railway seperti biasa.
2. Buka **Variables** (Environment Variables) pada service yang sama.
3. Tambahkan variable:
   - `CLOUDINARY_URL` (disarankan) **atau** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `FIREBASE_SERVICE_ACCOUNT_JSON` **atau** `FIREBASE_SERVICE_ACCOUNT_BASE64`
4. Jalankan perintah ini sebagai job/command di Railway:
   - `npm run sync:stickers`

Kalau Railway kamu tidak punya fitur job, opsi cepat:
- Temporarily ubah Start Command service jadi `npm run sync:stickers`, deploy sekali (script akan selesai dan exit), lalu balikin Start Command ke `npm start`.

## Variable yang dibutuhkan

### Cloudinary

**Opsi A (paling gampang):**
- `CLOUDINARY_URL` (format: `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`)

**Opsi B:**
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

### Firebase (wajib untuk Firestore)

**Opsi A (disarankan):**
- `FIREBASE_SERVICE_ACCOUNT_JSON` = isi JSON service account (1 baris).

**Opsi B:**
- `FIREBASE_SERVICE_ACCOUNT_BASE64` = service account JSON yang sudah di-base64.

Opsional:
- `FIREBASE_PROJECT_ID` (kalau mau override projectId dari service account).

## Opsional

- `STICKERS_FOLDER` (default `stickers/umum`)
- `STICKERS_CATEGORY` (default `umum`)
- `CLOUDINARY_PAGE_SIZE` (default `500`)
- `DRY_RUN` (`1` atau `true`) untuk test tanpa nulis ke Firestore

## Output yang diharapkan

Script akan print JSON ringkas seperti:
- `totalFound`: total file yang ditemukan di Cloudinary
- `upserted`: total dokumen yang di-*upsert* ke Firestore

## Catatan penting

- Script memakai `firebase-admin`, jadi **tidak terikat Firestore Rules** (admin bypass rules). Ini aman untuk proses sync server-side.
- Dokumen Firestore dibuat idempotent berdasarkan `publicId` (diubah jadi docId aman), jadi deploy ulang tidak bikin duplikat.

