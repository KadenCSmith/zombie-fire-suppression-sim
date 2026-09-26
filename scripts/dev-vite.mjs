import { createServer } from 'vite';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Programmatic configuration avoids File Provider's spurious change notices
// for vite.config.ts and tsconfig.json, which can otherwise restart the server
// repeatedly and strand Electron on a blank page during module requests.
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  base: './',
  worker: { format: 'es' },
  esbuild: { tsconfigRaw: { compilerOptions: { jsx: 'react-jsx', useDefineForClassFields: true } } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true,
    watch: { ignored: ['**/*'] } },
});
const sourceRoot = path.join(process.cwd(), 'src');
async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}
async function hashes(prior = new Map()) {
  const files = [...await sourceFiles(sourceRoot), path.join(process.cwd(), 'index.html')];
  const result = new Map();
  for (const file of files) {
    const info = await stat(file);
    const signature = `${info.mtimeMs}:${info.size}`;
    const existing = prior.get(file);
    const digest = existing?.signature === signature ? existing.digest
      : createHash('sha256').update(await readFile(file)).digest('hex');
    result.set(file, { signature, digest });
  }
  return result;
}
let previous = await hashes();
await server.listen();
server.printUrls();
let scanning = false;
const poll = setInterval(async () => {
  if (scanning) return;
  scanning = true;
  try {
    const current = await hashes(previous);
    for (const [file, value] of current) {
      if (!previous.has(file)) server.watcher.emit('add', file);
      else if (previous.get(file).digest !== value.digest) server.watcher.emit('change', file);
    }
    for (const file of previous.keys()) if (!current.has(file)) server.watcher.emit('unlink', file);
    previous = current;
  } catch (error) { console.error('Source watch error:', error); }
  finally { scanning = false; }
}, 2000);
const close = async () => { clearInterval(poll); await server.close(); process.exit(0); };
process.on('SIGINT', close);
process.on('SIGTERM', close);
