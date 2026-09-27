import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true }, appType: 'custom' });
try {
  const { buildPeatAppearance } = await server.ssrLoadModule('/src/story/fireAppearance.ts');
  const { mask, arrival, predecessor, ...grid } = buildPeatAppearance();
  await writeFile('public/fire-appearance.json', JSON.stringify({ schemaVersion: 1, role: 'Seeded connected illustrative arrival order; not a combustion calculation', ...grid, mask: Array.from(mask), arrival: Array.from(arrival), predecessor: Array.from(predecessor) }) + '\n');
  console.log(`Exported ${grid.peatPixels} illustrated peat pixels on a ${grid.nx}×${grid.ny} appearance grid.`);
} finally { await server.close(); }
