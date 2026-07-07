import { spawnSync } from 'node:child_process';

const targets = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'index.js', 'src/**/*.js', 'tests/**/*.js'], { encoding: 'utf8' })
  .stdout
  .split(/\r?\n/)
  .filter(Boolean);

for (const file of targets) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Type/syntax check failed for ${file}\n`);
    process.exit(result.status || 1);
  }
}

console.log(`Typecheck syntax pass completed for ${targets.length} server/test files.`);
