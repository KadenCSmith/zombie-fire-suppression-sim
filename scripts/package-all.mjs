import {packageDesktop, writeReleaseManifest} from './package-desktop.mjs';
const assets = [];
for (const [platform, arch] of [['darwin', 'universal'], ['win32', 'x64'], ['win32', 'arm64'], ['linux', 'x64'], ['linux', 'arm64']]) {
  console.log(`Packaging ${platform}/${arch}…`);
  assets.push(...await packageDesktop(platform, arch));
}
await writeReleaseManifest(assets);
