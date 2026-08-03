import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import which from 'which';
import { inspectDependencies, prepareDesktopDependencies, prepareTermuxDependencies } from './dependencies.js';
import { detectLinuxDistro } from './linux-distro.js';
import { isTermux } from './platform.js';
import { clearUpdateCache, selfUpdateInvocation } from './update.js';
import { CLI_VERSION } from './version.js';

function takeValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) throw new Error(`${flag} requires a value.`);
  return value;
}

export function extractSystemOptions(argv = []) {
  const cleanArgs = [];
  const system = {
    repair: false, shellInfo: false, clearCache: false, selfTest: false,
    examples: false, headless: false, stdin: false, batchFile: '',
    continueOnError: false, openOutput: false, noColor: false, jobs: 1, resultJson: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repair' || arg === '--setup') system.repair = true;
    else if (arg === '--doctor') cleanArgs.push('--diagnose');
    else if (arg === '--shell-info' || arg === '--where') system.shellInfo = true;
    else if (arg === '--clear-cache') system.clearCache = true;
    else if (arg === '--self-test') system.selfTest = true;
    else if (arg === '--examples') system.examples = true;
    else if (arg === '--headless' || arg === '--non-interactive') system.headless = true;
    else if (arg === '--stdin') system.stdin = true;
    else if (arg === '--continue-on-error') system.continueOnError = true;
    else if (arg === '--open-output') system.openOutput = true;
    else if (arg === '--no-color') system.noColor = true;
    else if (arg === '--batch-file') {
      system.batchFile = takeValue(argv, index, arg); index += 1;
    } else if (arg === '--jobs') {
      const number = Number.parseInt(takeValue(argv, index, arg), 10);
      if (!Number.isInteger(number) || number < 1 || number > 8) throw new Error('--jobs must be an integer from 1 to 8.');
      system.jobs = number; index += 1;
    } else if (arg === '--result-json') {
      system.resultJson = path.resolve(takeValue(argv, index, arg)); index += 1;
    } else cleanArgs.push(arg);
  }
  return { system, cleanArgs };
}

function shellName() {
  if (process.platform === 'win32') {
    if (process.env.PSModulePath || process.env.POWERSHELL_DISTRIBUTION_CHANNEL) return 'PowerShell';
    return 'CMD/Windows Terminal';
  }
  if (isTermux()) return 'Termux';
  return process.env.SHELL || (process.stdin.isTTY ? 'TTY shell' : 'SSH/CI non-TTY');
}

async function commandPath(name) {
  try { return await which(name); } catch { return '-'; }
}

async function availableManagers() {
  const names = ['apt-get', 'dnf', 'pacman', 'zypper', 'apk', 'xbps-install', 'emerge', 'nix', 'brew'];
  const values = await Promise.all(names.map(async (name) => (await commandPath(name)) === '-' ? null : name));
  return values.filter(Boolean);
}

export async function printShellInfo({ outputDirectory = '' } = {}) {
  const distro = await detectLinuxDistro({ available: await availableManagers() });
  const dependencies = await inspectDependencies({ repair: false });
  const rows = [
    ['Shell', shellName()], ['Platform', `${process.platform} ${process.arch}`],
    ['Distribution', distro.name], ['Package manager', distro.manager],
    ['Node', `${process.version} (${dependencies.node?.supported ? 'supported' : 'requires 22.14+'})`],
    ['npm', `${dependencies.npm?.version || 'not found'} (${dependencies.npm?.path || '-'})`],
    ['Python', `${dependencies.python?.version || 'not found'} (${dependencies.python?.path || '-'})`],
    ['JS runtimes', dependencies.javaScriptRuntimes?.map((runtime) => runtime.name).join(', ') || 'not found'],
    ['yt-dlp', `${dependencies.ytDlp.version || 'not found'} (${dependencies.ytDlp.mode || '-'})`],
    ['gallery-dl', `${dependencies.galleryDl?.version || 'not found'} (${dependencies.galleryDl?.mode || '-'})`],
    ['FFmpeg', dependencies.ffmpeg.version || 'not found'],
    ['ffprobe', dependencies.ffprobe?.version || 'not found (optional)'],
    ['Browsers', dependencies.browsers?.map((browser) => browser.name || browser).join(', ') || 'none detected'],
    ['ytconv', await commandPath(process.platform === 'win32' ? 'ytconv.cmd' : 'ytconv')],
    ['TTY stdin/out', `${Boolean(process.stdin.isTTY)} / ${Boolean(process.stdout.isTTY)}`],
    ['Working directory', process.cwd()], ['Home', os.homedir()], ['Output', outputDirectory || '-'],
    ['npm prefix', process.env.npm_config_prefix || '-'], ['npm exec path', process.env.npm_execpath || '-'],
    ['Updater', selfUpdateInvocation({ currentVersion: CLI_VERSION }).strategy],
  ];
  console.log('YTConv shell information\n');
  for (const [label, value] of rows) console.log(`${label.padEnd(18)} ${value}`);
  if (process.platform === 'win32') {
    console.log('\nPowerShell: Get-Command ytconv -All');
    console.log('CMD       : where ytconv');
  } else {
    console.log('\nShell     : command -v ytconv && type -a ytconv');
    console.log(`OS setup  : ${distro.installPlan}`);
  }
  return 0;
}

