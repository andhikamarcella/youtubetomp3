# YouTube to MP3 Converter

Aplikasi web serbaguna untuk mengunduh audio atau video dari YouTube, Spotify, maupun SoundCloud dan mengonversinya menjadi MP3, M4A, AAC, FLAC, WAV, OGG, ALAC, CAF, hingga MP4/WEBM/MKV. Layanan ini berjalan di [`mis-ytmp3-backend.onrender.com`](https://mis-ytmp3-backend.onrender.com).

## Fitur Utama
- Unduh audio dari tautan YouTube, Spotify, atau SoundCloud secara langsung.
- Preview dan unduhan memanfaatkan audio preview Spotify ketika tautan Spotify digunakan, lengkap dengan embed resmi di UI.
- Tentukan nama berkas output dan laju sampel (44.1 kHz, 48 kHz, atau 96 kHz).
- Opsi audio lossless (FLAC, WAV, ALAC, CAF) serta video MP4/WEBM/MKV siap pakai.
- Pemangkasan awal/akhir audio serta penyematan metadata ID3 (judul, artis, album).
- Thumbnail video otomatis dijadikan gambar album; artis diisi dari nama channel, album mengikuti judul video.
- Normalisasi loudness opsional untuk hasil audio yang konsisten.
- Riwayat unduhan dengan tombol salin, unduh ulang, dan hapus setiap entri.
- Tutorial singkat otomatis saat pertama kali membuka aplikasi.
- Antrian playlist: masukkan banyak URL dan konversi satu per satu.
- Tombol **Dolby Atmos** untuk mencoba mengambil audio multi-channel bila tersedia.
- Halaman Profil dengan avatar dinamis, XP, badge, dan milestone level yang tumbuh sesuai aktivitas.
- Login Google OAuth dengan dashboard profil cloud: XP tersinkronisasi lintas perangkat, riwayat konversi yang bisa diunduh ulang tanpa re-convert, serta statistik menit total.
- Dashboard cloud kini menampilkan streak harian, status bonus harian, dan daftar riwayat terbaru lengkap dengan tautan unduh ulang.
- Referral link unik, XP bonus, dan pencarian riwayat cloud (“lagu apa saja yang pernah kamu unduh dari TWICE”).
- Bonus XP harian dengan tombol **Daily Boost** dan papan peringkat (leaderboard) yang menunjukkan pengguna dengan XP tertinggi.
- Mode progres interaktif dengan status real-time saat konversi berlangsung.
- Monitor konversi real-time melalui endpoint `/api/progress/:id` lengkap dengan persentase, ETA, dan status tahap.
- Preset kualitas (High/Medium/Low) untuk MP3, M4A, dan WAV yang otomatis menyesuaikan bitrate/sample rate.
- Penamaan file otomatis mengikuti pola `{artist} - {title} (bitrate)` sehingga hasil rapi tanpa mengetik ulang.
- Dukungan PWA/offline: pasang aplikasi di perangkat dan gunakan UI meski tanpa koneksi.
- Tema typewriter interaktif lengkap dengan FAQ mendalam, tips percepatan konversi, dan tombol donasi Saweria sekali klik.
- Experience Hub dengan avatar dinamis, poin, dan badge yang berkembang mengikuti aktivitas.
- Adaptive background music yang menyesuaikan mood siang/malam beserta kontrol tema/layout personal.
- Voice navigation, narrator mode, dan AI Navigator chatbot yang siap memandu tanpa harus meninggalkan halaman.
- Mini-game Neo Runner dengan Konami code easter egg plus perayaan donasi lengkap (confetti, suara, getaran).
- AI Studio yang terus bertambah dengan Auto Music Tags, caption, pitch, press kit instan, email outreach, hingga teaser lirik untuk sosial media.
- Background mode dengan notifikasi email opsional sehingga pekerjaan besar tetap berjalan walau tab ditutup.
- Sound Effect add-on (reverb, echo, 8-bit) untuk mewarnai hasil audio langsung dari UI utama maupun mini player.
- Mode VPN-friendly dan Smart Resume agar unduhan tetap stabil ketika koneksi lambat atau terputus sementara.
- Reward Hub dengan streak harian, Lucky Spin, dan Easter Egg Music Trivia untuk menambah XP, badge, dan kejutan baru.
- AI themed skins musiman yang otomatis berganti (Valentine, Halloween, Holiday) serta bisa dipilih manual lewat dashboard.
- Private Room Share yang melindungi tautan unduhan dengan password sebelum dibagikan ke teman.
- Ekstensi browser yang menambahkan tombol “Convert MP3” langsung di bawah video YouTube.
- Kartu status tool yang memeriksa versi yt-dlp & ffmpeg terbaru sekaligus memberi badge peringatan bila sudah kedaluwarsa.
- Auto metadata tagging & AI music tags untuk mengisi judul/artis/genre secara otomatis, lengkap dengan insight genre/mood di UI.

## Antarmuka Next.js + Bootstrap
Untuk antarmuka modern berbasis React, repositori ini menyertakan aplikasi [Next.js](./next-app) yang memanfaatkan komponen Bootstrap namun tetap memakai API backend yang sama. Antarmuka ini dapat dijalankan berdampingan dengan UI klasik tanpa memodifikasi fitur yang sudah ada.

**Menjalankan antarmuka Next.js secara lokal**
1. Masuk ke folder `next-app` kemudian jalankan `npm install`.
2. (Opsional) Set `NEXT_PUBLIC_BACKEND_BASE_URL` bila backend berjalan pada domain/port berbeda. Secara default, antarmuka akan memakai origin yang sama.
3. Jalankan `npm run dev` untuk mode pengembangan, atau `npm run build` diikuti `npm start` untuk mode produksi.
4. Buka `http://localhost:3000` (atau port yang ditampilkan Next.js) untuk mencoba UI React dengan gaya Bootstrap.

Antarmuka Next.js menyertakan form konversi, pencarian video, serta monitor job latar dan memanfaatkan semua endpoint bawaan (`/api/convert`, `/api/search`, `/api/background`, dll.).

### API Serverless di Next.js

Deploy Next.js ke Vercel untuk mendapatkan endpoint serverless tambahan yang memegang kredensial sensitif:

| Endpoint | Metode | Fungsi |
| --- | --- | --- |
| `/api/me` | GET | Mengembalikan profil pengguna yang sudah login (otomatis membuat/memperbarui record di tabel `users`). |
| `/api/dashboard` | GET | Menyajikan ringkasan akun: total konversi, riwayat terbaru, streak harian, dan status bonus harian. |
| `/api/users/[id]/xp` | POST | Menambah/mengurangi XP dengan token idempoten `event_id` sehingga refresh tidak mengulang XP. |
| `/api/cheats/claim` | POST | Klaim cheat (misal `free30kxp`) khusus admin/tester saat `ENABLE_CHEATS=true`. |
| `/api/video-info` | GET | Mengambil metadata YouTube (judul, channel, thumbnail, durasi) memakai `YOUTUBE_API_KEY`. |
| `/api/verify-captcha` | POST | Memvalidasi token reCAPTCHA sebelum memulai konversi. |
| `/api/create-job` | POST | Meneruskan permintaan konversi ringan ke worker Railway (`WORKER_API_BASE`). |
| `/api/job-status` | GET | Memeriksa status job di worker. |
| `/api/job-file` | GET | Mengembalikan `downloadUrl` yang diterbitkan worker untuk job tersebut. |
| `/api/upload-to-drive` | POST | Mengunggah hasil konversi ke Google Drive pengguna menggunakan token OAuth mereka. |
| `/api/ai-navigator` | POST | Menghubungkan pertanyaan pengguna ke Gemini dengan konteks XP, riwayat, dan FAQ terbaru. |
| `/api/faq` | GET | Mengembalikan daftar FAQ terkini agar UI dan AI Navigator berbagi sumber yang sama. |
| `/api/daily-bonus` | POST | Memberikan XP bonus harian (idempoten per hari per pengguna). |
| `/api/history` | GET | Mengambil daftar riwayat konversi milik pengguna yang sedang login (mendukung pagination). |
| `/api/history/[id]` | GET | Mengambil detail satu konversi milik pengguna (job, format, waktu). |
| `/api/history/[id]/redownload` | POST | Menghasilkan tautan unduh ulang langsung ke worker untuk konversi tersebut. |
| `/api/leaderboard` | GET | Mengembalikan daftar pengguna dengan XP tertinggi (opsional parameter `limit`). |

Helper bersama ada di `next-app/lib/` (koneksi PostgreSQL, utilitas auth, dan pengelola XP idempoten). Pastikan environment berikut terpasang saat deploy Vercel: `DATABASE_URL`, `YOUTUBE_API_KEY`, `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`, `WORKER_API_BASE`, `WORKER_SHARED_SECRET`, `ENABLE_CHEATS`, `XP_MULTIPLIER_PREMIUM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, dan `GEMINI_API_KEY`.

### Contoh Penggunaan API di Frontend

```ts
// 1. Validasi reCAPTCHA kemudian buat job konversi
const captcha = await grecaptcha.execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!, { action: 'convert' });
const captchaResult = await fetch('/api/verify-captcha', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ captchaToken: captcha }),
}).then((res) => res.json());

