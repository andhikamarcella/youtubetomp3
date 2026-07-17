import { spawnSync } from 'node:child_process';
import { ensureBundledYtDlp } from '../src/binaries.js';
import { isTermux } from '../src/platform.js';

function run(command, args, { optional = false } = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });

  if (result.error) {
    if (optional) return false;
    throw result.error;
  }

  if (result.status !== 0) {
    if (optional) return false;
    throw new Error(`${command} selesai dengan kode ${result.status ?? 'tidak diketahui'}.`);
  }

  return true;
}

try {
  if (isTermux()) {
    console.log('YTConv: Termux detected. Preparing Android-compatible tools...');
    run('pkg', ['install', '-y', 'python-yt-dlp', 'ffmpeg']);

    if (!run('pkg', ['install', '-y', 'yt-dlp-ejs'], { optional: true })) {
      console.warn('YTConv: yt-dlp-ejs tidak tersedia; instalasi utama tetap dapat dipakai.');
    }

    console.log('YTConv: Termux tools are ready.');
    console.log('YTConv: run termux-setup-storage once so files can be saved to Android Downloads.');
  } else {
    await ensureBundledYtDlp({ force: true });
  }
} catch (error) {
  console.warn(`YTConv: ${error instanceof Error ? error.message : String(error)}`);
  if (isTermux()) {
    console.warn('YTConv: jalankan manual: pkg install -y python-yt-dlp ffmpeg');
  } else {
    console.warn('YTConv akan mencoba mengunduh yt-dlp lagi saat pertama kali dijalankan.');
  }
}
