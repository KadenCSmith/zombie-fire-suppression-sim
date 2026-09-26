import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

if (process.platform !== 'darwin') throw new Error('dev:mac requires macOS.');
const origin = 'http://127.0.0.1:5173';
const vite = spawn(process.execPath, ['scripts/dev-vite.mjs'], { stdio: 'inherit' });
let electron;
const close = () => {
  electron?.kill('SIGTERM');
  vite.kill('SIGTERM');
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
vite.on('exit', () => electron?.kill('SIGTERM'));
try {
  let ready = false;
  for (let attempt = 0; attempt < 600; attempt++) {
    if (vite.exitCode !== null) throw new Error('Vite exited before the app was ready.');
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* starting */ }
    await delay(100);
  }
  if (!ready) throw new Error('Timed out waiting for the local development server.');
  electron = spawn('node_modules/.bin/electron', ['electron/main.cjs'], {
    stdio: 'inherit',
    env: { ...process.env, ZOMBIE_DEV_ORIGIN: origin },
  });
  electron.on('exit', close);
} catch (error) {
  close();
  console.error(error);
  process.exitCode = 1;
}
