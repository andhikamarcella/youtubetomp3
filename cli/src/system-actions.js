import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';
import { isTermux } from './platform.js';

async function exists(target) {
  if (!target) return false;
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function androidRelativePath(target) {
  const normalized = String(target ?? '').replace(/\\/gu, '/');
  const sharedMatch = normalized.match(/\/storage\/emulated\/0\/(.+)$/u);
  if (sharedMatch) return sharedMatch[1];

  const homeDownloads = path.join(os.homedir(), 'storage', 'downloads').replace(/\\/gu, '/');
  if (normalized === homeDownloads) return 'Download';
  if (normalized.startsWith(`${homeDownloads}/`)) {
    return `Download/${normalized.slice(homeDownloads.length + 1)}`;
  }

  return null;
}

export function androidDirectoryUri(directory) {
  const relative = androidRelativePath(directory);
  if (!relative) return null;
  return `content://com.android.externalstorage.documents/document/${encodeURIComponent(`primary:${relative}`)}`;
}

export function outputOpenAttempts({
  directory,
  filePath = '',
  platform = process.platform,
  termux = isTermux(),
} = {}) {
  if (termux) {
    const uri = androidDirectoryUri(directory);
    return [
      ...(uri ? [{
        command: 'am',
        args: [
          'start',
          '-a',
          'android.intent.action.VIEW',
          '-d',
          uri,
          '-t',
          'vnd.android.document/directory',
        ],
        label: 'Android file manager',
      }] : []),
      { command: 'termux-open', args: ['--view', directory], label: 'termux-open folder' },
      ...(filePath ? [{ command: 'termux-open', args: ['--view', filePath], label: 'termux-open file' }] : []),
    ];
  }

  if (platform === 'win32') {
    return [
      ...(filePath ? [{
        command: 'explorer.exe',
        args: [`/select,${filePath}`],
        label: 'Windows Explorer select file',
      }] : []),
      { command: 'explorer.exe', args: [directory], label: 'Windows Explorer folder' },
      {
        command: 'powershell.exe',
        args: [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Start-Process -FilePath explorer.exe -ArgumentList @($args[0])',
          directory,
        ],
        label: 'PowerShell Explorer fallback',
      },
    ];
  }

  if (platform === 'darwin') {
    return [
      ...(filePath ? [{ command: 'open', args: ['-R', filePath], label: 'Finder select file' }] : []),
      { command: 'open', args: [directory], label: 'Finder folder' },
    ];
  }

  return [
    { command: 'xdg-open', args: [directory], label: 'xdg-open' },
    { command: 'gio', args: ['open', directory], label: 'GIO open' },
  ];
}

export function fileOpenAttempts({
  filePath,
  platform = process.platform,
  termux = isTermux(),
} = {}) {
  if (!filePath) return [];
  if (termux) return [{ command: 'termux-open', args: ['--view', filePath], label: 'termux-open file' }];
  if (platform === 'win32') return [{ command: 'cmd.exe', args: ['/d', '/s', '/c', 'start', '', filePath], label: 'Windows default app' }];
  if (platform === 'darwin') return [{ command: 'open', args: [filePath], label: 'macOS default app' }];
  return [
    { command: 'xdg-open', args: [filePath], label: 'xdg-open file' },
    { command: 'gio', args: ['open', filePath], label: 'GIO open file' },
  ];
}

function runDetached({ command, args, label }) {
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, command, args, label });
    };

    let child;
    try {
      child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: process.env,
      });
    } catch (error) {
      finish({ ok: false, error });
      return;
    }

    child.once('error', (error) => finish({ ok: false, error }));
    child.once('spawn', () => {
      child.unref();
      timer = setTimeout(() => finish({ ok: true }), 350);
    });
    child.once('exit', (code) => {
      if (code === 0) finish({ ok: true });
      else finish({ ok: false, error: new Error(`${command} exit code ${code ?? 'unknown'}`) });
    });
  });
}

async function runAttempts(attempts) {
  const errors = [];
  for (const attempt of attempts) {
    const result = await runDetached(attempt);
    if (result.ok) return result;
    errors.push(result.error?.message || `${attempt.command} gagal`);
  }
  return {
    ok: false,
    error: new Error(errors.join(' · ') || 'Tidak ada aplikasi pembuka yang tersedia.'),
  };
}

export async function openOutputLocation({ directory, filePath = '' } = {}) {
  await fs.mkdir(directory, { recursive: true });
  const usableFile = await exists(filePath) ? filePath : '';
  return runAttempts(outputOpenAttempts({ directory, filePath: usableFile }));
}

export async function openOutputFile(filePath) {
  if (!await exists(filePath)) {
    return { ok: false, error: new Error('File hasil belum ditemukan.') };
  }
  return runAttempts(fileOpenAttempts({ filePath }));
}

function runClipboard(command, args, input) {
  const result = spawnSync(command, args, {
    input,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5_000,
    env: process.env,
  });
  return !result.error && result.status === 0;
}

export function copyText(text, {
  platform = process.platform,
  termux = isTermux(),
} = {}) {
  const value = String(text ?? '');
  if (!value) return false;

  if (termux) return runClipboard('termux-clipboard-set', [], value);
  if (platform === 'win32') {
    return runClipboard(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$input | Set-Clipboard'],
      value,
    );
  }
  if (platform === 'darwin') return runClipboard('pbcopy', [], value);
  return runClipboard('wl-copy', [], value)
    || runClipboard('xclip', ['-selection', 'clipboard'], value);
}
