import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTerminalInputDecoder,
  parseSgrMouseEvents,
  stripMouseSequences,
} from '../src/terminal-input.js';

test('parses mouse events with and without the escape prefix', () => {
  assert.deepEqual(parseSgrMouseEvents('\u001b[<0;62;19M'), [
    { button: 0, x: 62, y: 19, pressed: true },
  ]);
  assert.deepEqual(parseSgrMouseEvents('[<2;43;19M'), [
    { button: 2, x: 43, y: 19, pressed: true },
  ]);
});

test('removes leaked mouse coordinates without damaging pasted URLs', () => {
  const value = '[<2;43;19M[<2;43;19mhttps://www.reddit.com/r/indonesia/s/g9mDYXEpN6';
  assert.equal(
    stripMouseSequences(value),
    'https://www.reddit.com/r/indonesia/s/g9mDYXEpN6',
  );
});

test('reassembles a mouse sequence split across terminal chunks', () => {
  const decoder = createTerminalInputDecoder();
  const first = decoder.feed('\u001b[<2;43;');
  assert.deepEqual(first, { text: '', events: [] });

  const second = decoder.feed('19Mhttps://example.com/video');
  assert.equal(second.text, 'https://example.com/video');
  assert.deepEqual(second.events, [
    { button: 2, x: 43, y: 19, pressed: true },
  ]);
});

test('discards repeated click, release and drag sequences from visible text', () => {
  const decoder = createTerminalInputDecoder();
  const result = decoder.feed(
    '[<2;61;19M[<2;61;19m[<10;61;19M[<10;61;19mhttps://example.com/video',
  );

  assert.equal(result.text, 'https://example.com/video');
  assert.equal(result.events.length, 4);
});
