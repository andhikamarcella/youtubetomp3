import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const indexPath = join(rootDir, 'public-ui', 'index.html');
const version = '4.0.7';
const bridgeTag = `<script src="/tailwind-ui-bridge.js?v=${version}" defer></script>`;
const emergencyTag = `<script src="/mobile-header-emergency.js?v=${version}" defer></script>`;
const forumTag = `<script src="/forum-interaction-emergency.js?v=${version}" defer></script>`;

const bridgePattern = /<script\s+src=["'](?:\.\/|\/)?tailwind-ui-bridge\.js(?:\?[^"']*)?["']\s+defer><\/script>/i;
const emergencyPattern = /<script\s+src=["'](?:\.\/|\/)?mobile-header-emergency\.js(?:\?[^"']*)?["']\s+defer><\/script>/gi;
const forumPattern = /<script\s+src=["'](?:\.\/|\/)?forum-interaction-emergency\.js(?:\?[^"']*)?["']\s+defer><\/script>/gi;

let html = await readFile(indexPath, 'utf8');
const original = html;

// Remove old emergency tags first. The mobile header emergency must execute
// before the Tailwind bridge so it can disable duplicate touch handlers.
html = html.replace(emergencyPattern, '');
html = html.replace(forumPattern, '');

if (bridgePattern.test(html)) {
  html = html.replace(bridgePattern, `${emergencyTag}\n  ${bridgeTag}\n  ${forumTag}`);
} else if (/<\/head>/i.test(html)) {
  html = html.replace(/<\/head>/i, `  ${emergencyTag}\n  ${bridgeTag}\n  ${forumTag}\n</head>`);
} else {
  html = `${emergencyTag}\n${bridgeTag}\n${forumTag}\n${html}`;
}

if (html !== original) {
  await writeFile(indexPath, html, 'utf8');
  console.log(`[prepare-ui] Mobile header and forum interaction assets pinned to v${version}.`);
} else {
  console.log(`[prepare-ui] Mobile header and forum interaction assets already pinned to v${version}.`);
}
