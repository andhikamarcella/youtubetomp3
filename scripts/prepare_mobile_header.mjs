import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const indexPath = join(rootDir, 'public-ui', 'index.html');
const version = '4.0.8';
const bridgeTag = `<script src="/tailwind-ui-bridge.js?v=${version}" defer></script>`;
const emergencyTag = `<script src="/mobile-header-emergency.js?v=${version}" defer></script>`;
const forumTag = `<script src="/forum-interaction-emergency.js?v=${version}" defer></script>`;
const modalTag = `<script src="/modal-accessibility-polish.js?v=${version}" defer></script>`;

const bridgePattern = /<script\s+src=["'](?:\.\/|\/)?tailwind-ui-bridge\.js(?:\?[^"']*)?["']\s+defer><\/script>/i;
const emergencyPattern = /<script\s+src=["'](?:\.\/|\/)?mobile-header-emergency\.js(?:\?[^"']*)?["']\s+defer><\/script>/gi;
const forumPattern = /<script\s+src=["'](?:\.\/|\/)?forum-interaction-emergency\.js(?:\?[^"']*)?["']\s+defer><\/script>/gi;
const modalPattern = /<script\s+src=["'](?:\.\/|\/)?modal-accessibility-polish\.js(?:\?[^"']*)?["']\s+defer><\/script>/gi;

let html = await readFile(indexPath, 'utf8');
const original = html;

// Remove previous generated tags first so startup always produces one predictable
// order: stable mobile controls, UI bridge, forum interaction, then global dialogs.
html = html.replace(emergencyPattern, '');
html = html.replace(forumPattern, '');
html = html.replace(modalPattern, '');

const generatedTags = `${emergencyTag}\n  ${bridgeTag}\n  ${forumTag}\n  ${modalTag}`;

if (bridgePattern.test(html)) {
  html = html.replace(bridgePattern, generatedTags);
} else if (/<\/head>/i.test(html)) {
  html = html.replace(/<\/head>/i, `  ${generatedTags}\n</head>`);
} else {
  html = `${generatedTags}\n${html}`;
}

if (html !== original) {
  await writeFile(indexPath, html, 'utf8');
  console.log(`[prepare-ui] Mobile, forum, and accessible modal assets pinned to v${version}.`);
} else {
  console.log(`[prepare-ui] Mobile, forum, and accessible modal assets already pinned to v${version}.`);
}
