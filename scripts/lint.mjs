import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const tracked = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src/**/*.js', 'tests/**/*.js', 'public-ui/*.js', 'scripts/*.js', 'scripts/*.mjs'], { encoding: 'utf8' })
  .stdout
  .split(/\r?\n/)
  .filter(Boolean);
const syntaxTargets = [
  'index.js',
  'appeal_store.js',
  'ticket_store.js',
  'support_store.js',
  'user_store.js',
  'cookie_store.js',
  ...tracked,
];

const files = Array.from(new Set(syntaxTargets.filter(Boolean)));
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed for ${file}\n`);
    process.exit(result.status || 1);
  }
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
for (const scriptName of ['build', 'test', 'lint', 'typecheck', 'test:security', 'test:e2e', 'test:accessibility', 'secret-scan']) {
  if (!pkg.scripts?.[scriptName]) {
    console.error(`Missing required package script: ${scriptName}`);
    process.exit(1);
  }
}

console.log(`Lint checks passed for ${files.length} JavaScript files and package scripts.`);
