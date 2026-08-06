import { Command } from 'commander';

function buildProgram(version) {
  const program = new Command();
  program
    .name('ytconv')
    .description('Download and convert media from YouTube and supported social platforms.')
    .version(version, '-v, --version', 'print the installed YTConv version')
    .option('--audio', 'download or convert to audio')
    .option('--video', 'download or convert to video')
    .option('--image', 'download images or social-media galleries')
    .option('--platform <name>', 'select a social platform or AUTO detection')
    .option('--cookies-browser <browser>', 'read an authenticated browser session when required')
    .option('--subtitles', 'enable subtitles (off by default)')
    .option('--no-update-check', 'skip the non-blocking update check')
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .showHelpAfterError();

  program.addHelpText('after', `
Examples:
  ytconv
  ytconv "https://youtu.be/..." --video
  ytconv "https://www.instagram.com/reel/..." --platform instagram
  ytconv login instagram
  ytconv social help
  ytconv docs --list
  ytconv docs troubleshooting
  ytconv about
  ytconv shortcuts

Privacy:
  Public access is attempted first. Browser login is requested only when a provider
  requires authentication. Passwords and OTP codes are never entered into YTConv.
`);
  return program;
}

export function commanderHelpText(version) {
  const program = buildProgram(version);
  return `${program.helpInformation().trimEnd()}\n\nExamples:\n  ytconv\n  ytconv "https://youtu.be/..." --video\n  ytconv "https://www.instagram.com/reel/..." --platform instagram\n  ytconv login instagram\n\nPrivacy:\n  Public access is attempted first. Browser login is requested only when required.`;
}
