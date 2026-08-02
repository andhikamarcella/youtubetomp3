#!/usr/bin/env node

import process from 'node:process';
import {
  applyAuthEnvironment,
  authHelpText,
  handleAuthCommand,
  login,
  requireAuthenticatedSession,
} from '../src/auth.js';
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

function isInteractiveTerminal() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function shouldReturnToCli(argv) {
  return isInteractiveTerminal() && !argv.includes('--no-launch');
}

async function launchCli(session) {
  if (session) applyAuthEnvironment(session);
  await import('./ytconv.js');
}

async function boot() {
  const argv = process.argv.slice(2);
  try {
    const auth = await handleAuthCommand(argv, { version: CLI_VERSION });
    if (auth.handled) {
      if (auth.action === 'login' && auth.exitCode === 0 && shouldReturnToCli(argv)) {
        process.argv = [process.argv[0], process.argv[1]];
        await launchCli(auth.session);
        return;
      }
      process.exitCode = auth.exitCode;
      return;
    }

    let session = null;
    if (!canRunWithoutLogin(argv)) {
      try {
        session = await requireAuthenticatedSession();
      } catch (error) {
        if (argv.length || !isInteractiveTerminal()) throw error;
        console.log(`YTConv ${CLI_VERSION} needs a profile before the first download.`);
        const result = await login({ version: CLI_VERSION });
        session = result.session;
      }
    }

    await launchCli(session);
  } catch (error) {
    console.error(`YTConv account:\n${error instanceof Error ? error.message : String(error)}`);
    if (!canRunWithoutLogin(argv)) console.error(authHelpText());
    process.exitCode = Number(error?.status) === 429 ? 5 : 4;
  }
}

await boot();
