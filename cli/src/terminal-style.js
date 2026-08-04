import process from 'node:process';
import { format } from 'node:util';

const ANSI_PATTERN = /(?:\u001B\[[0-?]*[ -/]*[@-~]|\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)|\u001B[P^_][^\u001B]*(?:\u001B\\)|\u009B[0-?]*[ -/]*[@-~])/gu;
const UNSAFE_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001A\u001C-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/gu;
const RED = '\u001B[31m';
const RESET = '\u001B[39m';
const CONSOLE_PATCH = Symbol.for('ytconv.console-error-style');
const SENSITIVE_ENVIRONMENT_NAME = /(?:^|_)(?:AUTH|AUTHORIZATION|COOKIE|CREDENTIAL|KEY|PASS|PASSWORD|SECRET|SESSION|TOKEN)(?:_|$)/iu;
const SENSITIVE_ENVIRONMENT_PREFIX = /^(?:AWS|AZURE|CI_JOB|CIRCLE|CLOUDFLARE|DOCKER_AUTH|GCLOUD|GOOGLE|GH|GITHUB|GITLAB|NPM|NUGET|PYPI|TWINE|YTCONV_AUTH)_/iu;
const EXPLICIT_SENSITIVE_NAMES = new Set([
  'NODE_AUTH_TOKEN',
  'NPM_TOKEN',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GIT_ASKPASS',
  'SSH_ASKPASS',
  'SSH_AUTH_SOCK',
  'YTCONV_AUTH_TOKEN',
  'YTCONV_USER_EMAIL',
]);

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

function isSensitiveEnvironmentName(name) {
  return EXPLICIT_SENSITIVE_NAMES.has(name)
    || SENSITIVE_ENVIRONMENT_PREFIX.test(name)
    || SENSITIVE_ENVIRONMENT_NAME.test(name);
}

export function scrubChildEnvironment(env = process.env) {
  const child = {};
  for (const [name, value] of Object.entries(env ?? {})) {
    if (value === undefined || isSensitiveEnvironmentName(name)) continue;
    child[name] = value;
  }
  child.NO_COLOR = '1';
  child.FORCE_COLOR = '0';
  return child;
}

export function monochromeChildEnvironment(env = process.env) {
  return scrubChildEnvironment(env);
}

export function privateChildEnvironment(env = process.env) {
  return scrubChildEnvironment(env);
}
