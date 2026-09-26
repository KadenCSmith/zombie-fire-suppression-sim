import { packager } from '@electron/packager';
import { sign } from '@electron/osx-sign';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const manifest = JSON.parse(await readFile(path.join(projectDir, 'package.json'), 'utf8'));
export const releaseDir = path.join(projectDir, 'work', 'releases', `v${manifest.version}`);
const appName = 'Zombie Fire Suppression Sim';
const electronVersion = manifest.devDependencies.electron;
if (!/^\d+\.\d+\.\d+$/.test(electronVersion)) throw new Error('Pin an exact Electron version.');

async function electronCache(platform, arch) {
  const directory = process.env.ELECTRON_ZIP_DIR ?? path.join(projectDir, 'work', 'electron-downloads');
  if (!await access(directory).then(() => true, () => false)) return undefined;
  const sums = await readFile(path.join(directory, 'SHASUMS256.txt'), 'utf8');
  for (const cpu of arch === 'universal' ? ['x64', 'arm64'] : [arch]) {
    const filename = `electron-v${electronVersion}-${platform}-${cpu}.zip`;
    const expected = sums.split(/\r?\n/).find(line => line.trim().endsWith(` ${filename}`))?.split(/\s+/)[0];
    const actual = createHash('sha256').update(await readFile(path.join(directory, filename))).digest('hex');
    if (!expected || expected !== actual) throw new Error(`Official Electron checksum mismatch: ${filename}`);
  }
  return directory;
}

