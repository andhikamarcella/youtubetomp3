import { ensureBundledYtDlp } from '../src/binaries.js';
import { ensureBundledGalleryDl } from '../src/gallery.js';
import { isTermux } from '../src/platform.js';

try {
  if (isTermux()) {
    console.log('YTConv: Termux detected.');
    console.log('YTConv: Android video, image, carousel, and story tools will be prepared visibly on first run.');
  } else {
    await ensureBundledYtDlp({ force: true });
    try {
      await ensureBundledGalleryDl({ force: true });
    } catch (error) {
      console.warn(`YTConv: gallery engine setup deferred. ${error instanceof Error ? error.message : String(error)}`);
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