let jobId: string | undefined;
if (captchaResult.ok) {
  const jobResponse = await fetch('/api/create-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoId: 'dQw4w9WgXcQ',
      format: 'mp3',
      captchaToken: captcha,
    }),
  }).then((res) => res.json());
  jobId = jobResponse.jobId;
  console.log('Job ID', jobId, 'XP +', jobResponse.awardedXp);
}

// 2. Polling status job dan mengambil tautan unduhan
if (jobId) {
  const status = await fetch(`/api/job-status?jobId=${encodeURIComponent(jobId)}`).then((res) => res.json());
  if (status.done) {
    const file = await fetch(`/api/job-file?jobId=${encodeURIComponent(jobId)}`).then((res) => res.json());
    window.open(file.downloadUrl, '_blank');
  }
}

// 3. Kirim pertanyaan ke AI Navigator (Gemini)
const aiReply = await fetch('/api/ai-navigator', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'Kenapa XP saya tidak bertambah?' }),
}).then((res) => res.json());
console.log(aiReply.answer);

// 4. Simpan hasil ke Google Drive
await fetch('/api/upload-to-drive', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jobId, filename: 'lagu-favorit.mp3' }),
});

// 5. Ambil FAQ untuk ditampilkan di halaman bantuan
const faq = await fetch('/api/faq').then((res) => res.json());
renderFaq(faq.entries);
```

Skema SQL untuk tabel `users`, `user_tokens`, `xp_events`, `cheat_claims`, dan `conversions` tersedia di `sql/schema.sql` agar XP, token OAuth, serta riwayat job benar-benar persisten di database.

## API Tambahan

- `GET /api/progress/:id` — Mengambil status progres konversi terbaru (tahap, persentase, ETA, dan detail tambahan).
- `GET /api/tool-versions` — Mengecek versi yt-dlp dan ffmpeg yang terpasang serta rilis terbaru di GitHub.
- `POST /api/create-batch` — Mengirim antrean playlist/daftar URL sekaligus ke worker Railway dengan verifikasi captcha dan XP otomatis.
- `POST /api/naming/preview` — Menghasilkan nama file otomatis berdasarkan pola `{artist} - {title} ({bitrate})` yang bisa disesuaikan.
- `POST /api/ai-tags` — Menghasilkan saran judul, artis, album, genre, mood, dan energi berdasarkan metadata video.
- `GET /api/auth/config` — Mengembalikan `googleClientId` publik agar UI bisa merender tombol Google Sign-In.
- `POST /api/auth/google` — Menukar credential Google One Tap/Sign-In menjadi session token aplikasi.
- `GET /api/session` & `GET /api/dashboard` — Mengambil ringkasan profil cloud (avatar, XP, level, badge, menit total).
- `GET /api/history`, `GET /api/history/:id`, `POST /api/history/:id/redownload` — Mengelola riwayat konversi yang tersimpan di cloud, termasuk unduh ulang tanpa re-konversi.
- `GET /api/referral-code` — Mengambil/membuat kode referral unik yang bisa dibagikan ke teman.

## Cara Menggunakan
1. Buka halaman [converter](https://mis-ytmp3-backend.onrender.com).
2. Masukkan URL media (YouTube, Spotify, atau SoundCloud) pada kolom yang tersedia.
3. Pilih kualitas, atur nama file, dan lengkapi metadata jika diperlukan.
4. Klik **Convert** dan tunggu hingga proses selesai, lalu unduh MP3 hasil konversi.
5. Untuk banyak video, tempelkan beberapa URL di kolom *Playlist* dan gunakan **Convert Antrian**.

## Autentikasi & Riwayat Cloud

Fitur akun memanfaatkan Google OAuth 2.0 Sign-In untuk membuat profil otomatis serta menyimpan riwayat konversi ke penyimpanan cloud ringan (`data/users.json`). Setelah login, XP, badge, total menit audio, dan daftar unduhan akan tersinkronisasi di seluruh perangkat. Riwayat tersebut dapat dicari, diunduh ulang tanpa re-konversi, maupun dipakai ulang untuk playlist/keyword berikutnya. Sistem juga menyediakan kode referral unik dan badge bonus ketika teman mendaftar via tautan tersebut.

Konfigurasi yang perlu disiapkan:

- `GOOGLE_CLIENT_ID` — Client ID dari Google Cloud Console (gunakan tipe *Web* untuk memanfaatkan tombol Sign-In modern). Nilai ini tidak diekspor ke klien sampai endpoint `/api/auth/config` diminta.
- `USER_SESSION_SECRET` — Secret string untuk menandatangani token sesi pengguna. Ganti dari nilai default sebelum deploy produksi.

Token sesi disimpan di localStorage browser dan dikirim sebagai header `Authorization: Bearer <token>` ke endpoint yang memerlukan autentikasi. Berkas `data/users.json` tidak ikut dalam repository (sudah diabaikan lewat `.gitignore`).

## Migrasi XP Events

Mulai fase ketiga, XP pengguna disimpan sebagai deretan *XP events* yang idempoten agar tidak berlipat saat terjadi retry. Saat melakukan upgrade ke versi ini, jalankan:

```bash
npm run migrate:xp
```

Perintah tersebut membuat file `data/users.json` memiliki `xpEvents` untuk setiap pengguna, menyalin nilai XP lama menjadi event `legacy-bootstrap`, dan memastikan level tersinkronisasi sebelum server dijalankan kembali.

## Browser Extension

Folder [`browser-extension/`](./browser-extension) berisi manifest dan content script sederhana untuk menambahkan tombol **Convert MP3** di halaman video YouTube (desktop maupun mobile web). Muat ekstensi ini dalam mode developer pada browser Chromium, lalu setiap klik tombol akan membuka konverter dengan URL video yang sedang dibuka.

## Deploy ke Koyeb

Platform ini juga dapat dijalankan di [Koyeb](https://www.koyeb.com) memakai Docker image yang sudah disiapkan. Berikut ringkasan langkahnya:

1. Fork/clone repository ini lalu hubungkan ke aplikasi baru di dashboard Koyeb.
2. Pilih opsi **Dockerfile** sebagai sumber build (file [`Dockerfile`](./Dockerfile) sudah memasang ffmpeg, yt-dlp, dan dependensi Python yang dibutuhkan).
3. Set environment variable `PORT` (otomatis diisi oleh Koyeb) serta `APP_BASE_URL` dengan URL publik aplikasi Koyeb Anda, misalnya `https://youtubetomp3-abcdef.koyeb.app` agar tautan unduhan dan email memakai domain yang benar.
4. (Opsional) Tambahkan kredensial SMTP pada variabel `NOTIFY_SMTP_*` bila ingin mengirim notifikasi email ketika background job selesai.
5. Deploy dan pastikan service mendengarkan pada port 3000; aplikasi ini otomatis bind ke `0.0.0.0` sehingga dapat diteruskan oleh reverse proxy Koyeb.

