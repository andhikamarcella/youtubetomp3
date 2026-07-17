import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  installTerminalInputFilter,
  parseSgrMouseEvents,
  splitTerminalInput,
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
  const first = splitTerminalInput('\u001b[<2;43;');
  assert.equal(first.text, '');
  assert.equal(first.carry, '\u001b[<2;43;');

  const second = splitTerminalInput('19Mhttps://example.com/video', first.carry);
  assert.equal(second.text, 'https://example.com/video');
  assert.deepEqual(second.events, [
    { button: 2, x: 43, y: 19, pressed: true },
  ]);
});

test('filters mouse bytes for normal input listeners but keeps them for mouse handler', () => {
  const stdin = new EventEmitter();
  const restore = installTerminalInputFilter({ stdin, platform: 'linux' });
  const received = [];
  const mouseEvents = [];

  function handleMouseData(chunk) {
    mouseEvents.push(chunk.toString());
  }

  stdin.prependListener('data', handleMouseData);
  stdin.on('data', (chunk) => received.push(chunk.toString()));
  stdin.emit('data', Buffer.from('\u001b[<0;62;19Mhttps://example.com'));

  assert.deepEqual(mouseEvents, ['\u001b[<0;62;19Mhttps://example.com']);
  assert.deepEqual(received, ['https://example.com']);
  restore();
});
