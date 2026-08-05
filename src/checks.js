import path from 'node:path';
import { scanProject } from './scanner.js';
import { loadConfig } from './config.js';
import { run } from './process.js';

function parseCommand(command) {
  const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/gu) ?? [];
  return parts.map((part) => part.replace(/^["']|["']$/gu, ''));
}

export async function checkVersionConsistency(cwd) {
  const entries = await scanProject(cwd);
  const versions = [...new Set(entries.map((entry) => entry.version))];
  return {
    ok: entries.length > 0 && versions.length === 1,
    entries,
    versions,
    message: entries.length === 0
      ? 'No supported version files were detected.'
      : versions.length === 1
        ? `All ${entries.length} version files use ${versions[0]}.`
        : `Version mismatch detected: ${versions.join(', ')}`
  };
}

export async function checkGitState(cwd) {
  const result = await run('git', ['status', '--porcelain'], { cwd, capture: true, allowFailure: true });
  if (result.code !== 0) return { ok: false, message: 'Not a Git repository or Git is unavailable.' };
  return { ok: result.stdout.length === 0, message: result.stdout ? 'Working tree contains uncommitted changes.' : 'Git working tree is clean.' };
}

export async function runConfiguredChecks(cwd, config) {
  const results = [];
  for (const command of config.checks ?? []) {
    const [executable, ...args] = parseCommand(command);
    if (!executable) continue;
    const result = await run(executable, args, { cwd, capture: true, allowFailure: true });
    results.push({ command, ok: result.code === 0, output: result.stdout || result.stderr });
  }
  return results;
}

export async function runChecks(cwd, options = {}) {
  const config = await loadConfig(cwd);
  const consistency = await checkVersionConsistency(cwd);
  const git = await checkGitState(cwd);
  const commands = options.skipCommands ? [] : await runConfiguredChecks(path.resolve(cwd), config);
  return { consistency, git, commands, ok: consistency.ok && git.ok && commands.every((item) => item.ok) };
}
