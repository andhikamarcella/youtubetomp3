import process from 'node:process';
import readline from 'node:readline/promises';
import { isTermux } from './platform.js';
import { copyText, openExternalUrl } from './system-actions.js';

export const DONATION_RETURN_DELAY_MS = 5_000;

export const DONATION_PROVIDERS = Object.freeze({
  kofi: Object.freeze({
    key: 'kofi',
    label: 'Ko-fi',
    audience: 'Global',
    url: 'https://ko-fi.com/cellauu',
    host: 'ko-fi.com',
  }),
  saweria: Object.freeze({
    key: 'saweria',
    label: 'Saweria',
    audience: 'Indonesia',
    url: 'https://saweria.co/dhikamarcella',
    host: 'saweria.co',
  }),
});

const PROVIDER_ALIASES = Object.freeze({
  '1': 'kofi',
  'ko-fi': 'kofi',
  kofi: 'kofi',
  global: 'kofi',
  '2': 'saweria',
  id: 'saweria',
  indo: 'saweria',
  indonesia: 'saweria',
  saweria: 'saweria',
});

export function resolveDonationProvider(value) {
  const key = PROVIDER_ALIASES[String(value ?? '').trim().toLowerCase()];
  return key ? DONATION_PROVIDERS[key] : null;
}

export function donationMenuText() {
  return [
    'Donate — just pay what you can',
    '',
    '  1  Ko-fi   · Global',
    '  2  Saweria · Indonesia only',
    '',
    'Donations are optional. Every YTConv feature remains available without paying.',
  ].join('\n');
}

export async function openDonationPage(providerInput, {
  platform = process.platform,
  termux = isTermux(),
  openUrl = openExternalUrl,
  copy = copyText,
} = {}) {
  const provider = typeof providerInput === 'string'
    ? resolveDonationProvider(providerInput)
    : providerInput;
  if (!provider || DONATION_PROVIDERS[provider.key] !== provider) {
    throw new Error('Choose Ko-fi or Saweria.');
  }

  const opened = await openUrl(provider.url, {
    platform,
    termux,
    allowedHosts: [provider.host],
  });
  if (opened.ok) return { provider, url: provider.url, opened: true, copied: false, openResult: opened };

  const copied = copy(provider.url, { platform, termux });
  return { provider, url: provider.url, opened: false, copied, openResult: opened };
}

function writeLine(output, value = '') {
  output.write(`${value}\n`);
}

async function promptProvider({ input, output }) {
  const terminal = readline.createInterface({ input, output });
  try {
    return await terminal.question('Choose 1 or 2: ');
  } finally {
    terminal.close();
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function handleDonationCommand(argv, {
  input = process.stdin,
  output = process.stdout,
  platform = process.platform,
  termux = isTermux(),
  openPage = openDonationPage,
  wait = delay,
} = {}) {
  const args = Array.isArray(argv) ? argv : [];
  const command = String(args[0] ?? '').toLowerCase();
  if (!['donate', 'donation', 'fund', 'support-us'].includes(command)) {
    return { handled: false, exitCode: 0, returnHome: false };
  }

  writeLine(output, donationMenuText());
  const interactive = Boolean(input.isTTY && output.isTTY);
  let choice = args[1] ?? '';
  if (!choice && interactive) choice = await promptProvider({ input, output });
  if (!choice) {
    writeLine(output, '\nOpen a provider with: ytconv donate kofi | ytconv donate saweria');
    return { handled: true, exitCode: 0, returnHome: false };
  }

  const provider = resolveDonationProvider(choice);
  if (!provider) {
    writeLine(output, `\nUnknown donation option: ${choice}`);
    writeLine(output, 'Choose: kofi (global) or saweria (Indonesia).');
    return { handled: true, exitCode: 2, returnHome: false };
  }

  if (!interactive) {
    writeLine(output, `\n${provider.label}: ${provider.url}`);
    writeLine(output, 'Automatic browser opening is disabled outside an interactive terminal.');
    return { handled: true, exitCode: 0, returnHome: false, provider, url: provider.url };
  }

  const result = await openPage(provider, { platform, termux });
  if (result.opened) writeLine(output, `\nOpened ${provider.label} in your browser.`);
  else if (result.copied) writeLine(output, `\nA browser could not be opened, so the ${provider.label} link was copied.`);
  else writeLine(output, `\nA browser and clipboard were unavailable. Copy this link: ${provider.url}`);
  writeLine(output, 'Returning to YTConv in 5 seconds...');
  await wait(DONATION_RETURN_DELAY_MS);
  return { handled: true, exitCode: 0, returnHome: true, ...result };
}
