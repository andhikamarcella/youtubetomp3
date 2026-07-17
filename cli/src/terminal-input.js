import { spawnSync } from 'node:child_process';
import process from 'node:process';

function asText(value) {
  return Buffer.isBuffer(value) ? value.toString() : String(value ?? '');
}

function isMousePrefix(value) {
  return '\u001b[<'.startsWith(value) || '[<'.startsWith(value);
}

function readMouseSequence(source, start) {
  const escapePrefixed = source[start] === '\u001b';
  const prefixLength = escapePrefixed ? 3 : 2;
  const prefix = source.slice(start, start + prefixLength);
  const expectedPrefix = escapePrefixed ? '\u001b[<' : '[<';

  if (expectedPrefix.startsWith(prefix) && prefix.length < expectedPrefix.length) {
    return { partial: true };
  }

  if (prefix !== expectedPrefix) return null;

  let cursor = start + prefixLength;
  while (cursor < source.length && /[0-9;]/u.test(source[cursor])) cursor += 1;

  if (cursor >= source.length) return { partial: true };

  const terminator = source[cursor];
  if (terminator !== 'M' && terminator !== 'm') {
    return { malformed: true, end: cursor + 1 };
  }

  const body = source.slice(start + prefixLength, cursor);
  const parts = body.split(';').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return { malformed: true, end: cursor + 1 };
  }

  return {
    end: cursor + 1,
    event: {
      button: parts[0],
      x: parts[1],
      y: parts[2],
      pressed: terminator === 'M',
    },
  };
}

export function createTerminalInputDecoder() {
  let carry = '';

  return {
    feed(value) {
      const source = `${carry}${asText(value)}`;
      carry = '';
      let text = '';
      const events = [];
      let cursor = 0;

      while (cursor < source.length) {
        const character = source[cursor];
        const possibleStart = character === '\u001b' || character === '[';

        if (possibleStart) {
          const remaining = source.slice(cursor);
          const possiblePrefix = remaining.slice(0, 3);
          const sequence = readMouseSequence(source, cursor);

          if (sequence?.partial) {
            carry = remaining;
            break;
          }

          if (sequence?.event) {
            events.push(sequence.event);
            cursor = sequence.end;
            continue;
          }

          if (sequence?.malformed) {
            cursor = sequence.end;
            continue;
          }

          if (isMousePrefix(possiblePrefix) || isMousePrefix(remaining)) {
            carry = remaining;
            break;
          }
        }

        text += character;
        cursor += 1;
      }

      return { text, events };
    },

    reset() {
      carry = '';
    },
  };
}

export function parseSgrMouseEvents(value) {
  return createTerminalInputDecoder().feed(value).events;
}

export function stripMouseSequences(value) {
  return createTerminalInputDecoder().feed(value).text;
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
