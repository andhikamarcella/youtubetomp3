import process from 'node:process';
import { format } from 'node:util';

const ANSI_PATTERN = /(?:\u001B\[[0-?]*[ -/]*[@-~]|\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)|\u001B[P^_][^\u001B]*(?:\u001B\\)|\u009B[0-?]*[ -/]*[@-~])/gu;
const UNSAFE_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001A\u001C-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/gu;
const RED = '\u001B[31m';
const RESET = '\u001B[39m';
const CONSOLE_PATCH = Symbol.for('ytconv.console-error-style');

export function stripAnsi(value) {
  return String(value ?? '').replace(ANSI_PATTERN, '');
}

export function sanitizeTerminalText(value, {
  allowNewlines = true,
  maximumLength = 16_384,
} = {}) {
  let text = stripAnsi(value).replace(UNSAFE_CONTROL_PATTERN, '');
  text = allowNewlines
    ? text.replace(/\r\n?/gu, '\n')
    : text.replace(/[\r\n\t]+/gu, ' ');
  return text.slice(0, Math.max(0, maximumLength));
}

export function errorColorEnabled({ stream = process.stderr, env = process.env } = {}) {
  return Boolean(stream?.isTTY && !Object.hasOwn(env, 'NO_COLOR') && env.FORCE_COLOR !== '0' && env.TERM !== 'dumb');
}

export function styleError(value, options = {}) {
  const plain = sanitizeTerminalText(value);
  return errorColorEnabled(options) ? `${RED}${plain}${RESET}` : plain;
}

export function installConsoleErrorStyle({ consoleObject = console, stream = process.stderr, env = process.env } = {}) {
  if (consoleObject[CONSOLE_PATCH]) return;
  const original = consoleObject.error.bind(consoleObject);
  Object.defineProperty(consoleObject, CONSOLE_PATCH, { value: true });
  consoleObject.error = (...values) => original(styleError(format(...values), { stream, env }));
}

export function monochromeChildEnvironment(env = process.env) {
  return { ...env, NO_COLOR: '1', FORCE_COLOR: '0' };
}

export function privateChildEnvironment(env = process.env) {
  const child = monochromeChildEnvironment(env);
  for (const name of [
    'NODE_AUTH_TOKEN', 'NPM_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN',
    'YTCONV_AUTH_TOKEN', 'YTCONV_USER_EMAIL',
  ]) delete child[name];
  return child;
}
