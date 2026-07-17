import test from 'node:test';
import assert from 'node:assert/strict';
import {
  androidDirectoryUri,
  fileOpenAttempts,
  outputOpenAttempts,
} from '../src/system-actions.js';

test('Windows output action selects the downloaded file before folder fallback', () => {
  const attempts = outputOpenAttempts({
    directory: 'C:\\Users\\andhi\\Downloads',
    filePath: 'C:\\Users\\andhi\\Downloads\\video.mp4',
    platform: 'win32',
    termux: false,
  });

  assert.equal(attempts[0].command, 'explorer.exe');
  assert.deepEqual(attempts[0].args, ['/select,C:\\Users\\andhi\\Downloads\\video.mp4']);
  assert.equal(attempts[1].command, 'explorer.exe');
  assert.deepEqual(attempts[1].args, ['C:\\Users\\andhi\\Downloads']);
});

test('Termux output action includes Android DocumentsUI and termux-open fallbacks', () => {
  const attempts = outputOpenAttempts({
    directory: '/storage/emulated/0/Download/YTConv',
    filePath: '/storage/emulated/0/Download/YTConv/video.mp4',
    platform: 'android',
    termux: true,
  });

  assert.equal(attempts[0].command, 'am');
  assert.ok(attempts[0].args.includes('android.intent.action.VIEW'));
  assert.ok(attempts.some((attempt) => attempt.command === 'termux-open'));
});

test('Android folder URI points to primary shared storage', () => {
  assert.equal(
    androidDirectoryUri('/storage/emulated/0/Download/YTConv'),
    'content://com.android.externalstorage.documents/document/primary%3ADownload%2FYTConv',
  );
});

test('file open actions use platform default application', () => {
  assert.equal(
    fileOpenAttempts({ filePath: '/tmp/video.mp4', platform: 'linux', termux: false })[0].command,
    'xdg-open',
  );
  assert.equal(
    fileOpenAttempts({ filePath: '/sdcard/Download/video.mp4', platform: 'android', termux: true })[0].command,
    'termux-open',
  );
});
