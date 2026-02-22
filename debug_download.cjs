const { spawn } = require('child_process');
const { join } = require('path');
const fs = require('fs');

const COOKIES_PATH = join(process.cwd(), 'cookies.txt');
const JOBS_DIR = join(process.cwd(), 'public/jobs');
const URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // Me at the zoo
const ID = 'test_' + Date.now();

console.log('Checking cookies.txt...');
if (fs.existsSync(COOKIES_PATH)) {
  console.log('cookies.txt FOUND');
} else {
  console.log('cookies.txt NOT FOUND');
}

console.log('Running download_audio.py...');
const scriptArgs = [
  join(process.cwd(), "download_audio.py"),
  URL,
  JOBS_DIR,
  ID,
];
if (fs.existsSync(COOKIES_PATH)) {
  scriptArgs.push(COOKIES_PATH);
}

const pyCmd = process.platform === "win32" ? "python" : "python3";
console.log(`Command: ${pyCmd} ${scriptArgs.join(' ')}`);

const py = spawn(pyCmd, scriptArgs);

let stdout = '';
let stderr = '';

py.stdout.on('data', (d) => { stdout += d.toString(); process.stdout.write(d); });
py.stderr.on('data', (d) => { stderr += d.toString(); process.stderr.write(d); });

py.on('close', (code) => {
  console.log(`\nExited with code: ${code}`);
  if (code === 0) {
    console.log('SUCCESS');
  } else {
    console.log('FAILURE');
    console.log('STDERR:', stderr);
  }
});
