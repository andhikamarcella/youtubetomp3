import { prepareDesktopDependencies } from '../src/dependencies.js';
import { isTermux } from '../src/platform.js';

try {
  if (isTermux()) {
    console.log('YTConv: Termux terdeteksi.');
    console.log('YTConv: engine media Android akan disiapkan otomatis saat pertama kali dijalankan.');
  } else {
    console.log('YTConv: menyiapkan yt-dlp, gallery-dl, dan FFmpeg secara otomatis...');
    const result = await prepareDesktopDependencies({ silent: false });
    if (!result.prepared) {
      for (const error of result.errors) console.warn(`YTConv: ${error}`);
      console.warn('YTConv: persiapan belum lengkap. Saat dibuka, YTConv akan mencoba memperbaikinya lagi secara otomatis.');
      console.warn('YTConv: bila masih gagal, jalankan `ytconv repair` lalu `ytconv doctor`.');
    } else {
      console.log('YTConv: semua engine media sudah siap.');
    }
  }
} catch (error) {
  console.warn(`YTConv: ${error instanceof Error ? error.message : String(error)}`);
  if (isTermux()) {
    console.warn('YTConv akan menyiapkan alat Termux saat pertama kali dijalankan.');
  } else {
    console.warn('YTConv akan mencoba mengunduh engine media lagi saat pertama kali dijalankan.');
  }
}
