#!/usr/bin/env node

import process from 'node:process';
import { runApp } from '../src/ui.js';

process.on('SIGINT', () => {
  process.stdout.write('\n');
  console.log('Sampai jumpa di YTConv!');
  process.exit(130);
});

runApp().catch((error) => {
  process.stdout.write('\n');
  console.error(`YTConv berhenti: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
