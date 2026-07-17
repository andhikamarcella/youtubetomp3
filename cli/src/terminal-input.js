import { spawnSync } from 'node:child_process';
import process from 'node:process';

const SGR_MOUSE_PATTERN = /\u001b\[<(\d+);(\d+);(\d+)([Mm])/gu;
const LEAKED_MOUSE_PATTERN = /\[<\d+;\d+;\d+[Mm]/gu;

export function parseSgrMouseEvents(value) {
  const events = [];
  const text = Buffer.isBuffer(value) ? value.toString() : String(value ?? '');
  const expression = new RegExp(SGR_MOUSE_PATTERN.source, SGR_MOUSE_PATTERN.flags);
  let match;

  while ((match = expression.exec(text)) !== null) {
    events.push({
      button: Number.parseInt(match[1], 10),
      x: Number.parseInt(match[2], 10),
      y: Number.parseInt(match[3], 10),
      pressed: match[4] === 'M',
    });
  }

  return events;
}

export function stripMouseSequences(value) {
  const text = Buffer.isBuffer(value) ? value.toString() : String(value ?? '');
  return text
    .replace(new RegExp(SGR_MOUSE_PATTERN.source, SGR_MOUSE_PATTERN.flags), '')
    .replace(new RegExp(LEAKED_MOUSE_PATTERN.source, LEAKED_MOUSE_PATTERN.flags), '');
}

function cleanClipboardText(value) {
  return String(value ?? '')
    .replace(/\u0000/gu, '')
    .trim()
    .split(/\r?\n/u)
    .find((line) => line.trim().length > 0)
    ?.trim() ?? '';
}

function runClipboardCommand(command, args = []) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5_000,
    maxBuffer: 2 * 1024 * 1024,
  });

  if (result.error || result.status !== 0) return '';
  return cleanClipboardText(result.stdout);
}

export function readClipboardText({ platform = process.platform, termux = false } = {}) {
  if (platform === 'win32') {
    return runClipboardCommand('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-Clipboard -Raw',
    ]);
  }

  if (termux) return runClipboardCommand('termux-clipboard-get');
  if (platform === 'darwin') return runClipboardCommand('pbpaste');

  return runClipboardCommand('wl-paste', ['--no-newline'])
    || runClipboardCommand('xclip', ['-selection', 'clipboard', '-o']);
}

export function installTerminalInputFilter({
  stdin = process.stdin,
  platform = process.platform,
  termux = false,
} = {}) {
  if (!stdin || typeof stdin.emit !== 'function') return () => {};

  const originalEmit = stdin.emit;
  const originalPrependListener = stdin.prependListener;
  const originalRemoveListener = stdin.removeListener;
  let mouseListener = null;

  stdin.prependListener = function patchedPrependListener(eventName, listener) {
    if (eventName === 'data' && listener?.name === 'handleMouseData') {
      mouseListener = listener;
      return this;
    }

    return originalPrependListener.call(this, eventName, listener);
  };

  stdin.removeListener = function patchedRemoveListener(eventName, listener) {
    if (eventName === 'data' && mouseListener === listener) {
      mouseListener = null;
      return this;
    }

    return originalRemoveListener.call(this, eventName, listener);
  };

  stdin.emit = function patchedEmit(eventName, ...args) {
    if (eventName !== 'data' || args.length === 0) {
      return originalEmit.call(this, eventName, ...args);
    }

    const originalChunk = args[0];
    const events = parseSgrMouseEvents(originalChunk);
    if (events.length === 0) {
      return originalEmit.call(this, eventName, ...args);
    }

    mouseListener?.(originalChunk);

    let forwardedText = stripMouseSequences(originalChunk);
    const rightClick = events.some((event) => event.pressed && (event.button & 3) === 2);
    if (rightClick) forwardedText += readClipboardText({ platform, termux });

    if (!forwardedText) return true;

    const forwardedChunk = Buffer.isBuffer(originalChunk)
      ? Buffer.from(forwardedText)
      : forwardedText;

    return originalEmit.call(this, eventName, forwardedChunk, ...args.slice(1));
  };

  return () => {
    stdin.emit = originalEmit;
    stdin.prependListener = originalPrependListener;
    stdin.removeListener = originalRemoveListener;
    mouseListener = null;
  };
}
