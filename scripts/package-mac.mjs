import { packager } from '@electron/packager';
import { sign } from '@electron/osx-sign';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

if (process.platform !== 'darwin') throw new Error('macOS packaging must run on a Mac.');

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.resolve(projectDir, '..');
const appName = 'Zombie Fire Suppression Sim';
const finalArchive = path.join(outputDir, `${appName}.app.zip`);
const pendingArchive = path.join(outputDir, `.${appName}.app.zip.pending`);
const legacyApps = [
  path.join(outputDir, `${appName}.app`),
  path.join(outputDir, `.${appName}.pending.app`),
  path.join(outputDir, `.${appName}.previous.app`),
];
const manifest = JSON.parse(await readFile(path.join(projectDir, 'package.json'), 'utf8'));
const electronVersion = manifest.devDependencies.electron;
if (!/^\d+\.\d+\.\d+$/.test(electronVersion)) throw new Error('Electron must have an exact pinned version.');

// Reuse the official Electron ZIP already cached by @electron/get when this Mac
// is offline. Packager otherwise attempts to fetch a fresh checksum manifest.
let electronZipDir = process.env.ELECTRON_ZIP_DIR;
if (!electronZipDir) {
  const cacheRoot = path.join(homedir(), 'Library', 'Caches', 'electron');
  const zipName = `electron-v${electronVersion}-darwin-${process.arch}.zip`;
  for (const entry of await readdir(cacheRoot, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(cacheRoot, entry.name);
    if (await access(path.join(candidate, zipName)).then(() => true, () => false)) {
      electronZipDir = candidate;
      break;
    }
  }
}

const temporaryDir = await mkdtemp(path.join(tmpdir(), 'zombie-fire-package-'));
try {
  const stagedApp = path.join(temporaryDir, 'source');
  await cp(path.join(projectDir, 'dist'), path.join(stagedApp, 'dist'), { recursive: true });
  await cp(path.join(projectDir, 'electron', 'main.cjs'), path.join(stagedApp, 'main.cjs'));
  await writeFile(path.join(stagedApp, 'package.json'), JSON.stringify({
    name: manifest.name,
    productName: appName,
    version: manifest.version,
    main: 'main.cjs',
  }, null, 2));

  const [packagedDir] = await packager({
    dir: stagedApp,
    name: appName,
    platform: 'darwin',
    arch: process.arch,
    electronVersion,
    ...(electronZipDir ? { electronZipDir } : {}),
    out: path.join(temporaryDir, 'packaged'),
    asar: true,
    prune: false,
    appBundleId: 'com.kadencsmith.zombiefiresuppressionsim',
    appCategoryType: 'public.app-category.education',
    icon: path.join(projectDir, 'electron', 'app-icon.icns'),
    overwrite: false,
    quiet: true,
  });
  if (!packagedDir) throw new Error('Electron Packager returned no output directory.');

  const packagedApp = path.join(packagedDir, `${appName}.app`);
  const resourcesDir = path.join(packagedApp, 'Contents', 'Resources');
  for (const license of ['LICENSE', 'LICENSES.chromium.html']) {
    await cp(path.join(packagedDir, license), path.join(resourcesDir, license));
  }
  await cp(path.join(projectDir, 'THIRD_PARTY_NOTICES.md'), path.join(resourcesDir, 'THIRD_PARTY_NOTICES.md'));
  const licenseDir = path.join(resourcesDir, 'THIRD_PARTY_LICENSES');
  await mkdir(licenseDir);
  const { stdout } = await execFileAsync('npm', ['ls', '--parseable', '--all', '--omit=dev'], { cwd: projectDir, maxBuffer: 8 * 1024 * 1024 });
  const licenseIndex = [];
  for (const packagePath of [...new Set(stdout.trim().split('\n'))].filter(p => p && p !== projectDir)) {
    const packageJson = JSON.parse(await readFile(path.join(packagePath, 'package.json'), 'utf8'));
    const packageDir = path.join(licenseDir, `${packageJson.name.replaceAll('/', '__')}@${packageJson.version}`);
    const licenseFiles = (await readdir(packagePath, { withFileTypes: true }))
      .filter(entry => entry.isFile() && /^(LICENSE|LICENCE|COPYING|NOTICE)(\.|$)/i.test(entry.name))
      .map(entry => entry.name);
    await mkdir(packageDir, { recursive: true });
    for (const licenseFile of licenseFiles) {
      await cp(path.join(packagePath, licenseFile), path.join(packageDir, licenseFile));
    }
    licenseIndex.push({ name: packageJson.name, version: packageJson.version, declaredLicense: packageJson.license ?? null, files: licenseFiles });
  }
  await writeFile(path.join(licenseDir, 'index.json'), JSON.stringify(licenseIndex, null, 2));
  console.log(`Embedded notices for ${licenseIndex.length} production packages.`);

  // Sign in the temporary build directory: the Documents File Provider adds
  // metadata to new files that macOS refuses to seal during signing.
  await execFileAsync('xattr', ['-cr', packagedApp]);
  // A locally ad-hoc signed executable has no shared Apple Team ID with its
  // nested frameworks. Hardened runtime library validation would block them.
  await sign({
    app: packagedApp,
    identity: '-',
    identityValidation: false,
    optionsForFile: () => ({
      hardenedRuntime: false,
      entitlements: ['com.apple.security.cs.allow-jit'],
      timestamp: 'none',
    }),
    preAutoEntitlements: false,
    strictVerify: true,
  });
  await execFileAsync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', packagedApp]);

  // The Documents File Provider adds FinderInfo to copied application bundles,
  // which breaks their signatures. Archive the verified temporary bundle before
  // it enters that directory, then verify a fresh extraction outside it.
  const temporaryArchive = path.join(temporaryDir, `${appName}.app.zip`);
  await execFileAsync('ditto', ['-c', '-k', '--norsrc', '--noextattr', '--noqtn', '--keepParent', packagedApp, temporaryArchive]);
  const verificationDir = path.join(temporaryDir, 'verify');
  await mkdir(verificationDir);
  await execFileAsync('ditto', ['-x', '-k', '--norsrc', '--noextattr', '--noqtn', temporaryArchive, verificationDir]);
  await execFileAsync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', path.join(verificationDir, `${appName}.app`)]);

  await rm(pendingArchive, { force: true });
  await cp(temporaryArchive, pendingArchive);
  await rename(pendingArchive, finalArchive);
  for (const legacyApp of legacyApps) await rm(legacyApp, { recursive: true, force: true });
  console.log(`Packaged signed macOS app archive: ${finalArchive}`);
} finally {
  if (process.env.KEEP_PACKAGING_TEMP === '1') {
    console.log(`Kept temporary app for launch verification: ${path.join(temporaryDir, 'verify', `${appName}.app`)}`);
  } else {
    await rm(temporaryDir, { recursive: true, force: true });
  }
}
