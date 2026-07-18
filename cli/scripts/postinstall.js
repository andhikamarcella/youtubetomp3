import { prepareDesktopDependencies } from '../src/dependencies.js';
import { isTermux } from '../src/platform.js';

try {
  if (isTermux()) {
    console.log('YTConv: Termux detected.');
    console.log('YTConv: alat sosial media Android akan disiapkan secara terlihat saat pertama kali dijalankan.');
  } else {
    console.log('YTConv: preparing yt-dlp, gallery-dl, and FFmpeg...');
    const result = await prepareDesktopDependencies({ silent: false });
    if (!result.prepared) {
      for (const error of result.errors) console.warn(`YTConv: ${error}`);
      console.warn('YTConv: setup belum lengkap; YTConv akan mencoba memperbaikinya lagi saat dibuka.');
    } else {
      console.log('YTConv: all media engines are ready.');
    }
  }
} catch (error) {
  console.warn(`YTConv: ${error instanceof Error ? error.message : String(error)}`);
  if (isTermux()) {
    console.warn('YTConv akan menyiapkan alat Termux saat pertama kali dijalankan.');
  } else {
    console.warn('YTConv akan mencoba mengunduh alat media lagi saat pertama kali dijalankan.');
  }
}
