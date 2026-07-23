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
    case 'get':
      return rest;
    case 'playlist':
    case 'pl':
      return ['--playlist', ...rest];
    case 'batch':
      return rest.length ? ['--batch-file', rest[0], '--continue-on-error', ...rest.slice(1)] : ['--batch-file'];
    case 'info':
    case 'inspect':
      return ['--dry-run', ...rest];
    case 'formats':
      return rest.includes('--json')
        ? ['--formats-json', ...withoutFlag(rest, '--json')]
        : ['--list-formats', ...rest];
    case 'subtitles':
    case 'subs':
      return ['--list-subs', ...rest];
    case 'doctor':
      return ['--doctor', ...rest];
    case 'repair':
    case 'setup':
      return ['--repair', ...rest];
    case 'clean':
      return ['--clear-cache', ...rest];
    case 'examples':
      return ['--examples', ...rest];
    case 'update':
      return ['--update', ...rest];
    default:
      return [...argv];
  }
}

export function commandSummaryText() {
  return [
    'Command cepat:',
    '  ytconv download LINK        Download satu media',
    '  ytconv playlist LINK        Download playlist/kumpulan post',
    '  ytconv batch links.txt      Batch dari file; lanjut bila satu gagal',
    '  ytconv info LINK --json     Metadata dan format sumber',
    '  ytconv formats LINK         Tabel format asli dari sumber',
    '  ytconv formats LINK --json  Format asli sebagai JSON',
    '  ytconv subtitles LINK       Daftar subtitle',
    '  ytconv doctor               Diagnosis sistem',
    '  ytconv repair               Perbaiki dependency',
    '  ytconv clean                Bersihkan cache YTConv',
    '',
  ].join('\n');
}
