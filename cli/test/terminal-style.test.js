import assert from 'node:assert/strict';
import test from 'node:test';
import { terminalLayout } from '../src/ui.js';
import {
  monochromeChildEnvironment,
  sanitizeTerminalText,
  styleError,
} from '../src/terminal-style.js';

test('responsive layout never exceeds terminals from iSH to desktop', () => {
  for (const [columns, rows] of [[20, 8], [40, 12], [56, 18], [80, 24], [120, 40]]) {
    const layout = terminalLayout(columns, rows);
    assert.ok(layout.panelWidth <= columns - 2);
    assert.ok(layout.minHeight <= rows);
    assert.equal(layout.stackedControls, columns < 50);
  }
  assert.equal(terminalLayout(20, 8).tinyLogo, true);
  assert.equal(terminalLayout(80, 24).showShortcuts, true);
});

test('normal output is monochrome while terminal errors may be red', () => {
  const tty = { isTTY: true };
  assert.equal(styleError('failure', { stream: tty, env: {} }), '\u001B[31mfailure\u001B[39m');
  assert.equal(styleError('failure', { stream: tty, env: { NO_COLOR: '1' } }), 'failure');
  assert.equal(styleError('failure', { stream: { isTTY: false }, env: {} }), 'failure');
  assert.deepEqual(monochromeChildEnvironment({ PATH: '/bin' }), {
    PATH: '/bin', NO_COLOR: '1', FORCE_COLOR: '0',
  });
});

test('untrusted terminal text cannot inject ANSI or bidirectional controls', () => {
  assert.equal(sanitizeTerminalText('\u001B[32mgreen\u001B[0m\u202Eevil'), 'greenevil');
});
