import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { parseCliOptions } from './cli-options.js';

const SCHEMA_VERSION = 1;
const MAX_HISTORY_ROWS = 500;
const PROFILE_NAME = /^[a-z0-9][a-z0-9._-]{0,39}$/u;

const SETTINGS = {
  preset: { flag: '--preset', type: 'value' },
  output: { flag: '--output', type: 'value' },
  audioFormat: { flag: '--audio-format', type: 'value' },
  audioQuality: { flag: '--audio-quality', type: 'value' },
  videoFormat: { flag: '--video-format', type: 'value' },
  resolution: { flag: '--resolution', type: 'value' },
  subtitleLanguages: { flag: '--subtitle-langs', type: 'value' },
  subtitles: { flag: '--subtitles', negative: '--no-subtitles', type: 'boolean' },
  sponsorBlock: { flag: '--sponsorblock', type: 'value' },
  archive: { flag: '--archive', negative: '--no-archive', type: 'archive' },
  concurrentFragments: { flag: '--concurrent-fragments', type: 'value' },
  rateLimit: { flag: '--rate-limit', type: 'value' },
  restrictFilenames: { flag: '--restrict-filenames', type: 'boolean' },
  normalizeAudio: { flag: '--normalize-audio', type: 'boolean' },
  retries: { flag: '--retries', type: 'value' },
  fragmentRetries: { flag: '--fragment-retries', type: 'value' },
};

function appDirectory(homeDirectory = os.homedir()) {
  return path.join(homeDirectory, '.ytconv');
}

export function userDataPaths(homeDirectory = os.homedir()) {
  const directory = appDirectory(homeDirectory);
  return {
    directory,
    config: path.join(directory, 'config.json'),
    history: path.join(directory, 'history.jsonl'),
  };
}

