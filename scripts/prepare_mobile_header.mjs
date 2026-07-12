import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const indexPath = join(rootDir, 'public-ui', 'index.html');
const version = '4.0.5';
const bridgeTag = `<script src="/tailwind-ui-bridge.js?v=${version}" defer></script>`;
const emergencyTag = `<script src="/mobile-header-emergency.js?v=${version}" defer></script>`;

const bridgePattern = /<script\s+src=["'](?:\.\/|\/)?tailwind-ui-bridge\.js(?:\?[^"']*)?["']\s+defer><\/script>/i;
const emergencyPattern = /<script\s+src=["'](?:\.\/|\/)?mobile-header-emergency\.js(?:\?[^"']*)?["']\s+defer><\/script>/i;

let html = await readFile(indexPath, 'utf8');
const original = html;

if (bridgePattern.test(html)) {
  html = html.replace(bridgePattern, bridgeTag);
} else if (/<\/head>/i.test(html)) {
  html = html.replace(/<\/head>/i, `  ${bridgeTag}\n</head>`);
}

if (emergencyPattern.test(html)) {
  html = html.replace(emergencyPattern, emergencyTag);
} else if (/<\/body>/i.test(html)) {
  html = html.replace(/<\/body>/i, `  ${emergencyTag}\n</body>`);
} else {
  html += `\n${emergencyTag}\n`;
}

if (html !== original) {
  await writeFile(indexPath, html, 'utf8');
  console.log(`[prepare-ui] Mobile header assets pinned to v${version}.`);
} else {
  console.log(`[prepare-ui] Mobile header assets already pinned to v${version}.`);
}
