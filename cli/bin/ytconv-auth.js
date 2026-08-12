#!/usr/bin/env node

import process from 'node:process';
import { spawnSync } from 'node:child_process';
import {
  applyAuthEnvironment,
  authHelpText,
  handleAuthCommand,
  validateAuthSession,
} from '../src/auth.js';
import { commanderHelpText } from '../src/command-program.js';
import { handleSocialAuthCommand } from '../src/social-auth.js';
import { maybeAutoUpdate } from '../src/update.js';
import { CLI_VERSION } from '../src/version.js';
import {
  enableInteractiveColors,
  installConsoleErrorStyle,
  interactiveChildEnvironment,
} from '../src/terminal-style.js';

installConsoleErrorStyle();

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
  enableInteractiveColors({ noColor: argv.includes('--no-color') });
  try {
    if (argv.length === 1 && ['--help', '-h'].includes(argv[0])) {
      console.log(commanderHelpText(CLI_VERSION));
      process.exitCode = 0;
      return;
    }

    const automaticUpdate = await maybeAutoUpdate({ currentVersion: CLI_VERSION, argv });
    if (automaticUpdate.updated) {
      console.log('Update complete. Restarting YTConv with the latest version.\n');
      const relaunched = spawnSync(process.execPath, [process.argv[1], ...argv], {
        stdio: 'inherit',
        windowsHide: true,
        env: {
          ...interactiveChildEnvironment(process.env, { noColor: argv.includes('--no-color') }),
          YTCONV_SKIP_AUTO_UPDATE_ONCE: '1',
        },
      });
      process.exitCode = relaunched.status ?? (relaunched.error ? 1 : 0);
      return;
    }
    if (automaticUpdate.reason === 'failed') {
      console.warn(`Automatic update did not complete: ${automaticUpdate.result.error.message}`);
      console.warn(`YTConv ${CLI_VERSION} will continue. Retry later with: ytconv update\n`);
    }

    const social = await handleSocialAuthCommand(argv);
    if (social.handled) {
      process.exitCode = social.exitCode;
      return;
    }

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

    const validation = await validateAuthSession({ quiet: true });
    const session = validation.ok ? validation.session : null;

    await launchCli(session);
  } catch (error) {
    console.error(`YTConv:\n${error instanceof Error ? error.message : String(error)}`);
    const first = String(argv[0] || '').toLowerCase();
    if (['auth', 'account'].includes(first) || (first === 'login' && argv.includes('--cloud-only'))) {
      console.error(authHelpText());
    }
    process.exitCode = Number(error?.status) === 429 ? 5 : 1;
  }
}

await boot();