export async function repairInstallation() {
  console.log('YTConv repair\n');
  const before = await inspectDependencies({ repair: false });
  console.log(`Before repair: ${before.ready ? 'all required tools are available' : `missing ${before.missing.join(', ')}`}`);
  let result;
  if (isTermux()) result = await prepareTermuxDependencies();
  else result = await prepareDesktopDependencies({ silent: false });
  const after = await inspectDependencies({ repair: false });
  console.log(`\nAfter repair: ${after.ready ? 'all required tools are ready' : `still missing ${after.missing.join(', ')}`}`);
  if (!after.ready) {
    console.log('Run ytconv doctor and ytconv --shell-info, then follow the displayed OS setup command.');
    return 3;
  }
  return result?.prepared === false && !after.ready ? 3 : 0;
}

export async function clearCaches() {
  const updateCache = await clearUpdateCache();
  const tempFiles = [path.join(os.tmpdir(), 'ytconv-update.json'), path.join(os.homedir(), '.ytconv', 'last-error.txt')];
  await Promise.all(tempFiles.map((target) => fs.rm(target, { force: true }).catch(() => {})));
  console.log(`YTConv caches cleared.\n- ${updateCache}\n- old temporary/error files\nConfiguration, profiles, history, and download archives were preserved.`);
  return 0;
}

async function writableDirectory(directory) {
  try {
    await fs.mkdir(directory, { recursive: true });
    const testFile = path.join(directory, `.ytconv-write-test-${process.pid}`);
    await fs.writeFile(testFile, 'ok', 'utf8');
    await fs.rm(testFile, { force: true });
    return true;
  } catch { return false; }
}

export async function selfTest({ outputDirectory = path.join(os.homedir(), 'Downloads', 'YTConv') } = {}) {
  const dependencies = await inspectDependencies({ repair: false });
  const updater = selfUpdateInvocation({ currentVersion: CLI_VERSION });
  const updateChannel = 'latest';
  const checks = [
    [`YTConv version is ${CLI_VERSION}`, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(CLI_VERSION)],
    ['Node.js is version 22.14 or newer', dependencies.node?.supported === true],
    ['npm is available', dependencies.npm?.installed === true],
    ['A supported JavaScript runtime is available', dependencies.javaScriptRuntimes?.length > 0],
    ['Home directory is available', Boolean(os.homedir())],
    ['Output directory is writable', await writableDirectory(outputDirectory)],
    [`Updater uses the ${updateChannel} channel`, updater.args.some((value) => String(value).includes(`ytconv@${updateChannel}`))],
    ['Subtitles are enabled by default', process.env.YTCONV_SUBTITLES === '1'],
    ['SponsorBlock default is non-destructive mark mode', process.env.YTCONV_SPONSORBLOCK_MODE === 'mark'],
    ['yt-dlp archive is enabled', Boolean(process.env.YTCONV_ARCHIVE)],
    ['gallery-dl archive is enabled', Boolean(process.env.YTCONV_GALLERY_ARCHIVE)],
    ['yt-dlp is available', dependencies.ytDlp.installed],
    ['gallery-dl is available', dependencies.galleryDl?.installed],
    ['FFmpeg is available', dependencies.ffmpeg.installed],
    ['ffprobe is available (optional)', dependencies.ffprobe?.installed !== false],
    ['Python 3 fallback is available (optional)', dependencies.python?.installed !== false],
    ['A desktop browser is available for account media (optional)', dependencies.platform?.termux || dependencies.browsers?.length > 0],
  ];
  console.log('YTConv self-test\n');
  for (const [label, ok] of checks) console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([label, ok]) => !ok && !label.includes('optional'));
  if (failed.length) console.log('\nRun ytconv repair, followed by ytconv doctor.');
  return failed.length ? 3 : 0;
}

export function systemHelpText() {
  return [
    'System, batch, and automation options:',
    '  --repair, --setup       Repair or install yt-dlp, gallery-dl, and FFmpeg',
    '  --shell-info, --where   Show distribution, package manager, PATH, Node.js, and npm',
    '  --self-test             Test dependencies, CLI defaults, and the output directory',
    '  --clear-cache           Clear update and old error caches without deleting user data',
    '  --headless              Run without the TUI for SSH, CI, cron, or scripts',
    '  --stdin                 Read URLs from standard input',
    '  --batch-file FILE       Read one URL per line from a UTF-8 text file',
    '  --jobs N                Run 1–8 batch workers',
    '  --continue-on-error     Continue the batch after an item fails',
    '  --result-json FILE      Write a machine-readable batch report',
    '  --open-output           Open the output directory after completion',
    '  --examples              Show examples for CMD, PowerShell, Linux, Termux, iSH, and SSH',
    '',
  ].join('\n');
}

export function examplesText() {
  return `YTConv ${CLI_VERSION} examples\n\n`
    + 'Quick start:\n  ytconv quickstart\n  ytconv config set output ~/Downloads/YTConv\n\n'
    + 'Profiles:\n  ytconv profile set music preset=music audioQuality=320\n  ytconv --profile music download "URL"\n\n'
    + 'CMD:\n  ytconv.cmd download "URL" --format mp3 --quality 192\n\n'
    + 'PowerShell:\n  ytconv.cmd batch links.txt --jobs 2 --result-json report.json\n\n'
    + 'Linux/macOS:\n  ytconv download "URL" --preset music\n  ytconv completion bash\n\n'
    + 'Termux:\n  ytconv --headless --preset mobile "URL"\n\n'
    + 'SSH:\n  printf "%s\\n" "URL1" "URL2" | ytconv --stdin --jobs 2 --continue-on-error\n';
}
