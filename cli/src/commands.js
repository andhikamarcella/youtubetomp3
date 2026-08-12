const URL_PATTERN = /^https?:\/\//iu;

function withoutFlag(args, flag) {
  return args.filter((value) => value !== flag);
}

export function normalizeCommandArgs(argv = []) {
  if (!argv.length) return [];
  const [rawCommand, ...rest] = argv;
  if (rawCommand.startsWith('-') || URL_PATTERN.test(rawCommand)) return [...argv];

  const command = rawCommand.toLowerCase();
  switch (command) {
    case 'download':
    case 'dl':
    case 'get': return rest;
    case 'playlist':
    case 'pl': return ['--playlist', ...rest];
    case 'batch': return rest.length ? ['--batch-file', rest[0], '--continue-on-error', ...rest.slice(1)] : ['--batch-file'];
    case 'info':
    case 'inspect': return ['--dry-run', ...rest];
    case 'formats': return rest.includes('--json')
      ? ['--formats-json', ...withoutFlag(rest, '--json')]
      : ['--list-formats', ...rest];
    case 'subtitles':
    case 'subs': return ['--list-subs', ...rest];
    case 'extract':
    case 'content': return ['--subtitle-only', '--metadata-files', ...rest];
    case 'transcript':
    case 'text': return ['--subtitle-only', ...rest];
    case 'doctor': return ['--doctor', ...rest];
    case 'repair':
    case 'setup': return ['--repair', ...rest];
    case 'clean': return ['--clear-cache', ...rest];
    case 'examples': return ['--examples', ...rest];
    case 'update': return ['--update', ...rest];
    default: return [...argv];
  }
}

export function commandSummaryText() {
  return [
    'Quick commands:',
    '  ytconv download URL         Download one media item',
    '  ytconv playlist URL         Download a playlist or post collection',
    '  ytconv batch links.txt      Download URLs from a file and continue after errors',
    '  ytconv info URL --json      Print source metadata and output plan',
    '  ytconv formats URL          List source formats',
    '  ytconv subtitles URL        List available subtitles',
    '  ytconv extract URL          Save transcript/subtitles and structured metadata',
    '  ytconv transcript URL       Save a readable SRT transcript when available',
    '  ytconv login instagram      Official browser login; no cookies.txt required',
    '  ytconv social status        Show linked browser accounts',
    '  ytconv config list          Show persistent defaults',
    '  ytconv profile list         Show named profiles',
    '  ytconv history              Show recent headless/batch runs',
    '  ytconv completion SHELL     Generate shell completion',
    '  ytconv quickstart           Show a beginner setup',
    '  ytconv donate               Choose Ko-fi (global) or Saweria (Indonesia)',
    '  ytconv doctor               Diagnose the installation',
    '  ytconv repair               Repair media dependencies',
    '  ytconv clean                Clear caches and managed download archives',
    '',
  ].join('\n');
}
