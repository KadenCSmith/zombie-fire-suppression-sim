import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

// TypeScript 7 delegates to its native compiler. On this Mac the Node 26 npm
// wrapper is occasionally killed while the Documents File Provider is active;
// the installed Node 22 runtime has completed the same check reliably.
const preferred = '/opt/homebrew/opt/node@22/bin/node';
const node = await access(preferred).then(() => preferred, () => process.execPath);
const compiler = path.resolve('node_modules/typescript/bin/tsc');
for (let attempt = 1; attempt <= 3; attempt++) {
  const outcome = await new Promise(resolve => {
    const child = spawn(node, [compiler, '--noEmit', '--pretty', 'false'], { stdio: 'inherit' });
    child.on('exit', (code, signal) => resolve({ code, signal }));
    child.on('error', error => resolve({ code: 1, signal: null, error }));
  });
  if (outcome.code === 0) process.exit(0);
  if (outcome.signal !== 'SIGKILL' && outcome.code !== 137 || attempt === 3) {
    console.error('TypeScript check failed:', outcome);
    process.exit(typeof outcome.code === 'number' ? outcome.code : 1);
  }
  console.warn(`TypeScript compiler was killed by the host; retrying (${attempt}/3).`);
}
