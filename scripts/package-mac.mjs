import {packageDesktop, writeReleaseManifest} from './package-desktop.mjs';
const assets = await packageDesktop('darwin', process.env.MAC_ARCH ?? 'universal');
await writeReleaseManifest(assets);
