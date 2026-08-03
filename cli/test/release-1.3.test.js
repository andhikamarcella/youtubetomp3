import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCliOptions } from '../src/cli-options.js';
import { buildDownloadArgs } from '../src/downloader.js';
import { EXIT_CODES, exitCodeForError } from '../src/exit-codes.js';
import { extractSystemOptions } from '../src/system-tools.js';

function downloadOptions(argv = []) {
  const parsed = parseCliOptions([...argv, 'https://example.com/media']);
  return {
    ...parsed,
    url: parsed.initialUrl,
    mode: parsed.initialMode,
    playlist: parsed.initialPlaylist,
    outputDirectory: '/tmp/ytconv',
    ffmpegPath: '/usr/bin/ffmpeg',
    cookieConfig: parsed.cookiesBrowser
      ? { kind: 'browser', spec: parsed.cookiesBrowser }
      : { kind: 'none' },
  };
}

test('parses mature playlist, retry, resume, metadata, and browser-cookie options', () => {
  const value = parseCliOptions([
    '--playlist', '--playlist-items', '1-10', '--max-downloads', '10',
    '--skip-playlist-after-errors', '3', '--archive', 'downloaded.txt',
    '--retries', '20', '--fragment-retries', '30', '--file-access-retries', '5',
    '--retry-sleep', 'linear=1:10:2', '--no-resume', '--cleanup-part',
    '--artist', 'Artist', '--title', 'Title', '--album', 'Album', '--track', '3',
    '--year', '2026', '--genre', 'Pop', '--cookies-from-browser', 'brave:Default',
    'https://example.com/list',
  ]);
  assert.equal(value.initialPlaylist, true);
  assert.equal(value.playlistItems, '1-10');
  assert.equal(value.maxDownloads, 10);
  assert.equal(value.skipPlaylistAfterErrors, 3);
  assert.equal(value.retries, '20');
  assert.equal(value.fragmentRetries, '30');
  assert.equal(value.resume, false);
  assert.equal(value.cleanupPart, true);
  assert.equal(value.metadataArtist, 'Artist');
  assert.equal(value.metadataTitle, 'Title');
  assert.equal(value.cookiesBrowser, 'brave:default');
});

test('builds yt-dlp args for archive, retries, resume, metadata, and browser cookies', () => {
  const args = buildDownloadArgs(downloadOptions([
    '--audio', '--format', 'mp3', '--quality', '192', '--playlist',
    '--archive', 'downloaded.txt', '--retries', '20', '--fragment-retries', '30',
    '--file-access-retries', '5', '--retry-sleep', 'linear=1:10:2', '--no-resume',
    '--artist', 'Artist', '--album', 'Album', '--cookies-from-browser', 'chrome',
  ]));
  assert.ok(args.includes('--download-archive'));
  assert.ok(args.includes('--retries'));
  assert.ok(args.includes('20'));
  assert.ok(args.includes('--fragment-retries'));
  assert.ok(args.includes('30'));
  assert.ok(args.includes('--file-access-retries'));
  assert.ok(args.includes('--no-continue'));
  assert.deepEqual(args.slice(args.indexOf('--cookies-from-browser'), args.indexOf('--cookies-from-browser') + 2), [
    '--cookies-from-browser', 'chrome',
  ]);
  assert.ok(args.some((value) => value.includes('%(meta_artist)s')));
  assert.ok(args.some((value) => value.includes('%(meta_album)s')));
});

test('default retry sleep preserves complete general fragment and file-access expressions', () => {
  const args = buildDownloadArgs(downloadOptions(['--audio']));
  const sleeps = args.reduce((values, value, index) => {
    if (value === '--retry-sleep') values.push(args[index + 1]);
    return values;
  }, []);
  assert.ok(sleeps.length >= 3);
  assert.ok(sleeps.every((value) => !/^(?:fragment|file_access)::/u.test(value)), sleeps.join(','));
  const general = sleeps.find((value) => !/^(?:fragment|file_access):/u.test(value));
  assert.ok(general, sleeps.join(','));
  assert.ok(sleeps.includes(`fragment:${general}`), sleeps.join(','));
  assert.ok(sleeps.includes(`file_access:${general}`), sleeps.join(','));
});

test('subtitle-only downloads subtitles without media payload', () => {
  const args = buildDownloadArgs(downloadOptions(['--subtitle-only', '--subtitle-langs', 'id,en']));
  assert.ok(args.includes('--skip-download'));
  assert.ok(args.includes('--write-subs'));
  assert.ok(args.includes('--write-auto-subs'));
  assert.ok(!args.includes('--embed-subs'));
});

test('extracts batch jobs and JSON report for automation', () => {
  const value = extractSystemOptions([
    '--batch-file', 'links.txt', '--jobs', '3', '--result-json', 'report.json', '--continue-on-error',
  ]);
  assert.equal(value.system.batchFile, 'links.txt');
  assert.equal(value.system.jobs, 3);
  assert.equal(value.system.continueOnError, true);
  assert.match(value.system.resultJson, /report\.json$/u);
});

test('maps stable automation exit codes', () => {
  assert.equal(exitCodeForError(new Error('Invalid URL')), EXIT_CODES.INVALID_USAGE);
  assert.equal(exitCodeForError(new Error('FFmpeg was not found')), EXIT_CODES.DEPENDENCY_MISSING);
  assert.equal(exitCodeForError(new Error('Login required')), EXIT_CODES.AUTH_REQUIRED);
  assert.equal(exitCodeForError(new Error('HTTP 429 Too Many Requests')), EXIT_CODES.TEMPORARY_FAILURE);
  assert.equal(exitCodeForError(new Error('The download was cancelled')), EXIT_CODES.CANCELLED);
});
