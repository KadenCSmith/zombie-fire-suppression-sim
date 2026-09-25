import { readFile, writeFile } from 'node:fs/promises';

if (process.argv.length !== 4) {
  throw new Error('Usage: node create-icns.mjs input-1024.png output.icns');
}

const png = await readFile(process.argv[2]);
if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== 1024 || png.readUInt32BE(20) !== 1024) {
  throw new Error('Expected a 1024 × 1024 PNG.');
}
const header = Buffer.alloc(16);
header.write('icns', 0);
header.writeUInt32BE(16 + png.length, 4);
header.write('ic10', 8);
header.writeUInt32BE(8 + png.length, 12);
await writeFile(process.argv[3], Buffer.concat([header, png]));
