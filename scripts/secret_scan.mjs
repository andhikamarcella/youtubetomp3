import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).stdout.split(/\r?\n/).filter(Boolean)
  .filter((file) => !/^(node_modules|next-app\/node_modules)\//.test(file))
  .filter((file) => !/package-lock\.json$|\.png$|\.jpg$|\.jpeg$|\.webp$|\.svg$|\.ico$|\.pdf$|\.tsbuildinfo$/.test(file));

const patterns = [
  { name: 'OpenAI-style API key', regex: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { name: 'Google private key block', regex: /-----BEGIN PRIVATE KEY-----/ },
  { name: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Railway/Postgres credential URL', regex: /postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@/i },
  { name: 'Bearer token literal', regex: /Bearer\s+[A-Za-z0-9._~+/-]{30,}/ },
  { name: 'Cloudinary credential URL', regex: /cloudinary:\/\/\d+:[^\s@]+@/i },
];

const allowlistedLine = (line) => /USER:PASSWORD@HOST|user:pass@example|placeholder|example|regex:|name: 'Google private key block'|name: 'Railway\/Postgres credential URL'/i.test(line);
const findings = [];
for (const file of files) {
  let text = '';
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  text.split(/\r?\n/).forEach((line, index) => {
    if (allowlistedLine(line)) return;
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) findings.push(`${file}:${index + 1}: ${pattern.name}`);
    }
  });
}

if (findings.length) {
  console.error('Potential secrets detected:\n' + findings.join('\n'));
  process.exit(1);
}
console.log(`Secret scan passed for ${files.length} tracked text files.`);
