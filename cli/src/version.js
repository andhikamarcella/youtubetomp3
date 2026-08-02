import fs from 'node:fs';

const manifestUrl = new URL('../package.json', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(manifestUrl, 'utf8'));

export const CLI_VERSION = manifest.version;
