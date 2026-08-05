import fs from 'node:fs/promises';
import path from 'node:path';
import { run } from './process.js';

export async function generateChangelogEntry(cwd, version, options = {}) {
  const tagPrefix = options.tagPrefix ?? 'v';
  const latestTag = await run('git', ['describe', '--tags', '--abbrev=0'], { cwd, capture: true, allowFailure: true });
  const range = latestTag.code === 0 ? `${latestTag.stdout}..HEAD` : 'HEAD';
  const log = await run('git', ['log', range, '--pretty=format:%s'], { cwd, capture: true, allowFailure: true });
  const commits = log.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  const date = new Date().toISOString().slice(0, 10);
  const body = commits.length ? commits.map((message) => `- ${message}`).join('\n') : '- Initial release preparation.';
  return `## ${tagPrefix}${version} — ${date}\n\n${body}\n`;
}

export async function writeChangelog(cwd, version, config) {
  const file = path.resolve(cwd, config.changelog ?? 'CHANGELOG.md');
  const entry = await generateChangelogEntry(cwd, version, { tagPrefix: config.tagPrefix });
  let previous = '';
  try { previous = await fs.readFile(file, 'utf8'); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const header = previous.startsWith('# Changelog') ? '# Changelog\n\n' : '# Changelog\n\n';
  const rest = previous.replace(/^# Changelog\s*/u, '');
  await fs.writeFile(file, `${header}${entry}\n${rest}`.trimEnd() + '\n', 'utf8');
  return file;
}
