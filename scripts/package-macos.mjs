import { cp, mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { packager } from '@electron/packager';

const root = fileURLToPath(new URL('../', import.meta.url));
if (process.platform !== 'darwin') throw new Error('The macOS disk image must be built on macOS.');
const require = createRequire(import.meta.url);
const { version, dependencies } = require('../package.json');
const electronVersion = require('electron/package.json').version;
const arch = process.arch;
const work = await mkdtemp(join(tmpdir(), 'nova-package-'));
const source = join(work, 'source');
const iconset = join(work, 'NOVA.iconset');
const icon = join(work, 'NOVA.icns');
const output = join(root, 'release');
const dmgPath = join(output, `NOVA-mac-${arch}.dmg`);
const tempDmg = join(work, 'NOVA.dmg');
function run(cmd, args, cwd = root) {
  return execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

try {
  await mkdir(source);
  await mkdir(iconset);
  await mkdir(output, { recursive: true });
  await Promise.all([
    ...['desktop', 'desktop-dist', 'dist', 'server', 'package-lock.json'].map(path =>
      cp(join(root, path), join(source, path), { recursive: true })
    ),
    writeFile(join(source, 'package.json'), JSON.stringify({
      name: 'nova-new-tab', productName: 'NOVA', version, type: 'module',
      main: 'desktop/main.mjs', dependencies
    }, null, 2))
  ]);
  run('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], source);
  await rm(join(source, 'package-lock.json'));
  run('swift', [join(root, 'scripts/app-icon.swift'), iconset]);
  run('iconutil', ['-c', 'icns', iconset, '-o', icon]);

  const [bundleDirectory] = await packager({
    dir: source, out: join(work, 'bundles'), name: 'NOVA', appBundleId: 'com.harshhexe.nova',
    appVersion: version, platform: 'darwin', arch, electronVersion, icon, prune: false,
    extendInfo: {
      NSCameraUsageDescription: 'Allow a website you approve to use your camera.',
      NSMicrophoneUsageDescription: 'Allow a website you approve to use your microphone.',
      NSLocationUsageDescription: 'Allow a website you approve to request your location.'
    }
  });
  const app = join(bundleDirectory, 'NOVA.app');
  run('codesign', ['--force', '--deep', '--sign', '-', app]);
  run('codesign', ['--verify', '--deep', '--strict', app]);
  const volume = join(work, 'volume');
  await mkdir(volume);
  await rename(app, join(volume, 'NOVA.app'));
  await symlink('/Applications', join(volume, 'Applications'));
  run('hdiutil', ['create', '-ov', '-volname', 'NOVA', '-srcfolder', volume, '-format', 'UDZO', tempDmg]);
  run('hdiutil', ['verify', tempDmg]);
  await cp(tempDmg, dmgPath, { force: true });
  console.log(`Built ${dmgPath}`);
} finally {
  await rm(work, { recursive: true, force: true, maxRetries: 3 });
}
