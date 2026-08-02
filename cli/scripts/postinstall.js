import { prepareDesktopDependencies } from '../src/dependencies.js';
import { isTermux } from '../src/platform.js';

try {
  if (isTermux()) {
    console.log('YTConv: Termux detected.');
    console.log('YTConv: Android media engines will be prepared automatically on first use.');
  } else {
    console.log('YTConv: preparing yt-dlp, gallery-dl, and FFmpeg automatically...');
    const result = await prepareDesktopDependencies({ silent: false });
    if (!result.prepared) {
      for (const error of result.errors) console.warn(`YTConv: ${error}`);
      console.warn('YTConv: setup is incomplete. YTConv will retry automatic repair when it starts.');
      console.warn('YTConv: if setup still fails, run `ytconv repair` followed by `ytconv doctor`.');
    } else {
      console.log('YTConv: all media engines are ready.');
    }
  }
} catch (error) {
  console.warn(`YTConv: ${error instanceof Error ? error.message : String(error)}`);
  if (isTermux()) {
    console.warn('YTConv will prepare the Termux tools on first use.');
  } else {
    console.warn('YTConv will retry the media-engine downloads on first use.');
  }
}
