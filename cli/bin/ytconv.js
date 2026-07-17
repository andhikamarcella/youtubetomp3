#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { runApp } from '../src/ui.js';
import { isTermux } from '../src/platform.js';
import { installTerminalInputFilter } from '../src/terminal-input.js';

const termux = isTermux();

if (termux && !process.env.YTCONV_OUTPUT) {
  const androidDownloads = path.join(os.homedir(), 'storage', 'downloads');
  if (fs.existsSync(androidDownloads)) {
    process.env.YTCONV_OUTPUT = path.join(androidDownloads, 'YTConv');
  }
}

const initialUrl = process.argv.slice(2).find((argument) => /^https?:\/\//iu.test(argument)) ?? '';
const restoreTerminalInput = installTerminalInputFilter({ termux });

try {
  await runApp({ initialUrl });
} catch (error) {
  process.stdout.write('\n');
  console.error(`YTConv berhenti: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  restoreTerminalInput();
}
