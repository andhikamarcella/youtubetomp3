import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { helpText, parseCliOptions } from '../src/cli-options.js';

test('parses URL, platform, playlist, output and cookies options', () => {
  const options = parseCliOptions([
    '--platform',
    'facebook',
    '--playlist',
    '--output',
    './downloads',
    '--cookies',
    './cookies.txt',
    'https://www.facebook.com/reel/example',
  ]);

  assert.equal(options.initialPlatform, 'facebook');
  assert.equal(options.initialPlaylist, true);
  assert.equal(options.initialUrl, 'https://www.facebook.com/reel/example');
  assert.equal(options.outputDirectory, path.resolve('./downloads'));
  assert.equal(options.cookiesPath, path.resolve('./cookies.txt'));
});

test('defaults to automatic platform and parses image format', () => {
  const defaults = parseCliOptions([]);
  assert.equal(defaults.initialMode, 'auto');
  assert.equal(defaults.initialPlatform, 'auto');
  const options = parseCliOptions(['--platform', 'instagram', '--image-format', 'webp', 'https://instagram.com/p/example/']);
  assert.equal(options.initialPlatform, 'instagram');
  assert.equal(options.initialImageFormat, 'webp');
});

test('parses audio and video conversion settings', () => {
  const audio = parseCliOptions(['--audio-format', 'flac', '--audio-quality', '320']);
  assert.equal(audio.initialMode, 'audio');
  assert.equal(audio.audioFormat, 'flac');
  assert.equal(audio.audioQuality, '320');

  const video = parseCliOptions([
    '--video-format', 'webm',
    '--resolution', '1080',
    '--subtitles',
    '--subtitle-langs', 'id,en',
  ]);
  assert.equal(video.initialMode, 'video');
  assert.equal(video.forceVideo, true);
  assert.equal(video.videoFormat, 'webm');
  assert.equal(video.resolution, '1080');
  assert.equal(video.subtitles, true);
  assert.equal(video.subtitleLanguages, 'id,en');
});

test('parses sidecars, clipping and download archive', () => {
  const options = parseCliOptions([
    '--metadata-files',
    '--thumbnail',
    '--start', '01:02',
    '--end', '01:05:30',
    '--archive', './downloaded.txt',
  ]);
  assert.equal(options.writeInfoJson, true);
  assert.equal(options.writeDescription, true);
  assert.equal(options.writeThumbnail, true);
  assert.equal(options.clipStart, '01:02');
  assert.equal(options.clipEnd, '01:05:30');
  assert.equal(options.archivePath, path.resolve('./downloaded.txt'));
});

test('parses update controls', () => {
  assert.equal(parseCliOptions(['--check-update']).checkUpdate, true);
  assert.equal(parseCliOptions(['--update']).update, true);
  assert.equal(parseCliOptions(['--no-update-check']).noUpdateCheck, true);
});

test('rejects unknown and invalid conversion options', () => {
  assert.throws(() => parseCliOptions(['--unknown']), /Opsi tidak dikenal/u);
  assert.throws(() => parseCliOptions(['--output']), /membutuhkan nilai/u);
  assert.throws(() => parseCliOptions(['--platform', 'myspace']), /tidak dikenali/u);
  assert.throws(() => parseCliOptions(['--image-format', 'gif']), /original, jpg, png, webp/u);
  assert.throws(() => parseCliOptions(['--audio-format', 'wma']), /mp3, m4a, opus, flac, wav/u);
  assert.throws(() => parseCliOptions(['--video-format', 'avi']), /auto, mp4, mkv, webm/u);
  assert.throws(() => parseCliOptions(['--start', 'abc']), /detik, MM:SS, atau HH:MM:SS/u);
});

test('help documents advanced media conversion', () => {
  const text = helpText();
  assert.match(text, /--audio-format/u);
  assert.match(text, /--video-format/u);
  assert.match(text, /--subtitles/u);
  assert.match(text, /--metadata-files/u);
  assert.match(text, /--archive/u);
  assert.match(text, /--diagnose/u);
});
