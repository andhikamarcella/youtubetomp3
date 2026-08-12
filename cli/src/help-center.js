import process from 'node:process';
import { CLI_VERSION } from './version.js';

const REPOSITORY = 'https://github.com/andhikamarcella/YTConv';
const RELEASE_BRANCH = 'release/ytconv-1.7.6';
const DOCS_ROOT = `${REPOSITORY}/tree/${RELEASE_BRANCH}/cli/docs`;
const SUPPORT_EMAIL = 'help.ytconv@proton.me';

const TOPICS = Object.freeze([
  ['index', 'Documentation hub', 'README.md', ['home', 'start', 'readme']],
  ['installation', 'Installation and upgrade', 'INSTALLATION.md', ['install', 'upgrade', 'setup']],
  ['commands', 'Commands and options', 'COMMANDS.md', ['command', 'cli', 'options']],
  ['configuration', 'Configuration and profiles', 'CONFIGURATION.md', ['config', 'profile', 'settings']],
  ['authentication', 'Authentication and browser recovery', 'AUTHENTICATION.md', ['auth', 'login', 'browser-auth']],
  ['cookies', 'cookies.txt beginner guide', 'COOKIES.md', ['cookie', 'netscape', 'browser-cookie']],
  ['formats', 'Audio and video format guide', 'FORMAT-GUIDE.md', ['format', 'mp3', 'mp4', 'codec']],
  ['extract', 'Transcript and content extraction', 'CONTENT-EXTRACTION.md', ['content', 'transcript', 'metadata']],
  ['upscaling', 'Video upscaling guide', 'UPSCALING.md', ['upscale', '4k', '2160p']],
  ['deno', 'Deno and JavaScript runtime guide', 'DENO.md', ['javascript', 'runtime', 'ejs']],
  ['troubleshooting', 'Troubleshooting and diagnostics', 'TROUBLESHOOTING.md', ['trouble', 'fix', 'doctor', 'diagnose']],
  ['platforms', 'Platform-specific guidance', 'PLATFORMS.md', ['platform', 'windows', 'linux', 'macos', 'termux', 'ish']],
  ['packages', 'Native packages and artifacts', 'PACKAGES.md', ['package', 'apk', 'exe', 'flatpak', 'nix']],
  ['security', 'Security model', '../SECURITY.md', ['safe', 'privacy']],
  ['releases', 'Releases, checksums, and provenance', 'RELEASES.md', ['release', 'checksum', 'provenance']],
  ['development', 'Development and testing', 'DEVELOPMENT.md', ['develop', 'contribute', 'test']],
  ['architecture', 'Architecture and process boundaries', 'ARCHITECTURE.md', ['internals', 'design']],
  ['nodejs', 'Node.js integration', 'NODEJS.md', ['node', 'api', 'library']],
  ['faq', 'Frequently asked questions', 'FAQ.md', ['questions', 'help']],
  ['migration', 'Migration to YTConv 1.7.6', 'MIGRATION-1.7.6.md', ['migrate', '1.7.6', 'repository']],
  ['trusted-publishing', 'npm Trusted Publishing', 'TRUSTED-PUBLISHING.md', ['oidc', 'npm', 'publish']],
  ['help-center', 'Interactive help center', 'HELP-CENTER.md', ['docs-command', 'about', 'shortcuts']],
  ['support', 'Support and bug reports', 'SUPPORT.md', ['email', 'bug', 'contact']],
  ['donate', 'Donate — just pay what you can', 'DONATE.md', ['donation', 'kofi', 'ko-fi', 'saweria', 'funding']],
]);

function normalized(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9.]+/gu, '-').replace(/^-|-$/gu, '');
}

export function documentationTopics() {
  return TOPICS.map(([key, label]) => ({ key, label }));
}

export function resolveDocumentationTopic(value = 'index') {
  const query = normalized(value) || 'index';
  const exact = TOPICS.find(([key, , , aliases]) => key === query || aliases.includes(query));
  if (exact) return { key: exact[0], label: exact[1], file: exact[2] };
  const prefix = TOPICS.filter(([key, label, , aliases]) =>
    key.startsWith(query) || normalized(label).includes(query) || aliases.some((alias) => alias.startsWith(query)));
  if (prefix.length === 1) return { key: prefix[0][0], label: prefix[0][1], file: prefix[0][2] };
  return null;
}

export function documentationUrl(value = 'index') {
  const topic = resolveDocumentationTopic(value);
  if (!topic) return null;
  if (topic.key === 'index') return DOCS_ROOT;
  if (topic.file === '../SECURITY.md') return `${REPOSITORY}/blob/${RELEASE_BRANCH}/cli/SECURITY.md`;
  return `${REPOSITORY}/blob/${RELEASE_BRANCH}/cli/docs/${topic.file}`;
}

