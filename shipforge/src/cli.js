import fs from 'node:fs/promises';
import path from 'node:path';
import { writeDefaultConfig, loadConfig } from './config.js';
import { scanProject } from './scanner.js';
import { updateProjectVersion } from './versioning.js';
import { runChecks } from './checks.js';
import { generateChecksums } from './checksums.js';
import { writeChangelog } from './changelog.js';
import { publishNpm, publishGitHub, verifyNpm, verifyGitHub } from './publish.js';
import { assertSemver } from './semver.js';
import { heading, line, printTable } from './ui.js';

const VERSION = '0.1.0';

const HELP = `ShipForge ${VERSION}

Safe release automation for npm packages and GitHub Releases.

Usage:
  shipforge [--cwd <directory>] <command> [options]

Commands:
  init                         Create shipforge.config.json
  scan                         Find supported version files
  check                        Validate versions, Git state, and checks
  version <version>            Preview or synchronize project versions
  changelog <version>          Prepend release notes from Git commits
  checksum [directory]         Create SHA256SUMS.txt
  publish <version>            Publish selected npm/GitHub targets
  verify <version>             Verify npm and GitHub publication

Global options:
  -C, --cwd <directory>        Project directory
  -h, --help                   Show help
  -V, --version                Show ShipForge version

Examples:
  shipforge scan
  shipforge version 1.2.0
  shipforge version 1.2.0 --write
  shipforge publish 1.2.0 --npm --github --dry-run
  shipforge publish 1.2.0 --npm --github --yes
`;

function parse(argv) {
  const args = argv.slice(2);
  let cwd = process.cwd();
  const remaining = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '-C' || value === '--cwd') {
      const next = args[++index];
      if (!next) throw new Error(`${value} requires a directory.`);
      cwd = path.resolve(next);
    } else {
      remaining.push(value);
    }
  }
  return { cwd, args: remaining };
}

function takeFlags(args) {
  const flags = new Set();
  const values = new Map();
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith('-')) {
      positional.push(value);
      continue;
    }
    if (value === '-o' || value === '--output') {
      const next = args[++index];
      if (!next) throw new Error(`${value} requires a value.`);
      values.set('output', next);
      continue;
    }
    flags.add(value.replace(/^-+/u, ''));
  }
  return { flags, values, positional };
}

function has(flags, ...names) {
  return names.some((name) => flags.has(name));
}

async function packageIdentity(cwd, config) {
  const file = path.resolve(cwd, config.npm?.directory ?? '.', 'package.json');
  const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!manifest.name || !manifest.version) throw new Error(`Missing name or version in ${file}`);
  return manifest;
}