Setelah berhasil, UI converter dan API akan tersedia di domain Koyeb Anda dengan dukungan PWA/offline mode sebagaimana pada deployment platform lainnya.

## Deploy ke Railway

Railway juga dapat menjalankan proyek ini langsung dari Dockerfile yang sama sehingga dependensi ffmpeg, Python, dan yt-dlp ikut terpasang otomatis.

1. Buat project baru di [Railway](https://railway.app) dan hubungkan repository ini, lalu pilih opsi **Dockerfile** saat diminta metode build.
2. Railway akan mengisi variabel `PORT` secara otomatis. Jika ingin URL absolut pada email/notifikasi sesuai domain Railway, Anda bisa menambahkan `PUBLIC_BASE_URL` atau `APP_BASE_URL` dengan nilai `https://${RAILWAY_PUBLIC_DOMAIN}`. Aplikasi juga akan mendeteksi `RAILWAY_STATIC_URL`/`RAILWAY_PUBLIC_DOMAIN` secara otomatis bila variabel tersebut tersedia.
3. (Opsional) Isi konfigurasi SMTP (`NOTIFY_SMTP_*`) bila ingin notifikasi email, sama seperti pada deployment lain.
4. Deploy. Container akan menjalankan `node index.js` dan otomatis bind ke `0.0.0.0`, sehingga Railway dapat meneruskan trafiknya ke port publik Anda.

Setelah build selesai, UI converter, Experience Hub, hingga API dapat diakses di domain Railway (misalnya `https://nama-layanan.up.railway.app`).

## Cheat & Debug Tools

- Set `ENABLE_CHEATS=true` (atau `on/yes/1`) untuk mengaktifkan endpoint `/api/cheats/claim` dan panel debug tersembunyi di tab Profil.
- Panel dapat dibuka oleh akun yang sudah login Google dengan menekan kombinasi `Ctrl`+`Alt`+`C`. Klaim sukses otomatis mensinkronkan XP, badge, dan log audit.
- Tanpa variabel tersebut, kode rahasia masih memberi XP lokal (untuk demo) tetapi tidak menulis ke penyimpanan cloud.

## Lisensi
Proyek ini dirilis di bawah lisensi MIT.
