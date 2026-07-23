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
  if (!value || value.startsWith('-')) throw new Error(`${flag} membutuhkan nilai.`);
  return value;
}

export function extractSystemOptions(argv = []) {
  const cleanArgs = [];
  const system = {
    repair: false,
    shellInfo: false,
    clearCache: false,
    selfTest: false,
    examples: false,
    headless: false,
    stdin: false,
    batchFile: '',
    continueOnError: false,
    openOutput: false,
    noColor: false,
    jobs: 1,
    resultJson: '',
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
      system.batchFile = takeValue(argv, index, arg);
      index += 1;
    } else if (arg === '--jobs') {
      const number = Number.parseInt(takeValue(argv, index, arg), 10);
      if (!Number.isInteger(number) || number < 1 || number > 8) throw new Error('--jobs harus angka 1–8.');
      system.jobs = number;
      index += 1;
    } else if (arg === '--result-json') {
      system.resultJson = path.resolve(takeValue(argv, index, arg));
      index += 1;
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
  const rows = [
    ['Shell', shellName()],
    ['Platform', `${process.platform} ${process.arch}`],
    ['Distro', distro.name],
    ['Pkg manager', distro.manager],
    ['Node', `${process.version} (${process.execPath})`],
    ['npm', await commandPath(process.platform === 'win32' ? 'npm.cmd' : 'npm')],
    ['ytconv', await commandPath(process.platform === 'win32' ? 'ytconv.cmd' : 'ytconv')],
    ['TTY stdin/out', `${Boolean(process.stdin.isTTY)} / ${Boolean(process.stdout.isTTY)}`],
    ['CWD', process.cwd()], ['HOME', os.homedir()], ['Output', outputDirectory || '-'],
    ['npm prefix', process.env.npm_config_prefix || '-'], ['npm execpath', process.env.npm_execpath || '-'],
    ['Updater', selfUpdateInvocation().strategy],
  ];
  console.log('YTConv shell info\n');
  for (const [label, value] of rows) console.log(`${label.padEnd(14)} ${value}`);
  if (process.platform === 'win32') {
    console.log('\nPowerShell: Get-Command ytconv -All');
    console.log('CMD       : where ytconv');
  } else {
    console.log('\nShell     : command -v ytconv && type -a ytconv');
    console.log(`Setup OS  : ${distro.installPlan}`);
  }
  return 0;
}

export async function repairInstallation() {
  console.log('YTConv repair\n');
  const before = await inspectDependencies({ repair: false });
  console.log(`Sebelum repair: ${before.ready ? 'sudah lengkap' : `kurang ${before.missing.join(', ')}`}`);
  let result;
  if (isTermux()) result = await prepareTermuxDependencies();
  else result = await prepareDesktopDependencies({ silent: false });
  const after = await inspectDependencies({ repair: false });
  console.log(`\nSesudah repair: ${after.ready ? 'semua dependency siap' : `masih kurang ${after.missing.join(', ')}`}`);
  if (!after.ready) {
    console.log('Jalankan ytconv doctor dan ytconv --shell-info, lalu ikuti command Setup OS yang ditampilkan.');
    return 3;
  }
  return result?.prepared === false && !after.ready ? 3 : 0;
}

export async function clearCaches() {
  const updateCache = await clearUpdateCache();
  const tempFiles = [path.join(os.tmpdir(), 'ytconv-update.json'), path.join(os.homedir(), '.ytconv', 'last-error.txt')];
  await Promise.all(tempFiles.map((target) => fs.rm(target, { force: true }).catch(() => {})));
  console.log(`Cache YTConv dibersihkan.\n- ${updateCache}\n- file sementara/error lama`);
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
  const checks = [
    ['YTConv version', CLI_VERSION === '1.3.0'],
    ['Node >=18', Number(process.versions.node.split('.')[0]) >= 18],
    ['Home tersedia', Boolean(os.homedir())],
    ['Folder output dapat ditulis', await writableDirectory(outputDirectory)],
    ['Updater punya strategi', Boolean(selfUpdateInvocation().strategy)],
    ['yt-dlp', dependencies.ytDlp.installed],
    ['gallery-dl', dependencies.galleryDl?.installed],
    ['FFmpeg', dependencies.ffmpeg.installed],
    ['ffprobe (opsional)', dependencies.ffprobe?.installed !== false],
  ];
  console.log('YTConv self-test\n');
  for (const [label, ok] of checks) console.log(`${ok ? 'OK ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([label, ok]) => !ok && !label.includes('opsional'));
  if (failed.length) console.log('\nJalankan ytconv repair lalu ytconv doctor.');
  return failed.length ? 3 : 0;
}

export function systemHelpText() {
  return [
    'Fitur sistem, batch, dan automasi:',
    '  --repair, --setup       Perbaiki/siapkan yt-dlp, gallery-dl, dan FFmpeg',
    '  --shell-info, --where   Tampilkan distro, package manager, PATH, Node, dan npm',
    '  --self-test             Tes dependency dan folder output tanpa download',
    '  --clear-cache           Hapus cache update dan error lama',
    '  --headless              Download tanpa TUI (SSH/CI/script)',
    '  --stdin                 Baca link dari stdin',
    '  --batch-file FILE       Baca link per baris dari file teks',
    '  --jobs N                Maksimal 1–8 download batch bersamaan',
    '  --continue-on-error     Batch tetap lanjut bila satu link gagal',
    '  --result-json FILE      Simpan ringkasan batch untuk bot/script',
    '  --open-output           Buka folder hasil setelah selesai',
    '  --examples              Contoh CMD, PowerShell, Linux, Termux, iSH, dan SSH',
    '',
  ].join('\n');
}

export function examplesText() {
  return `Contoh YTConv 1.3.0\n\n`
    + 'CMD:\n  ytconv.cmd download "LINK" --format mp3 --quality 192\n  ytconv.cmd playlist "LINK" --archive downloaded.txt\n\n'
    + 'PowerShell:\n  ytconv.cmd batch links.txt --jobs 2 --result-json report.json\n  ytconv.cmd doctor\n\n'
    + 'Linux/macOS:\n  ytconv download "LINK" --preset music\n  ytconv formats "LINK" --json\n\n'
    + 'Termux:\n  ytconv --headless --preset mobile "LINK"\n\n'
    + 'SSH:\n  printf "%s\\n" "LINK1" "LINK2" | ytconv --stdin --jobs 2 --continue-on-error\n\n'
    + 'Cookies browser desktop:\n  ytconv download "LINK" --cookies-from-browser chrome\n';
}
