import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeDelta, applyDelta, maxDeltaSize } from '../desktop/update-delta.mjs';

const [from, to] = process.argv.slice(2);
if (!from || !to) throw new Error('Usage: node scripts/package-delta.mjs OLD.app NEW.app');
const { version } = createRequire(import.meta.url)('../package.json');
function property(bundle, key) {
  return execFileSync('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', join(bundle, 'Contents/Info.plist')], { encoding: 'utf8' }).trim();
}
const base = property(from, 'NOVAReleaseVersion');
if (!/^\d+\.\d+\.\d+(?:-preview\.\d+)?$/.test(base) || base === version ||
    property(to, 'NOVAReleaseVersion') !== version) throw new Error('Check the source and target versions');
const work = await mkdtemp(join(tmpdir(), 'nova-delta-'));
try {
  const patch = await makeDelta(from, to);
  if (patch.length > maxDeltaSize) throw new Error('Delta exceeds the size limit. Publish the full DMG.');
  const staged = join(work, 'NOVA.app');
  execFileSync('/usr/bin/ditto', [from, staged]);
  await applyDelta(staged, patch);
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', staged], { stdio: 'inherit' });
  const output = `release/NOVA-mac-${process.arch}-from-${base}.delta.gz`;
  await writeFile(output, patch);
  console.log(`Built ${output} (${patch.length} bytes)`);
} finally {
  await rm(work, { recursive: true, force: true });
}
