import { ensureBundledYtDlp } from '../src/binaries.js';

try {
  await ensureBundledYtDlp({ force: true });
} catch (error) {
  console.warn(`YTConv: ${error instanceof Error ? error.message : String(error)}`);
  console.warn('YTConv akan mencoba mengunduh yt-dlp lagi saat pertama kali dijalankan.');
}
