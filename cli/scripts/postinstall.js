import { ensureBundledYtDlp } from '../src/binaries.js';
import { isTermux } from '../src/platform.js';

try {
  if (isTermux()) {
    console.log('YTConv: Termux detected.');
    console.log('YTConv: Android tools will be prepared visibly on the first run.');
  } else {
    await ensureBundledYtDlp({ force: true });
  }
} catch (error) {
  console.warn(`YTConv: ${error instanceof Error ? error.message : String(error)}`);
  if (isTermux()) {
    console.warn('YTConv akan menyiapkan alat Termux saat pertama kali dijalankan.');
  } else {
    console.warn('YTConv akan mencoba mengunduh yt-dlp lagi saat pertama kali dijalankan.');
  }
}
