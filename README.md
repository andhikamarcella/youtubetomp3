# YouTube to MP3 Converter

Aplikasi web sederhana untuk mengunduh audio dari video YouTube dan mengonversinya menjadi MP3. Layanan ini berjalan di [`mis-ytmp3-backend.onrender.com`](https://mis-ytmp3-backend.onrender.com).

## Fitur Utama
- Unduh audio dari tautan YouTube secara langsung.
- Tentukan nama berkas output dan laju sampel (44.1 kHz, 48 kHz, atau 96 kHz).
- Opsi FLAC lossless (Hi-Res) untuk kualitas maksimal.
- Pemangkasan awal/akhir audio serta penyematan metadata ID3 (judul, artis, album).
- Thumbnail video otomatis dijadikan gambar album; artis diisi dari nama channel, album mengikuti judul video.
- Normalisasi loudness opsional untuk hasil audio yang konsisten.
- Riwayat unduhan dengan tombol salin, unduh ulang, dan hapus setiap entri.
- Tutorial singkat otomatis saat pertama kali membuka aplikasi.
- Antrian playlist: masukkan banyak URL dan konversi satu per satu.
- Tombol **Dolby Atmos** untuk mencoba mengambil audio multi-channel bila tersedia.
- Halaman Profil dengan avatar dinamis, XP, badge, dan milestone level yang tumbuh sesuai aktivitas.
- Mode progres interaktif dengan status real-time saat konversi berlangsung.
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

## Cara Menggunakan
1. Buka halaman [converter](https://mis-ytmp3-backend.onrender.com).
2. Masukkan URL video YouTube pada kolom yang tersedia.
3. Pilih kualitas, atur nama file, dan lengkapi metadata jika diperlukan.
4. Klik **Convert** dan tunggu hingga proses selesai, lalu unduh MP3 hasil konversi.
5. Untuk banyak video, tempelkan beberapa URL di kolom *Playlist* dan gunakan **Convert Antrian**.

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

## Lisensi
Proyek ini dirilis di bawah lisensi MIT.
