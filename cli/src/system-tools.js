import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import which from 'which';
import { inspectDependencies, prepareDesktopDependencies, prepareTermuxDependencies } from './dependencies.js';
import { isTermux } from './platform.js';
import { clearUpdateCache, selfUpdateInvocation } from './update.js';

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
      system.batchFile = argv[index + 1] || '';
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

export async function printShellInfo({ outputDirectory = '' } = {}) {
  const rows = [
    ['Shell', shellName()],
    ['Platform', `${process.platform} ${process.arch}`],
    ['Node', `${process.version} (${process.execPath})`],
    ['npm', await commandPath(process.platform === 'win32' ? 'npm.cmd' : 'npm')],
    ['ytconv', await commandPath(process.platform === 'win32' ? 'ytconv.cmd' : 'ytconv')],
    ['TTY stdin/out', `${Boolean(process.stdin.isTTY)} / ${Boolean(process.stdout.isTTY)}`],
    ['CWD', process.cwd()],
    ['HOME', os.homedir()],
    ['Output', outputDirectory || '-'],
    ['npm prefix', process.env.npm_config_prefix || '-'],
    ['npm execpath', process.env.npm_execpath || '-'],
    ['Updater', selfUpdateInvocation().strategy],
  ];
  console.log('YTConv shell info\n');
  for (const [label, value] of rows) console.log(`${label.padEnd(14)} ${value}`);
  if (process.platform === 'win32') {
    console.log('\nPowerShell: Get-Command ytconv -All');
    console.log('CMD       : where ytconv');
  } else {
    console.log('\nShell     : command -v ytconv && type -a ytconv');
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
    console.log('Jalankan ytconv --diagnose dan ytconv --shell-info, lalu salin hasilnya saat melaporkan bug.');
    return 1;
  }
  return result?.prepared === false && !after.ready ? 1 : 0;
}

export async function clearCaches() {
  const updateCache = await clearUpdateCache();
  const tempFiles = [
    path.join(os.tmpdir(), 'ytconv-update.json'),
    path.join(os.homedir(), '.ytconv', 'last-error.txt'),
  ];
  await Promise.all(tempFiles.map((target) => fs.rm(target, { force: true }).catch(() => {})));
  console.log(`Cache YTConv dibersihkan.\n- ${updateCache}\n- file sementara/error lama`);
  return 0;
}

export async function selfTest() {
  const dependencies = await inspectDependencies({ repair: false });
  const checks = [
    ['Node >=18', Number(process.versions.node.split('.')[0]) >= 18],
    ['Home tersedia', Boolean(os.homedir())],
    ['Updater punya strategi', Boolean(selfUpdateInvocation().strategy)],
    ['yt-dlp', dependencies.ytDlp.installed],
    ['gallery-dl', dependencies.galleryDl?.installed],
    ['FFmpeg', dependencies.ffmpeg.installed],
  ];
  console.log('YTConv self-test\n');
  for (const [label, ok] of checks) console.log(`${ok ? 'OK ' : 'FAIL'} ${label}`);
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) console.log('\nJalankan ytconv --repair untuk mencoba memperbaiki dependency.');
  return failed.length ? 1 : 0;
}

export function systemHelpText() {
  return [
    'Fitur sistem & pemula:',
    '  --repair, --setup       Perbaiki/siapkan yt-dlp, gallery-dl, dan FFmpeg',
    '  --shell-info, --where   Tampilkan shell, PATH, Node, npm, dan lokasi YTConv',
    '  --self-test             Tes cepat tanpa mengunduh media',
    '  --clear-cache           Hapus cache update dan error lama',
    '  --headless              Download tanpa tampilan TUI (SSH/CI/script)',
    '  --stdin                 Baca satu atau banyak link dari stdin',
    '  --batch-file FILE       Baca link per baris dari file teks',
    '  --continue-on-error     Batch tetap lanjut bila satu link gagal',
    '  --open-output           Buka folder hasil setelah selesai',
    '  --examples              Tampilkan contoh CMD, PowerShell, Termux, dan SSH',
    '',
  ].join('\n');
}

export function examplesText() {
  return `Contoh YTConv 1.2.3\n\n`
    + 'CMD:\n  ytconv.cmd --preset music "LINK"\n\n'
    + 'PowerShell:\n  ytconv --preset hd "LINK"\n  ytconv.cmd --repair\n\n'
    + 'Termux:\n  ytconv --headless --preset mobile "LINK"\n\n'
    + 'SSH/Linux:\n  ytconv --headless --output "$HOME/downloads" "LINK"\n'
    + '  printf "%s\\n" "LINK1" "LINK2" | ytconv --stdin --continue-on-error\n\n'
    + 'Batch file:\n  ytconv --batch-file links.txt --continue-on-error --preset balanced\n';
}
