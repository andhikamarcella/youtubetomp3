# Platform dan engine

YTConv bukan daftar extractor terpisah; dukungan aktual mengikuti yt-dlp dan gallery-dl yang terpasang.

## Routing utama

- **yt-dlp:** video, audio, live stream, format, subtitle, metadata, SponsorBlock.
- **gallery-dl:** gambar, carousel, story, profil, dan posting campuran tertentu.
- **FFmpeg:** merge, remux, audio extraction, thumbnail conversion, crop, subtitle, normalisasi, dan potong durasi.

## Platform yang dikenali langsung

YouTube, YouTube Music, Instagram, Facebook, TikTok, X/Twitter, Pinterest, Reddit, Threads, Twitch, Snapchat, SoundCloud, Bandcamp, Mixcloud, Vimeo, Dailymotion, Bilibili, Tumblr, Telegram, LinkedIn, Bluesky, Imgur, Flickr, DeviantArt, Pixiv, Weibo, VK, Mastodon, Kick, Rumble, Streamable, Odysee, dan 9GAG.

Situs lain tetap dapat bekerja bila salah satu engine memiliki extractor yang sesuai.

## YouTube Music

- AUTO diarahkan ke audio.
- MP3 menyimpan thumbnail JPG, embed cover, metadata, dan chapter.
- Thumbnail dicrop dari tengah menjadi persegi 1:1.

## Instagram/TikTok/X/Reddit

Posting dapat berisi gambar, video, atau campuran. AUTO memilih engine berdasarkan bentuk URL dan mencoba fallback. Story, akun privat, dan konten login-only membutuhkan cookies akun yang memiliki akses.

## Batasan

- DRM dan paywall tidak dilewati.
- Media privat tidak dapat dibuka tanpa akses akun yang sah.
- Region lock tetap mengikuti lokasi/proxy dan aturan situs.
- Post terhapus atau URL kedaluwarsa tidak dapat dipulihkan.
- Perubahan API situs dapat memerlukan update yt-dlp/gallery-dl.
- iSH dengan Python lama mungkin memakai yt-dlp kompatibel yang tidak paling baru.
