import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const cli = path.join(root, 'cli');
const oldBranch = 'release/ytconv-1.6.5-packages';
const newBranch = 'agent/ytconv-1.6.6-socket-hardening';

async function read(relative) {
  return fs.readFile(path.join(root, relative), 'utf8');
}

async function write(relative, content) {
  const target = path.join(root, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
}

function replaceRequired(content, from, to, label) {
  if (!content.includes(from)) throw new Error(`Expected ${label || from} was not found`);
  return content.replace(from, to);
}

async function patch(relative, transform) {
  const before = await read(relative);
  const after = transform(before);
  if (after === before) throw new Error(`${relative} was not changed`);
  await write(relative, after);
}

const commandPathSource = `import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function windowsExtensions(environment) {
  const configured = String(environment.PATHEXT || '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.startsWith('.') ? value : \`.\${value}\`);
  return unique(['', ...configured, ...configured.map((value) => value.toLowerCase())]);
}

async function executableFile(candidate, platform) {
  try {
    const stats = await fs.stat(candidate);
    if (!stats.isFile()) return false;
    if (platform === 'win32') return true;
    await fs.access(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function candidateNames(name, platform, environment) {
  if (platform !== 'win32' || path.extname(name)) return [name];
  return windowsExtensions(environment).map((extension) => \`\${name}\${extension}\`);
}

export async function resolveCommandPath(names, {
  environment = process.env,
  platform = process.platform,
  currentDirectory = process.cwd(),
} = {}) {
  const requested = Array.isArray(names) ? names : [names];
  const searchPath = String(environment.PATH || environment.Path || environment.path || '');
  const directories = unique(searchPath.split(path.delimiter).map((directory) => directory || currentDirectory));

  for (const rawName of requested) {
    const name = String(rawName || '').trim();
    if (!name || name.includes('\\0')) continue;
    const explicitPath = path.isAbsolute(name) || name.includes('/') || name.includes('\\\\');
    const bases = explicitPath ? [''] : directories;
    for (const base of bases) {
      for (const candidateName of candidateNames(name, platform, environment)) {
        const candidate = explicitPath ? path.resolve(currentDirectory, candidateName) : path.join(base, candidateName);
        if (await executableFile(candidate, platform)) return candidate;
      }
    }
  }
  return null;
}
`;

const commandPathTest = `import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveCommandPath } from '../src/command-path.js';

test('resolves an executable without invoking a shell', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-command-path-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const executable = path.join(directory, 'safe-tool');
  await fs.writeFile(executable, '#!/bin/sh\\nexit 0\\n', { mode: 0o755 });
  const resolved = await resolveCommandPath('safe-tool', {
    environment: { PATH: directory },
    platform: 'linux',
    currentDirectory: directory,
  });
  assert.equal(resolved, executable);
});

test('does not resolve a non-executable file on POSIX', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytconv-command-path-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'not-executable'), 'data', { mode: 0o644 });
  assert.equal(await resolveCommandPath('not-executable', {
    environment: { PATH: directory }, platform: 'linux', currentDirectory: directory,
  }), null);
});

test('rejects null-byte command names', async () => {
  assert.equal(await resolveCommandPath('bad\\0name', { environment: { PATH: '' } }), null);
});
`;

await write('cli/src/command-path.js', commandPathSource);
await write('cli/test/command-path.test.js', commandPathTest);

await patch('cli/src/dependencies.js', (source) => {
  let next = source.replace("import which from 'which';\n", '');
  next = replaceRequired(
    next,
    "import { downloadVerifiedGitHubAsset } from './verified-download.js';\n",
    "import { downloadVerifiedGitHubAsset } from './verified-download.js';\nimport { resolveCommandPath } from './command-path.js';\n",
    'dependencies command-path import location',
  );
  next = replaceRequired(
    next,
    `async function resolveCommand(names) {\n  for (const name of names) {\n    try { return await which(name); } catch { /* Try the next command. */ }\n  }\n  return null;\n}`,
    `async function resolveCommand(names) {\n  return resolveCommandPath(names);\n}`,
    'dependencies which resolver',
  );
  return next;
});

await patch('cli/src/gallery.js', (source) => {
  let next = source.replace("import which from 'which';\n", '');
  next = replaceRequired(
    next,
    "import { downloadVerifiedGitHubAsset } from './verified-download.js';\n",
    "import { downloadVerifiedGitHubAsset } from './verified-download.js';\nimport { resolveCommandPath } from './command-path.js';\n",
    'gallery command-path import location',
  );
  next = replaceRequired(
    next,
    `async function resolveCommand(names) {\n  for (const name of names) {\n    try {\n      return await which(name);\n    } catch {\n      // Try the next command name.\n    }\n  }\n  return null;\n}`,
    `async function resolveCommand(names) {\n  return resolveCommandPath(names);\n}`,
    'gallery which resolver',
  );
  return next;
});

await patch('cli/src/system-tools.js', (source) => {
  let next = source.replace("import which from 'which';\n", '');
  next = replaceRequired(
    next,
    "import { CLI_VERSION } from './version.js';\n",
    "import { CLI_VERSION } from './version.js';\nimport { resolveCommandPath } from './command-path.js';\n",
    'system-tools command-path import location',
  );
  next = replaceRequired(
    next,
    `async function commandPath(name) {\n  try { return await which(name); } catch { return '-'; }\n}`,
    `async function commandPath(name) {\n  return await resolveCommandPath(name) || '-';\n}`,
    'system-tools which resolver',
  );
  return next;
});

await patch('cli/src/ui.js', (source) => {
  let next = source
    .replace("import figlet from 'figlet';\n", '')
    .replace("import ansiShadowFont from 'figlet/importable-fonts/ANSI Shadow.js';\n", '')
    .replace("import smallFont from 'figlet/importable-fonts/Small.js';\n", '')
    .replace("\nfiglet.parseFont('ANSI Shadow', ansiShadowFont);\nfiglet.parseFont('Small', smallFont);\n", '\n');
  next = replaceRequired(
    next,
    "const LOGO_WIDE = figlet.textSync('YTCONV', { font: 'ANSI Shadow' });\nconst LOGO_COMPACT = figlet.textSync('YTCONV', { font: 'Small', horizontalLayout: 'fitted' });",
    "const LOGO_WIDE = [\n  '██╗   ██╗████████╗ ██████╗ ██████╗ ███╗   ██╗██╗   ██╗',\n  '╚██╗ ██╔╝╚══██╔══╝██╔════╝██╔═══██╗████╗  ██║██║   ██║',\n  ' ╚████╔╝    ██║   ██║     ██║   ██║██╔██╗ ██║██║   ██║',\n  '  ╚██╔╝     ██║   ╚██████╗╚██████╔╝██║╚████║╚██████╔╝',\n  '   ╚═╝      ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═══╝ ╚═════╝ ',\n].join('\\n');\nconst LOGO_COMPACT = 'YTCONV';",
    'figlet logos',
  );
  return next;
});

const packagePath = path.join(cli, 'package.json');
const manifest = JSON.parse(await fs.readFile(packagePath, 'utf8'));
manifest.version = '1.6.6';
manifest.description = 'Security-hardened typed media downloader CLI with verified yt-dlp and FFmpeg engines, shell-free command discovery, and native Windows, Linux, Android, Termux, and iSH packages.';
manifest.releaseDate = '2026-08-05';
manifest.releaseNotes = 'YTConv 1.6.6 reduces npm supply-chain exposure by replacing which/isexe with an audited shell-free command resolver, embedding the terminal logo instead of loading figlet/commander, removing unused direct dependencies, and documenting expected downloader capabilities reported by Socket.';
manifest.scripts.test = 'node ./scripts/test-cli.js && node --test ./test/command-path.test.js';
manifest.scripts.security = 'npm audit --omit=dev && node --test ./test/command-path.test.js ./test/security.test.js ./test/supply-chain.test.js';
delete manifest.dependencies.which;
delete manifest.dependencies.figlet;
delete manifest.dependencies.ws;
const serialized = `${JSON.stringify(manifest, null, 2)}\n`
  .replaceAll('1.6.5', '1.6.6')
  .replaceAll(oldBranch, newBranch);
await fs.writeFile(packagePath, serialized, 'utf8');

const versionTargets = [
  'cli/src/version.js',
  'cli/ish/VERSION',
  'cli/ish/ytconv.py',
  'cli/ish/ytconv-core.py',
  'cli/bin/ytconv.js',
  'cli/bin/ytconv-auth.js',
  'cli/scripts/install-ish.sh',
  'cli/scripts/install-termux.sh',
  'cli/scripts/install-unix.sh',
  'cli/scripts/install-windows.cmd',
  'cli/scripts/install-windows.ps1',
  '.github/workflows/ytconv-cli.yml',
  '.github/workflows/ytconv-packages.yml',
];
for (const relative of versionTargets) {
  try {
    const before = await read(relative);
    const after = before.replaceAll('1.6.5', '1.6.6').replaceAll(oldBranch, newBranch);
    if (after !== before) await write(relative, after);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const changelogPath = path.join(cli, 'CHANGELOG.md');
const changelog = await fs.readFile(changelogPath, 'utf8');
if (!changelog.includes('## 1.6.6')) {
  const entry = `## 1.6.6 - 2026-08-05\n\n### Security and dependency hardening\n\n- Replaced the third-party \`which\`/\`isexe\` command lookup chain with a small audited resolver that never invokes a shell.\n- Removed \`figlet\`/\`commander\` by embedding the two terminal logo variants used by the TUI.\n- Removed the unused direct \`ws\` declaration; Ink may still provide WebSocket support transitively for its optional developer tooling.\n- Added cross-platform command-resolution tests and kept all npm lifecycle install scripts forbidden.\n- Documented why network, filesystem, environment, URL, and subprocess access are expected and bounded for a downloader that launches verified yt-dlp, gallery-dl, and FFmpeg engines.\n\n`;
  await fs.writeFile(changelogPath, changelog.replace(/^#([^\n]*)\n/u, (heading) => `${heading}\n${entry}`), 'utf8');
}

await write('cli/docs/SOCKET-SECURITY.md', `# Socket security findings in YTConv 1.6.6\n\nSocket reports capabilities, not only confirmed vulnerabilities. YTConv is a downloader and converter, so several capabilities are intentional and required:\n\n- **Network access:** fetches media metadata, verified release assets, and media streams.\n- **Filesystem access:** writes downloads, configuration, archives, temporary files, and locally verified engines.\n- **Shell/process access:** launches executables with Node.js \`spawn\`/\`execFile\` argument arrays. YTConv does not build user-controlled shell command strings.\n- **Environment access:** reads explicit \`YTCONV_*\` settings, PATH, terminal capability variables, and package-manager context.\n- **URL strings:** contains allowlisted provider and release URLs required for routing and verified updates.\n\nVersion 1.6.6 removes the external \`which\`/\`isexe\` lookup chain and the \`figlet\`/\`commander\` logo chain. Command discovery now checks PATH entries directly and requires executable regular files on POSIX.\n\nDo not suppress an alert merely to obtain a perfect score. Investigate unexpected install scripts, obfuscation, credential access, new domains, dynamic shell strings, or unverified downloads as release blockers.\n`);

console.log('Prepared YTConv 1.6.6 Socket hardening changes.');