export async function runCli(argv) {
  const parsed = parse(argv);
  const [command, ...tail] = parsed.args;
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    console.log(HELP);
    return;
  }
  if (command === '--version' || command === '-V') {
    console.log(VERSION);
    return;
  }

  const { flags, values, positional } = takeFlags(tail);
  const cwd = parsed.cwd;

  switch (command) {
    case 'init': {
      const file = await writeDefaultConfig(cwd, { force: has(flags, 'force') });
      heading('Initialized');
      line('ok', `Created ${path.relative(cwd, file)}`);
      break;
    }
    case 'scan': {
      const entries = await scanProject(cwd);
      if (has(flags, 'json')) {
        console.log(JSON.stringify(entries.map(({ absolute, ...entry }) => entry), null, 2));
        break;
      }
      heading('Project scan');
      if (!entries.length) line('warn', 'No supported version files found.');
      else printTable([['TYPE', 'VERSION', 'PATH'], ...entries.map((entry) => [entry.type, entry.version, entry.path])]);
      break;
    }
    case 'check': {
      const result = await runChecks(cwd, { skipCommands: has(flags, 'skip-commands') });
      if (has(flags, 'json')) {
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      heading('Release checks');
      line(result.consistency.ok ? 'ok' : 'error', result.consistency.message);
      line(result.git.ok ? 'ok' : 'warn', result.git.message);
      for (const check of result.commands) line(check.ok ? 'ok' : 'error', `${check.command}${check.output ? ` — ${check.output.split('\n').at(-1)}` : ''}`);
      if (!result.ok) process.exitCode = 1;
      break;
    }
    case 'version': {
      const version = positional[0];
      if (!version) throw new Error('version requires <version>.');
      const write = has(flags, 'write');
      const changes = await updateProjectVersion(cwd, assertSemver(version), { write });
      heading(write ? 'Version updated' : 'Version preview');
      if (!changes.length) line('ok', `All detected files already use ${version}.`);
      else {
        printTable([['FROM', 'TO', 'PATH'], ...changes.map((item) => [item.from, item.to, item.path])]);
        if (!write) line('info', 'Run again with --write to apply these changes.');
      }
      break;
    }
    case 'changelog': {
      const version = positional[0];
      if (!version) throw new Error('changelog requires <version>.');
      const config = await loadConfig(cwd);
      const file = await writeChangelog(cwd, assertSemver(version), config);
      heading('Changelog');
      line('ok', `Updated ${path.relative(cwd, file)}`);
      break;
    }
    case 'checksum': {
      const config = await loadConfig(cwd);
      const target = path.resolve(cwd, positional[0] ?? config.checksumDirectory);
      const result = await generateChecksums(target, values.get('output') ?? 'SHA256SUMS.txt');
      heading('Checksums');
      line('ok', `Hashed ${result.count} files into ${path.relative(cwd, result.outputPath)}`);
      break;
    }
    case 'publish': {
      const version = positional[0];
      if (!version) throw new Error('publish requires <version>.');
      const npmTarget = has(flags, 'npm');
      const githubTarget = has(flags, 'github');
      const dryRun = has(flags, 'dry-run');
      const yes = has(flags, 'yes', 'y');
      assertSemver(version);
      if (!npmTarget && !githubTarget) throw new Error('Select at least one target: --npm or --github.');
      if (!dryRun && !yes) throw new Error('Publishing is irreversible. Add --yes after reviewing a --dry-run.');
      const config = await loadConfig(cwd);
      const checks = await runChecks(cwd);
      if (!checks.ok) throw new Error('Release checks failed. Resolve them before publishing.');
      const identity = await packageIdentity(cwd, config);
      if (identity.version !== version) throw new Error(`package.json is ${identity.version}, not ${version}.`);
      heading(dryRun ? 'Publish dry run' : 'Publishing');
      if (npmTarget) {
        await publishNpm(cwd, config, { dryRun });
        line('ok', `${dryRun ? 'Validated' : 'Published'} npm target ${identity.name}@${version}`);
      }
      if (githubTarget) {
        const result = await publishGitHub(cwd, version, config, { dryRun });
        line('ok', result.stdout);
      }
      break;
    }
    case 'verify': {
      const version = positional[0];
      if (!version) throw new Error('verify requires <version>.');
      const config = await loadConfig(cwd);
      const identity = await packageIdentity(cwd, config);
      const explicit = has(flags, 'npm', 'github');
      const npmTarget = explicit ? has(flags, 'npm') : true;
      const githubTarget = explicit ? has(flags, 'github') : true;
      heading('Publication verification');
      let ok = true;
      if (npmTarget) {
        const result = await verifyNpm(cwd, identity.name, version);
        line(result.ok ? 'ok' : 'error', `npm ${identity.name}@${version}`);
        ok &&= result.ok;
      }
      if (githubTarget) {
        const result = await verifyGitHub(cwd, version, config);
        line(result.ok ? 'ok' : 'error', `GitHub ${config.tagPrefix ?? 'v'}${version}`);
        ok &&= result.ok;
      }
      if (!ok) process.exitCode = 1;
      break;
    }
    default:
      throw new Error(`Unknown command: ${command}. Run shipforge --help.`);
  }
}