function panel(title, rows, columns = 80) {
  const width = Math.max(42, Math.min(88, Number(columns) || 80));
  const inner = width - 4;
  const line = (value = '') => `│ ${String(value).padEnd(inner, ' ')} │`;
  const wrap = (value = '') => {
    const source = String(value);
    if (!source) return [''];
    const parts = [];
    for (let offset = 0; offset < source.length; offset += inner) {
      parts.push(source.slice(offset, offset + inner));
    }
    return parts;
  };
  return [
    `┌${'─'.repeat(width - 2)}┐`,
    ...wrap(title).map(line),
    `├${'─'.repeat(width - 2)}┤`,
    ...rows.flatMap((value) => wrap(value).map(line)),
    `└${'─'.repeat(width - 2)}┘`,
  ].join('\n');
}

export function aboutText(columns = process.stdout.columns) {
  return panel(`YTConv ${CLI_VERSION} · Help Center`, [
    'Secure downloader and converter for supported social platforms',
    '',
    `Repository  ${REPOSITORY}`,
    'npm         https://www.npmjs.com/package/ytconv',
    `Docs        ${DOCS_ROOT}`,
    `Support     ${SUPPORT_EMAIL}`,
    'Donate      ytconv donate',
    '',
    'Start       ytconv',
    'Docs        ytconv docs --list',
    'Diagnose    ytconv --diagnose',
    'Shortcuts   ytconv shortcuts',
    'Update      npm install -g ytconv@latest',
    '',
    `Copyright © 2026 YTConv Project · ${SUPPORT_EMAIL}`,
  ], columns);
}

export function shortcutsText(columns = process.stdout.columns) {
  return panel(`YTConv ${CLI_VERSION} · Interactive Shortcuts`, [
    'Enter      download or convert',
    'Ctrl+M     cycle AUTO / VIDEO / AUDIO / IMAGE',
    'Ctrl+A/T   cycle audio or video format',
    'Ctrl+Q/F   cycle quality or image format',
    'Ctrl+G/B   cycle platform or access source',
    'Ctrl+S/P   toggle subtitles or playlist',
    'Ctrl+U     cycle output upscaling height',
    'Ctrl+V     paste URL from clipboard',
    'H / D      help / diagnostics',
    'N          donation options',
    'Q / Esc    exit safely',
    '',
    `Help       ${SUPPORT_EMAIL}`,
  ], columns);
}

export function docsText(value = 'index', columns = process.stdout.columns) {
  const topic = resolveDocumentationTopic(value);
  if (!topic) return null;
  const url = documentationUrl(topic.key);
  const summary = panel(`YTConv ${CLI_VERSION} · ${topic.label}`, [
    url,
    '',
    'The complete URL is repeated below without borders for easy copying.',
    'List topics: ytconv docs --list',
    'Project info: ytconv about',
  ], columns);
  return `${summary}\n\n${url}`;
}

export function docsListText(columns = process.stdout.columns) {
  const rows = TOPICS.map(([key, label]) => `${key.padEnd(20)} ${label}`);
  rows.push('', 'Open a topic: ytconv docs <topic>');
  return panel(`YTConv ${CLI_VERSION} · Documentation Topics`, rows, columns);
}

export function handleHelpCenterCommand(argv, options = {}) {
  const args = Array.isArray(argv) ? argv : [];
  const command = normalized(args[0]);
  const write = options.write ?? ((value) => console.log(value));
  const columns = options.columns ?? process.stdout.columns;

  if (['about', 'welcome', 'info'].includes(command)) {
    write(aboutText(columns));
    return { handled: true, exitCode: 0, action: 'about' };
  }
  if (['shortcuts', 'keys'].includes(command)) {
    write(shortcutsText(columns));
    return { handled: true, exitCode: 0, action: 'shortcuts' };
  }
  if (!['docs', 'documentation', 'guide'].includes(command)) {
    return { handled: false, exitCode: 0 };
  }
  if (args.includes('--list') || args.includes('-l')) {
    write(docsListText(columns));
    return { handled: true, exitCode: 0, action: 'docs-list' };
  }
  const topicInput = args.slice(1).find((value) => !String(value).startsWith('-')) || 'index';
  const text = docsText(topicInput, columns);
  if (!text) {
    write(`Unknown documentation topic: ${topicInput}\n\n${docsListText(columns)}`);
    return { handled: true, exitCode: 2, action: 'docs-error' };
  }
  write(text);
  return { handled: true, exitCode: 0, action: 'docs', topic: resolveDocumentationTopic(topicInput).key };
}
