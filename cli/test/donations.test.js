import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import {
  DONATION_PROVIDERS,
  DONATION_RETURN_DELAY_MS,
  donationMenuText,
  handleDonationCommand,
  openDonationPage,
  resolveDonationProvider,
} from '../src/donations.js';

test('donation providers map global and Indonesian choices to exact HTTPS pages', () => {
  assert.equal(resolveDonationProvider('1'), DONATION_PROVIDERS.kofi);
  assert.equal(resolveDonationProvider('global'), DONATION_PROVIDERS.kofi);
  assert.equal(resolveDonationProvider('2'), DONATION_PROVIDERS.saweria);
  assert.equal(resolveDonationProvider('indonesia'), DONATION_PROVIDERS.saweria);
  assert.equal(DONATION_PROVIDERS.kofi.url, 'https://ko-fi.com/cellauu');
  assert.equal(DONATION_PROVIDERS.saweria.url, 'https://saweria.co/dhikamarcella');
  assert.equal(DONATION_RETURN_DELAY_MS, 5_000);
  assert.match(donationMenuText(), /just pay what you can/iu);
});

test('successful donation handoff opens only the selected allowlisted page', async () => {
  const calls = [];
  const result = await openDonationPage('kofi', {
    openUrl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true };
    },
    copy: () => { throw new Error('copy fallback should not run'); },
  });
  assert.equal(result.opened, true);
  assert.equal(result.copied, false);
  assert.deepEqual(calls, [{
    url: DONATION_PROVIDERS.kofi.url,
    options: { platform: process.platform, termux: false, allowedHosts: ['ko-fi.com'] },
  }]);
});

test('failed browser handoff copies the exact donation URL', async () => {
  const copied = [];
  const result = await openDonationPage('saweria', {
    platform: 'linux',
    termux: false,
    openUrl: async () => ({ ok: false, error: new Error('no browser') }),
    copy: (value) => { copied.push(value); return true; },
  });
  assert.equal(result.opened, false);
  assert.equal(result.copied, true);
  assert.deepEqual(copied, [DONATION_PROVIDERS.saweria.url]);
});

test('non-interactive donate command prints a safe manual link without launching', async () => {
  let output = '';
  const stream = { isTTY: false, write: (value) => { output += value; } };
  const result = await handleDonationCommand(['donate', 'kofi'], {
    input: { isTTY: false },
    output: stream,
    openPage: async () => { throw new Error('must not launch outside a TTY'); },
    wait: async () => { throw new Error('must not wait outside a TTY'); },
  });
  assert.equal(result.handled, true);
  assert.equal(result.returnHome, false);
  assert.match(output, /https:\/\/ko-fi\.com\/cellauu/u);
});

test('interactive donate command waits five seconds before returning home', async () => {
  let output = '';
  let waited = 0;
  const stream = { isTTY: true, write: (value) => { output += value; } };
  const result = await handleDonationCommand(['donate', 'saweria'], {
    input: { isTTY: true },
    output: stream,
    openPage: async () => ({
      provider: DONATION_PROVIDERS.saweria,
      url: DONATION_PROVIDERS.saweria.url,
      opened: true,
      copied: false,
    }),
    wait: async (milliseconds) => { waited = milliseconds; },
  });
  assert.equal(result.returnHome, true);
  assert.equal(waited, 5_000);
  assert.match(output, /Returning to YTConv in 5 seconds/u);
});