function emptyConfig() {
  return { schemaVersion: SCHEMA_VERSION, defaults: {}, activeProfile: '', profiles: {} };
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function readUserConfig({ homeDirectory = os.homedir() } = {}) {
  const { config } = userDataPaths(homeDirectory);
  const value = await readJson(config, emptyConfig());
  return {
    schemaVersion: SCHEMA_VERSION,
    defaults: value?.defaults && typeof value.defaults === 'object' ? value.defaults : {},
    activeProfile: typeof value?.activeProfile === 'string' ? value.activeProfile : '',
    profiles: value?.profiles && typeof value.profiles === 'object' ? value.profiles : {},
  };
}

export async function writeUserConfig(value, { homeDirectory = os.homedir() } = {}) {
  const { directory, config } = userDataPaths(homeDirectory);
  await fs.mkdir(directory, { recursive: true });
  const temporary = `${config}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporary, config);
  return config;
}

function booleanValue(value, key) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  throw new Error(`${key} must be true/false, yes/no, on/off, or 1/0.`);
}

function normalizedSettingValue(key, value) {
  const setting = SETTINGS[key];
  if (!setting) throw new Error(`Unknown setting "${key}". Available settings: ${Object.keys(SETTINGS).join(', ')}.`);
  if (setting.type === 'boolean') return booleanValue(value, key);
  if (setting.type === 'archive') {
    const normalized = String(value).trim();
    if (['false', 'off', 'none', '0'].includes(normalized.toLowerCase())) return false;
    if (!normalized) throw new Error('archive requires a file path or false.');
    return normalized;
  }
  const normalized = String(value).trim();
  if (!normalized) throw new Error(`${key} cannot be empty.`);
  return normalized;
}

export function settingsToArgs(values = {}) {
  const args = [];
  for (const [key, rawValue] of Object.entries(values)) {
    const setting = SETTINGS[key];
    if (!setting) continue;
    const value = normalizedSettingValue(key, rawValue);
    if (setting.type === 'boolean') {
      if (value) args.push(setting.flag);
      else if (setting.negative) args.push(setting.negative);
    } else if (setting.type === 'archive' && value === false) {
      args.push(setting.negative);
    } else {
      args.push(setting.flag, String(value));
    }
  }
  return args;
}

export function validateSettings(values = {}) {
  const args = settingsToArgs(values);
  const parserArgs = args.filter((item) => !['--no-subtitles', '--no-archive'].includes(item));
  parseCliOptions(parserArgs);
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, normalizedSettingValue(key, value)]));
}

function parseAssignment(value) {
  const index = String(value).indexOf('=');
  if (index <= 0) throw new Error(`Expected key=value, received: ${value}`);
  return [String(value).slice(0, index), String(value).slice(index + 1)];
}

function profileName(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!PROFILE_NAME.test(normalized)) throw new Error('Profile names must be 1–40 lowercase letters, numbers, dots, underscores, or hyphens.');
  return normalized;
}

export async function resolveUserArguments(argv = [], { homeDirectory = os.homedir() } = {}) {
  const remaining = [];
  let selectedProfile = '';
  let disabled = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--no-config') disabled = true;
    else if (value === '--profile') {
      const next = argv[index + 1];
      if (!next || next.startsWith('-')) throw new Error('--profile requires a profile name.');
      selectedProfile = profileName(next);
      index += 1;
    } else remaining.push(value);
  }

  if (disabled) return { args: remaining, config: emptyConfig(), profile: '' };
  const config = await readUserConfig({ homeDirectory });
  const active = selectedProfile || config.activeProfile;
  const profile = active ? config.profiles[active] : null;
  if (active && !profile) throw new Error(`Profile "${active}" does not exist. Run ytconv profile list.`);
  const merged = { ...config.defaults, ...(profile?.settings || {}) };
  return { args: [...settingsToArgs(merged), ...remaining], config, profile: active };
}

function printObject(value) {
  console.log(JSON.stringify(value, null, 2));
}

function configHelp() {
  return [
    'Configuration commands:',
    '  ytconv config list',
    '  ytconv config path',
    '  ytconv config get KEY',
    '  ytconv config set KEY VALUE',
    '  ytconv config unset KEY',
    '  ytconv config reset',
    '',
    `Settings: ${Object.keys(SETTINGS).join(', ')}`,
  ].join('\n');
}

function profileHelp() {
  return [
    'Profile commands:',
    '  ytconv profile list',
    '  ytconv profile show NAME',
    '  ytconv profile set NAME key=value [key=value ...]',
    '  ytconv profile use NAME',
    '  ytconv profile delete NAME',
    '  ytconv profile clear',
    '',
    'Use a profile once: ytconv --profile NAME download "URL"',
  ].join('\n');
}

async function handleConfig(args, options) {
  const action = args[1] || 'list';
  const config = await readUserConfig(options);
  const paths = userDataPaths(options.homeDirectory);
  if (action === 'list') { printObject(config); return 0; }
  if (action === 'path') { console.log(paths.config); return 0; }
  if (action === 'get') {
    const key = args[2];
    if (!key) throw new Error('config get requires a key.');
    if (!(key in config.defaults)) return 1;
    console.log(typeof config.defaults[key] === 'string' ? config.defaults[key] : JSON.stringify(config.defaults[key]));
    return 0;
  }
  if (action === 'set') {
    const key = args[2];
    const value = args[3];
    if (!key || value === undefined) throw new Error('config set requires KEY and VALUE.');
    const normalized = validateSettings({ [key]: value })[key];
    config.defaults[key] = normalized;
    const target = await writeUserConfig(config, options);
    console.log(`Saved ${key} in ${target}`);
    return 0;
  }
  if (action === 'unset') {
    const key = args[2];
    if (!key) throw new Error('config unset requires a key.');
    delete config.defaults[key];
    await writeUserConfig(config, options);
    console.log(`Removed ${key}.`);
    return 0;
  }
  if (action === 'reset') {
    await writeUserConfig(emptyConfig(), options);
    console.log('Configuration and profiles were reset. Download history was preserved.');
    return 0;
  }
  console.log(configHelp());
  return action === 'help' ? 0 : 2;
}

async function handleProfile(args, options) {
  const action = args[1] || 'list';
  const config = await readUserConfig(options);
  if (action === 'list') {
    const names = Object.keys(config.profiles).sort();
    if (!names.length) console.log('No profiles are configured.');
    for (const name of names) console.log(`${name}${config.activeProfile === name ? ' *' : ''}`);
    return 0;
  }
  if (action === 'show') {
    const name = profileName(args[2]);
    if (!config.profiles[name]) throw new Error(`Profile "${name}" does not exist.`);
    printObject(config.profiles[name]);
    return 0;
  }
  if (action === 'set') {
    const name = profileName(args[2]);
    if (args.length < 4) throw new Error('profile set requires at least one key=value setting.');
    const settings = {};
    for (const assignment of args.slice(3)) {
      const [key, value] = parseAssignment(assignment);
      settings[key] = value;
    }
    config.profiles[name] = { settings: validateSettings(settings), updatedAt: new Date().toISOString() };
    const target = await writeUserConfig(config, options);
    console.log(`Saved profile "${name}" in ${target}`);
    return 0;
  }
  if (action === 'use') {
    const name = profileName(args[2]);
    if (!config.profiles[name]) throw new Error(`Profile "${name}" does not exist.`);
    config.activeProfile = name;
    await writeUserConfig(config, options);
    console.log(`Active profile: ${name}`);
    return 0;
  }
  if (action === 'delete') {
    const name = profileName(args[2]);
    delete config.profiles[name];
    if (config.activeProfile === name) config.activeProfile = '';
    await writeUserConfig(config, options);
    console.log(`Deleted profile "${name}".`);
    return 0;
  }
  if (action === 'clear') {
    config.activeProfile = '';
    await writeUserConfig(config, options);
    console.log('The active profile was cleared.');
    return 0;
  }
  console.log(profileHelp());
  return action === 'help' ? 0 : 2;
}

export async function appendHistory(entry, { homeDirectory = os.homedir() } = {}) {
  const { directory, history } = userDataPaths(homeDirectory);
  await fs.mkdir(directory, { recursive: true });
  const safe = {
    timestamp: new Date().toISOString(),
    version: entry.version,
    command: entry.command,
    urls: Array.isArray(entry.urls) ? entry.urls.slice(0, 100) : [],
    preset: entry.preset || 'balanced',
    mode: entry.mode || 'auto',
    outputDirectory: entry.outputDirectory || '',
    profile: entry.profile || '',
    exitCode: Number(entry.exitCode) || 0,
  };
  await fs.appendFile(history, `${JSON.stringify(safe)}\n`, { encoding: 'utf8', mode: 0o600 });

  const rows = (await fs.readFile(history, 'utf8')).split(/\r?\n/u).filter(Boolean);
  if (rows.length > MAX_HISTORY_ROWS) {
    await fs.writeFile(history, `${rows.slice(-MAX_HISTORY_ROWS).join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
  }
  return history;
}

export async function readHistory({ homeDirectory = os.homedir(), limit = 20 } = {}) {
  const { history } = userDataPaths(homeDirectory);
  try {
    const rows = (await fs.readFile(history, 'utf8')).split(/\r?\n/u).filter(Boolean);
    return rows.slice(-Math.max(1, Math.min(Number(limit) || 20, 500))).reverse()
      .map((row) => JSON.parse(row));
  } catch {
    return [];
  }
}

async function handleHistory(args, options) {
  const action = args[1] || 'list';
  const paths = userDataPaths(options.homeDirectory);
  if (action === 'clear') {
    await fs.rm(paths.history, { force: true });
    console.log('Download history was cleared.');
    return 0;
  }
  const json = args.includes('--json');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 20;
  const rows = await readHistory({ ...options, limit });
  if (json) printObject({ schemaVersion: 1, count: rows.length, history: rows });
  else if (!rows.length) console.log('No download history is available.');
  else for (const row of rows) console.log(`${row.timestamp}  exit=${row.exitCode}  ${row.mode}/${row.preset}  ${row.urls[0] || '-'}`);
  return 0;
}

function completionScript(shell) {
  const commands = 'download playlist batch info formats subtitles extract transcript login logout social doctor repair clean update config profile history completion quickstart docs about shortcuts donate';
  if (shell === 'bash') return `# Add to ~/.bashrc\ncomplete -W "${commands}" ytconv`;
  if (shell === 'zsh') return `# Add to ~/.zshrc\ncompdef '_arguments "1:command:(${commands})"' ytconv`;
  if (shell === 'fish') return commands.split(' ').map((name) => `complete -c ytconv -f -a ${name}`).join('\n');
  if (shell === 'powershell') return `Register-ArgumentCompleter -Native -CommandName ytconv,ytconv.cmd -ScriptBlock { param($wordToComplete) '${commands}'.Split(' ') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_,$_, 'ParameterValue',$_) } }`;
  throw new Error('completion requires bash, zsh, fish, or powershell.');
}

export async function handleUserDataCommand(argv = [], { homeDirectory = os.homedir() } = {}) {
  const command = String(argv[0] || '').toLowerCase();
  const options = { homeDirectory };
  if (command === 'config') return { handled: true, exitCode: await handleConfig(argv, options) };
  if (command === 'profile') return { handled: true, exitCode: await handleProfile(argv, options) };
  if (command === 'history') return { handled: true, exitCode: await handleHistory(argv, options) };
  if (command === 'completion') {
    console.log(completionScript(String(argv[1] || '').toLowerCase()));
    return { handled: true, exitCode: 0 };
  }
  if (command === 'quickstart') {
    console.log([
      'YTConv quick start:',
      '  1. ytconv doctor                         # install engines automatically',
      '  2. ytconv login instagram                # only when the URL needs an account',
      '  3. ytconv config set output ~/Downloads/YTConv',
      '  4. ytconv profile set music preset=music audioQuality=320',
      '  5. ytconv --profile music download "URL"',
      '',
      'Run ytconv --help for every media option.',
    ].join('\n'));
    return { handled: true, exitCode: 0 };
  }
  return { handled: false, exitCode: 0 };
}

export function userDataHelpText() {
  return [
    'Persistent CLI features:',
    '  ytconv config ...          Save validated defaults in ~/.ytconv/config.json',
    '  ytconv profile ...         Create and activate named setting profiles',
    '  ytconv history [--json]    Show the local download history',
    '  ytconv completion SHELL    Generate bash/zsh/fish/PowerShell completion',
    '  ytconv quickstart          Show a five-step beginner setup',
    '  --profile NAME             Use one saved profile for this run',
    '  --no-config                Ignore saved settings for this run',
    '',
  ].join('\n');
}
