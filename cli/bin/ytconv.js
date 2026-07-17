#!/usr/bin/env node

import process from 'node:process';
import { runApp } from '../src/ui.js';

const initialUrl = process.argv.slice(2).find((argument) => /^https?:\/\//iu.test(argument)) ?? '';

runApp({ initialUrl }).catch((error) => {
  process.stdout.write('\n');
  console.error(`YTConv berhenti: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
