#!/usr/bin/env node

import process from 'node:process';
import { authHelpText, handleAuthCommand, requireAuthenticatedSession } from '../src/auth.js';
import { CLI_VERSION } from '../src/version.js';

const SAFE_COMMANDS = new Set([
  'help', 'doctor', 'diagnose', 'repair', 'setup', 'update', 'config', 'profile',
  'history', 'completion', 'quickstart', 'clean', 'clear-cache', 'shell-info',
  'self-test', 'examples', 'presets',
]);

const SAFE_FLAGS = new Set([
  '--help', '-h', '--version', '-v', '--diagnose', '--doctor', '--repair', '--setup',
  '--check-update', '--update', '--list-presets', '--examples', '--shell-info',
  '--clear-cache', '--self-test',
]);

function canRunWithoutLogin(argv) {
  if (!argv.length) return false;
  const first = String(argv[0] || '').toLowerCase();
  if (SAFE_COMMANDS.has(first) || SAFE_FLAGS.has(first)) return true;
  return argv.some((value) => SAFE_FLAGS.has(String(value).toLowerCase()));
}

async function boot() {
  const argv = process.argv.slice(2);
  try {
    const auth = await handleAuthCommand(argv, { version: CLI_VERSION });
    if (auth.handled) {
      process.exitCode = auth.exitCode;
      return;
    }

    if (!canRunWithoutLogin(argv)) {
      const session = await requireAuthenticatedSession();
      process.env.YTCONV_AUTH_TOKEN = session.accessToken;
      process.env.YTCONV_USER_ID = session.user?.id || '';
      process.env.YTCONV_USER_EMAIL = session.user?.email || '';
    }

    await import('./ytconv.js');
  } catch (error) {
    console.error(`YTConv account:\n${error instanceof Error ? error.message : String(error)}`);
    if (!canRunWithoutLogin(argv)) console.error(authHelpText());
    process.exitCode = Number(error?.status) === 429 ? 5 : 4;
  }
}

await boot();
