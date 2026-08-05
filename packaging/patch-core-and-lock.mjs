import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = '1.6.6';
const branch = 'release/ytconv-1.6.6-socket-hardening';

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function write(relative, value) {
  fs.writeFileSync(path.join(root, relative), value.replace(/\r\n/gu, '\n'));
}

function replaceRequired(value, pattern, replacement, label) {
  if (!pattern.test(value)) throw new Error(`Missing ${label}`);
  pattern.lastIndex = 0;
  return value.replace(pattern, replacement);
}

const lockPath = 'cli/package-lock.json';
const lock = JSON.parse(read(lockPath));
lock.version = version;
lock.packages[''].version = version;
write(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

const corePath = 'cli/ish/ytconv-core.py';
let core = read(corePath);
core = replaceRequired(
  core,
  /"""YTConv [^\n]+ native frontend for iSH\/Alpine and Python-only shells\."""/u,
  `"""YTConv ${version} native frontend for iSH/Alpine and Python-only shells."""`,
  'iSH core module version',
);
core = replaceRequired(core, /^VERSION = "[^"]+"$/mu, `VERSION = "${version}"`, 'iSH core VERSION');
core = replaceRequired(
  core,
  /^RAW_BASE = "https:\/\/raw\.githubusercontent\.com\/andhikamarcella\/youtubetomp3\/[^\n]+\/cli"$/mu,
  `RAW_BASE = "https://raw.githubusercontent.com/andhikamarcella/YTConv/${branch}/cli"`,
  'iSH core release branch',
);
core = core.replace(
  'result = subprocess.run(["sh", target], check=False)',
  'result = subprocess.run(["sh", target], check=False, env=child_environment())',
);
core = core.replace(
  'if subprocess.run(command, check=False).returncode == 0:',
  'if subprocess.run(command, check=False, env=child_environment()).returncode == 0:',
);
core = core.replace(
  'subprocess.run(["apk", "update"], check=False)',
  'subprocess.run(["apk", "update"], check=False, env=child_environment())',
);
core = core.replace(
  '["apk", "add", "--no-cache", "python3", "py3-pip", "ffmpeg", "curl", "ca-certificates", "nodejs"],\n            check=False,',
  '["apk", "add", "--no-cache", "python3", "py3-pip", "ffmpeg", "curl", "ca-certificates"],\n            check=False,\n            env=child_environment(),',
);
core = core.replace(
  '"--retry-sleep", "fragment:%s" % options.retry_sleep,\n        "--output",',
  '"--retry-sleep", "fragment:%s" % options.retry_sleep,\n        "--retry-sleep", "file_access:%s" % options.retry_sleep,\n        "--output",',
);
write(corePath, core);

const wrapperPath = 'cli/ish/ytconv.py';
const checksumPath = 'cli/ish/SHA256SUMS';
const hashes = [wrapperPath, corePath].map((relative) => {
  const bytes = fs.readFileSync(path.join(root, relative));
  return `${crypto.createHash('sha256').update(bytes).digest('hex')}  ${path.basename(relative)}`;
});
write(checksumPath, `${hashes.join('\n')}\n`);

console.log(`Synchronized YTConv ${version} core, lockfile, and iSH checksums.`);
