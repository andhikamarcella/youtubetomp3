import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const cwd = process.cwd();
const required = [
  'README.md',
  'SECURITY.md',
  'docs/README.md',
  'docs/INSTALLATION.md',
  'docs/COMMANDS.md',
  'docs/CONFIGURATION.md',
  'docs/AUTHENTICATION.md',
  'docs/COOKIES.md',
  'docs/FORMAT-GUIDE.md',
  'docs/CONTENT-EXTRACTION.md',
  'docs/UPSCALING.md',
  'docs/DENO.md',
  'docs/SAFETY-LEGAL.md',
  'docs/SUPPORT.md',
  'docs/DONATE.md',
  'docs/TROUBLESHOOTING.md',
  'docs/PLATFORMS.md',
  'docs/LINUX.md',
  'docs/NODEJS.md',
  'docs/ISH.md',
  'docs/ARCHITECTURE.md',
  'docs/DEVELOPMENT.md',
  'docs/RELEASES.md',
  'docs/TRUSTED-PUBLISHING.md',
  'docs/FAQ.md',
  'docs/MIGRATION-1.7.0.md',
  'docs/MIGRATION-1.7.2.md',
  'docs/MIGRATION-1.7.3.md',
  'docs/MIGRATION-1.7.1.md',
  'docs/HELP-CENTER.md'
];
const errors = [];

for (const relative of required) {
  try {
    await fs.access(path.join(cwd, relative));
  } catch {
    errors.push(`Missing required documentation file: ${relative}`);
  }
}

const manifest = JSON.parse(await fs.readFile(path.join(cwd, 'package.json'), 'utf8'));
if (manifest.version !== '1.7.3') errors.push(`package.json version is ${manifest.version}, expected 1.7.3`);
if (!String(manifest.repository?.url ?? '').includes('andhikamarcella/YTConv')) {
  errors.push('package.json does not reference the canonical andhikamarcella/YTConv repository');
}

for (const relative of required.filter((file) => file.endsWith('.md'))) {
  let text;
  try {
    text = await fs.readFile(path.join(cwd, relative), 'utf8');
  } catch {
    continue;
  }
  if (/andhikamarcella\/youtubetomp3/iu.test(text)) {
    errors.push(`${relative} contains the retired repository slug`);
  }
  const pattern = /\[[^\]]*\]\(([^)]+)\)/gu;
  for (const match of text.matchAll(pattern)) {
    const target = match[1].trim().split('#')[0];
    if (!target || /^(?:https?:|mailto:|#)/u.test(target)) continue;
    const resolved = path.resolve(cwd, path.dirname(relative), target);
    try {
      await fs.access(resolved);
    } catch {
      errors.push(`${relative} has a broken local link: ${match[1]}`);
    }
  }
}

if (errors.length) {
  console.error('Documentation validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Documentation validation passed for ${required.length} required files.`);
}
