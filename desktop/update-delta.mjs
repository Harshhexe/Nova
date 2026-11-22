import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const { readFile, writeFile } = process.versions.electron
  ? createRequire(import.meta.url)('original-fs').promises
  : fs;

const files = [
  'Contents/Resources/app.asar',
  'Contents/Info.plist',
  'Contents/MacOS/NOVA',
  'Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework',
  'Contents/_CodeSignature/CodeResources'
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const maxDeltaSize = 32 * 1024 ** 2;

// Store changed files as a common prefix, a replacement, and a common suffix.
export async function makeDelta(from, to) {
  const entries = [];
  for (const path of files) {
    const before = await readFile(join(from, path));
    const after = await readFile(join(to, path));
    const limit = Math.min(before.length, after.length);
    let prefix = 0;
    let suffix = 0;
    while (prefix < limit && before[prefix] === after[prefix]) prefix++;
    while (suffix < limit - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
    entries.push({ base: hash(before), target: hash(after), prefix, suffix,
      replacement: after.subarray(prefix, after.length - suffix).toString('base64') });
  }
  return gzipSync(JSON.stringify(entries));
}

export async function applyDelta(bundle, patch) {
  const entries = JSON.parse(gunzipSync(patch, { maxOutputLength: 128 * 1024 ** 2 }));
  if (!Array.isArray(entries) || entries.length !== files.length) throw new Error('Invalid NOVA delta');
  for (const [index, path] of files.entries()) {
    const { base, target, prefix, suffix, replacement } = entries[index];
    const destination = join(bundle, path);
    const before = await readFile(destination);
    if (hash(before) !== base || !Number.isSafeInteger(prefix) || !Number.isSafeInteger(suffix) ||
        prefix < 0 || suffix < 0 || prefix + suffix > before.length || typeof replacement !== 'string') {
      throw new Error('NOVA delta does not match this installation');
    }
    const after = Buffer.concat([before.subarray(0, prefix), Buffer.from(replacement, 'base64'),
      before.subarray(before.length - suffix)]);
    if (hash(after) !== target) throw new Error('Patched file failed verification');
    await writeFile(destination, after);
  }
}