async function addNotices(packagedDir, resourcesDir, platform) {
  await mkdir(resourcesDir, {recursive: true});
  if (platform === 'darwin') for (const filename of ['LICENSE', 'LICENSES.chromium.html'])
    await cp(path.join(packagedDir, filename), path.join(resourcesDir, filename));
  await cp(path.join(projectDir, 'THIRD_PARTY_NOTICES.md'), path.join(resourcesDir, 'THIRD_PARTY_NOTICES.md'));
  const licenseDir = path.join(resourcesDir, 'THIRD_PARTY_LICENSES');
  await mkdir(licenseDir);
  const {stdout} = await exec('npm', ['ls', '--parseable', '--all', '--omit=dev'], {cwd: projectDir, maxBuffer: 8 * 1024 * 1024});
  const index = [];
  for (const packagePath of [...new Set(stdout.trim().split('\n'))].filter(p => p && p !== projectDir)) {
    const pkg = JSON.parse(await readFile(path.join(packagePath, 'package.json'), 'utf8'));
    const destination = path.join(licenseDir, `${pkg.name.replaceAll('/', '__')}@${pkg.version}`);
    const files = (await readdir(packagePath, {withFileTypes: true}))
      .filter(e => e.isFile() && /^(LICENSE|LICENCE|COPYING|NOTICE)(\.|$)/i.test(e.name)).map(e => e.name);
    await mkdir(destination, {recursive: true});
    for (const file of files) await cp(path.join(packagePath, file), path.join(destination, file));
    index.push({name: pkg.name, version: pkg.version, declaredLicense: pkg.license ?? null, files});
  }
  await writeFile(path.join(licenseDir, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`Embedded notices for ${index.length} production packages.`);
}

export async function packageDesktop(platform, arch) {
  // This release tool uses the Mac host's archive/signing utilities. The resulting
  // Windows and Linux apps contain the official Electron binaries for each OS.
  if (process.platform !== 'darwin') throw new Error('Run this release packaging tool on macOS.');
  if (!['darwin/universal', 'darwin/arm64', 'darwin/x64', 'win32/x64', 'win32/arm64', 'linux/x64', 'linux/arm64'].includes(`${platform}/${arch}`))
    throw new Error('Unsupported release target.');
  const electronZipDir = await electronCache(platform, arch);
  const temporary = await mkdtemp(path.join(tmpdir(), 'zombie-fire-release-'));
  const created = [];
  try {
    const source = path.join(temporary, 'source');
    await cp(path.join(projectDir, 'dist'), path.join(source, 'dist'), {recursive: true});
    await cp(path.join(projectDir, 'electron', 'main.cjs'), path.join(source, 'main.cjs'));
    await writeFile(path.join(source, 'package.json'), JSON.stringify({name: manifest.name, productName: appName, version: manifest.version, main: 'main.cjs'}));
    const [packagedDir] = await packager({
      dir: source, name: appName, platform, arch, electronVersion,
      ...(electronZipDir ? {electronZipDir} : {}),
      out: path.join(temporary, 'packaged'), asar: true, prune: false, overwrite: false, quiet: true,
      appBundleId: 'com.kadencsmith.zombiefiresuppressionsim',
      appCategoryType: 'public.app-category.education',
      ...(platform === 'darwin' ? {icon: path.join(projectDir, 'electron', 'app-icon.icns'), extendInfo: {LSMinimumSystemVersion: '13.0'}} : {}),
      win32metadata: {FileDescription: appName, ProductName: appName},
    });
    if (!packagedDir) throw new Error('Packager returned no application.');
    const app = path.join(packagedDir, `${appName}.app`);
    const resources = platform === 'darwin' ? path.join(app, 'Contents', 'Resources') : path.join(packagedDir, 'resources');
    await addNotices(packagedDir, resources, platform);
    await cp(path.join(projectDir, 'docs', 'INSTALL.md'), path.join(platform === 'darwin' ? resources : packagedDir, 'INSTALL.md'));
    const base = `Zombie-Fire-Sim-${manifest.version}-${platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : 'Linux'}-${arch}`;
    await mkdir(releaseDir, {recursive: true});
    if (platform === 'darwin') {
      await exec('xattr', ['-cr', app]);
      await sign({app, identity: '-', identityValidation: false,
        optionsForFile: () => ({hardenedRuntime: false, entitlements: ['com.apple.security.cs.allow-jit'], timestamp: 'none'}),
        preAutoEntitlements: false, strictVerify: true});
      await exec('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app]);
      const executable = path.join(app, 'Contents', 'MacOS', appName);
      const architecture = (await exec('lipo', ['-archs', executable])).stdout.trim();
      for (const cpu of arch === 'universal' ? ['arm64', 'x86_64'] : [arch === 'x64' ? 'x86_64' : 'arm64'])
        if (!architecture.split(/\s+/).includes(cpu)) throw new Error(`Missing Mac architecture ${cpu}`);
      const zip = path.join(releaseDir, `${base}.zip`);
      await exec('ditto', ['-c', '-k', '--norsrc', '--noextattr', '--noqtn', '--keepParent', app, zip]);
      const extracted = path.join(temporary, 'verify');
      await mkdir(extracted);
      await exec('ditto', ['-x', '-k', '--norsrc', '--noextattr', '--noqtn', zip, extracted]);
      await exec('codesign', ['--verify', '--deep', '--strict', path.join(extracted, `${appName}.app`)]);
      created.push(zip);
      const volume = path.join(temporary, 'volume');
      await mkdir(volume);
      await exec('ditto', ['--norsrc', '--noextattr', '--noqtn', app, path.join(volume, `${appName}.app`)]);
      await symlink('/Applications', path.join(volume, 'Applications'));
      await writeFile(path.join(volume, 'START HERE.txt'), 'Drag Zombie Fire Suppression Sim to Applications.\nRequires macOS 13 or later. This app supports Apple Silicon and Intel.\nThe app is locally signed, not Apple notarized. If macOS blocks it, follow System Settings > Privacy & Security > Open Anyway for this app.\nScene studio is illustrative; Open simulation opens the unvalidated reduced numerical model.\n');
      const dmg = path.join(releaseDir, `${base}.dmg`);
      await exec('hdiutil', ['create', '-ov', '-volname', 'Zombie Fire Sim', '-srcfolder', volume, '-format', 'UDZO', '-fs', 'HFS+', dmg], {maxBuffer: 4 * 1024 * 1024});
      await exec('hdiutil', ['verify', dmg]);
      created.push(dmg);
      console.log(`Verified Mac ${architecture}, signature, clean ZIP extraction and DMG.`);
    } else {
      const executable = path.join(packagedDir, platform === 'win32' ? `${appName}.exe` : appName);
      const kind = (await exec('file', ['-b', executable])).stdout.trim();
      const pattern = platform === 'win32' ? (arch === 'x64' ? /x86-64/ : /Aarch64|ARM64/i) : (arch === 'x64' ? /x86-64/ : /aarch64|ARM64/i);
      if (!pattern.test(kind)) throw new Error(`Unexpected ${platform}/${arch} binary: ${kind}`);
      for (const [title, flag] of [['Open simulation', '--simulation'], ['Open scene studio', '--studio']]) {
        const filename = path.join(packagedDir, `${title}.${platform === 'win32' ? 'cmd' : 'sh'}`);
        const command = platform === 'win32'
          ? `@echo off\r\nstart "" "%~dp0${appName}.exe" ${flag}\r\n`
          : `#!/bin/sh\ncd -- "$(dirname -- "$0")" || exit 1\nexec "./${appName}" ${flag} "$@"\n`;
        await writeFile(filename, command, {mode: 0o755});
      }
      const archive = path.join(releaseDir, `${base}.${platform === 'win32' ? 'zip' : 'tar.gz'}`);
      if (platform === 'win32') {
        await exec('ditto', ['-c', '-k', '--norsrc', '--noextattr', '--noqtn', '--keepParent', packagedDir, archive]);
        await exec('unzip', ['-tq', archive], {maxBuffer: 1024 * 1024});
      } else {
        await exec('tar', ['-czf', archive, '-C', path.dirname(packagedDir), path.basename(packagedDir)], {env: {...process.env, COPYFILE_DISABLE: '1'}});
        await exec('tar', ['-tzf', archive], {maxBuffer: 4 * 1024 * 1024});
      }
      created.push(archive);
      console.log(`Verified archive integrity and executable: ${kind}. Native execution requires its target OS.`);
    }
    return created.map(filename => ({filename, platform, arch, signing: platform === 'darwin' ? 'ad-hoc; not notarized' : 'unsigned'}));
  } finally {
    await rm(temporary, {recursive: true, force: true});
  }
}

export async function writeReleaseManifest(assets) {
  const {stdout} = await exec('git', ['rev-parse', 'HEAD'], {cwd: projectDir});
  const entries = [];
  for (const asset of assets) {
    const bytes = await readFile(asset.filename);
    entries.push({...asset, filename: path.basename(asset.filename), bytes: (await stat(asset.filename)).size, sha256: createHash('sha256').update(bytes).digest('hex')});
  }
  await cp(path.join(projectDir, 'docs', 'INSTALL.md'), path.join(releaseDir, 'INSTALL.md'));
  await writeFile(path.join(releaseDir, 'release-manifest.json'), JSON.stringify({version: manifest.version, sourceCommit: stdout.trim(), electronVersion, createdAt: new Date().toISOString(), assets: entries}, null, 2)+'\n');
  const checksums = [];
  for (const filename of [...entries.map(e => e.filename), 'INSTALL.md', 'release-manifest.json']) {
    const sha256 = createHash('sha256').update(await readFile(path.join(releaseDir, filename))).digest('hex');
    checksums.push(`${sha256}  ${filename}`);
  }
  await writeFile(path.join(releaseDir, 'SHA256SUMS.txt'), checksums.join('\n')+'\n');
  console.log(`Release files: ${releaseDir}`);
}
