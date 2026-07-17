import { spawnSync } from 'node:child_process';
import process from 'node:process';

const COMPLETE_MOUSE_PATTERN = /(?:\u001b)?\[<(\d+);(\d+);(\d+)([Mm])/gu;
const PARTIAL_MOUSE_TAIL_PATTERN = /(?:\u001b)?\[<[\d;]*$/u;

function asText(value) {
  return Buffer.isBuffer(value) ? value.toString() : String(value ?? '');
}

export function parseSgrMouseEvents(value) {
  const events = [];
  const text = asText(value);
  const expression = new RegExp(COMPLETE_MOUSE_PATTERN.source, COMPLETE_MOUSE_PATTERN.flags);
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
  return asText(value).replace(
    new RegExp(COMPLETE_MOUSE_PATTERN.source, COMPLETE_MOUSE_PATTERN.flags),
    '',
  );
}

export function splitTerminalInput(value, carry = '') {
  let text = `${carry}${asText(value)}`;
  const events = parseSgrMouseEvents(text);
  text = stripMouseSequences(text);

  let nextCarry = '';
  const partialMatch = text.match(PARTIAL_MOUSE_TAIL_PATTERN);
  if (partialMatch?.index !== undefined) {
    nextCarry = text.slice(partialMatch.index);
    text = text.slice(0, partialMatch.index);
  } else if (text.endsWith('\u001b')) {
    nextCarry = '\u001b';
    text = text.slice(0, -1);
  }

  return {
    text,
    events,
    carry: nextCarry,
  };
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

function isMouseHandler(listener) {
  return listener?.name === 'handleMouseData';
}

export function installTerminalInputFilter({
  stdin = process.stdin,
  platform = process.platform,
  termux = false,
} = {}) {
  if (!stdin || typeof stdin.on !== 'function') return () => {};

  const original = {
    on: stdin.on,
    addListener: stdin.addListener,
    prependListener: stdin.prependListener,
    once: stdin.once,
    prependOnceListener: stdin.prependOnceListener,
    removeListener: stdin.removeListener,
    off: stdin.off,
  };

  const wrappedByOriginal = new Map();

  function makeWrapper(listener, once = false) {
    let carry = '';

    const wrapped = function filteredTerminalData(chunk, ...rest) {
      if (isMouseHandler(listener)) {
        return listener.call(this, chunk, ...rest);
      }

      const result = splitTerminalInput(chunk, carry);
      carry = result.carry;

      const rightClick = result.events.some(
        (event) => event.pressed && (event.button & 3) === 2,
      );
      const clipboard = rightClick ? readClipboardText({ platform, termux }) : '';
      const forwardedText = `${result.text}${clipboard}`;

      if (!forwardedText) return undefined;

      const forwardedChunk = Buffer.isBuffer(chunk)
        ? Buffer.from(forwardedText)
        : forwardedText;

      if (once) wrappedByOriginal.delete(listener);
      return listener.call(this, forwardedChunk, ...rest);
    };

    wrappedByOriginal.set(listener, wrapped);
    return wrapped;
  }

  function wrapRegistration(method, eventName, listener, once = false) {
    if (eventName !== 'data' || typeof listener !== 'function') {
      return method.call(stdin, eventName, listener);
    }

    return method.call(stdin, eventName, makeWrapper(listener, once));
  }

  stdin.on = function patchedOn(eventName, listener) {
    return wrapRegistration(original.on, eventName, listener);
  };

  stdin.addListener = function patchedAddListener(eventName, listener) {
    return wrapRegistration(original.addListener, eventName, listener);
  };

  stdin.prependListener = function patchedPrependListener(eventName, listener) {
    return wrapRegistration(original.prependListener, eventName, listener);
  };

  stdin.once = function patchedOnce(eventName, listener) {
    return wrapRegistration(original.once, eventName, listener, true);
  };

  if (typeof original.prependOnceListener === 'function') {
    stdin.prependOnceListener = function patchedPrependOnceListener(eventName, listener) {
      return wrapRegistration(original.prependOnceListener, eventName, listener, true);
    };
  }

  function removeWrapped(method, eventName, listener) {
    const wrapped = eventName === 'data' ? wrappedByOriginal.get(listener) : null;
    if (wrapped) wrappedByOriginal.delete(listener);
    return method.call(stdin, eventName, wrapped ?? listener);
  }

  stdin.removeListener = function patchedRemoveListener(eventName, listener) {
    return removeWrapped(original.removeListener, eventName, listener);
  };

  if (typeof original.off === 'function') {
    stdin.off = function patchedOff(eventName, listener) {
      return removeWrapped(original.off, eventName, listener);
    };
  }

  return () => {
    stdin.on = original.on;
    stdin.addListener = original.addListener;
    stdin.prependListener = original.prependListener;
    stdin.once = original.once;
    if (typeof original.prependOnceListener === 'function') {
      stdin.prependOnceListener = original.prependOnceListener;
    }
    stdin.removeListener = original.removeListener;
    if (typeof original.off === 'function') stdin.off = original.off;
    wrappedByOriginal.clear();
  };
}
