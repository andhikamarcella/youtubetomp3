import { spawn } from 'node:child_process';

export function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    if (options.capture) {
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
    }

    child.on('error', reject);
    child.on('close', (code, signal) => {
      const result = { code: code ?? 1, signal, stdout: stdout.trim(), stderr: stderr.trim() };
      if (code === 0 || options.allowFailure) resolve(result);
      else reject(new Error(`${command} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
    });
  });
}
