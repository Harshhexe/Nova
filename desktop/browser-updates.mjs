import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, createWriteStream } from 'node:fs';
import { access, lstat, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { app, dialog, shell } from 'electron';
import { applyDelta, maxDeltaSize } from './update-delta.mjs';

const exec = promisify(execFile);
const { rm } = createRequire(import.meta.url)('original-fs').promises;
const releases = 'https://github.com/Harshhexe/Nova/releases';
const releasesApi = 'https://api.github.com/repos/Harshhexe/Nova/releases?per_page=30';
const downloadHosts = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);

async function bundleProperty(bundle, key, signal) {
  const plist = join(bundle, 'Contents', 'Info.plist');
  const { stdout } = await exec('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', plist], { signal });
  return stdout.trim();
}

function releaseVersion(value) {
  const match = /^(\d{1,6})\.(\d{1,6})\.(\d{1,6})(?:-preview\.(\d{1,6}))?$/.exec(value);
  return match && [Number(match[1]), Number(match[2]), Number(match[3]), match[4] ? Number(match[4]) : Infinity];
}

function compareVersions(a, b) {
  const index = a.findIndex((part, index) => part !== b[index]);
  return index < 0 ? 0 : a[index] - b[index];
}

function findUpdate(list, installed, arch) {
  const current = releaseVersion(installed);
  if (!current || !Array.isArray(list)) return;
  const name = `NOVA-mac-${arch}.dmg`;
  let latest = current;
  let update;
  for (const release of list) {
    if (!release || release.draft || !/^v\d/.test(release.tag_name)) continue;
    const version = release.tag_name.slice(1);
    const parts = releaseVersion(version);
    if (!parts || (current[3] === Infinity && (release.prerelease || parts[3] !== Infinity)) ||
        compareVersions(parts, latest) <= 0) continue;
    const asset = Array.isArray(release.assets) && release.assets.find(file => file?.name === name && file.state === 'uploaded');
    const url = `${releases}/download/${release.tag_name}/${name}`;
    if (!asset || asset.browser_download_url !== url || !/^sha256:[a-f0-9]{64}$/.test(asset.digest) ||
        !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > 1024 ** 3) continue;
    latest = parts;
    update = { version, url, digest: asset.digest.slice(7), size: asset.size };
    const deltaName = `NOVA-mac-${arch}-from-${installed}.delta.gz`;
    const deltaUrl = `${releases}/download/${release.tag_name}/${deltaName}`;
    const delta = release.assets.find(file => file?.name === deltaName && file.state === 'uploaded');
    if (delta?.browser_download_url === deltaUrl && /^sha256:[a-f0-9]{64}$/.test(delta.digest) &&
        Number.isSafeInteger(delta.size) && delta.size > 0 && delta.size < Math.min(maxDeltaSize, asset.size)) {
      update.delta = { url: deltaUrl, digest: delta.digest.slice(7), size: delta.size };
    }
  }
  return update;
}

async function download(update, output, signal, onProgress) {
  let url = new URL(update.url);
  for (let hop = 0; hop < 4; hop++) {
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !downloadHosts.has(url.hostname)) {
      throw new Error('Untrusted download location');
    }
    const response = await fetch(url, { redirect: 'manual', signal });
    const location = response.headers.get('location');
    if ([301, 302, 303, 307, 308].includes(response.status) && location) {
      await response.body?.cancel();
      url = new URL(location, url);
      continue;
    }
    if (!response.ok || !response.body) throw new Error('Download unavailable');
    const hash = createHash('sha256');
    let bytes = 0;
    const verify = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > update.size) return callback(new Error('Download exceeds its published size'));
        hash.update(chunk);
        onProgress(Math.min(99, Math.floor(bytes * 100 / update.size)));
        callback(null, chunk);
      }
    });
    await pipeline(Readable.fromWeb(response.body), verify, createWriteStream(output, { flags: 'wx' }), { signal });
    if (bytes !== update.size || hash.digest('hex') !== update.digest) throw new Error('Download checksum mismatch');
    onProgress(100);
    return;
  }
  throw new Error('Too many download redirects');
}

async function stageFullUpdate(update, work, staged, signal, onProgress) {
  const disk = join(work, 'NOVA.dmg');
  const mount = join(work, 'mount');
  await download(update, disk, signal, onProgress);
  await mkdir(mount);
  signal.throwIfAborted();
  await exec('/usr/bin/hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, disk]);
  try {
    const incoming = join(mount, 'NOVA.app');
    if (!(await lstat(incoming)).isDirectory()) throw new Error('Missing application in disk image');
    await exec('/usr/bin/ditto', [incoming, staged], { signal });
  } finally {
    await exec('/usr/bin/hdiutil', ['detach', mount]);
  }
}

async function verifyStagedUpdate(staged, update, signal) {
  const [id, version] = await Promise.all([
    bundleProperty(staged, 'CFBundleIdentifier', signal),
    bundleProperty(staged, 'NOVAReleaseVersion', signal)
  ]);
  if (id !== 'com.harshhexe.nova' || version !== update.version) throw new Error('Application identity or version mismatch');
  await exec('/usr/bin/codesign', ['--verify', '--deep', '--strict', staged], { signal });
}

async function stageUpdate(update, bundle, work, staged, signal, onProgress) {
  if (update.delta) {
    try {
      const patch = join(work, 'NOVA.delta.gz');
      await download(update.delta, patch, signal, onProgress);
      await exec('/usr/bin/ditto', [bundle, staged], { signal });
      await applyDelta(staged, await readFile(patch));
      await verifyStagedUpdate(staged, update, signal);
      return;
    } catch (error) {
      signal.throwIfAborted();
      console.warn('NOVA delta unavailable, downloading full update:', error.message);
      await rm(staged, { recursive: true, force: true });
      onProgress(0);
    }
  }
  await stageFullUpdate(update, work, staged, signal, onProgress);
  await verifyStagedUpdate(staged, update, signal);
}

export function createBrowserUpdater({ swapBundles, getWindow, canRestart, prepareRestart, onChange }) {
  const bundle = dirname(dirname(dirname(process.execPath)));
  let update;
  let checking = false;
  let prompting = false;
  let installing = false;
  let progress = 0;
  let stopped = false;
  let checkController;
  let installController;
  let activeInstall;

  async function check() {
    if (stopped || checking || prompting || installing) return;
    checking = true;
    checkController = new AbortController();
    try {
      const version = await bundleProperty(bundle, 'NOVAReleaseVersion', checkController.signal);
      const response = await fetch(releasesApi, {
        headers: { Accept: 'application/vnd.github+json' },
        redirect: 'error', signal: AbortSignal.any([checkController.signal, AbortSignal.timeout(12000)])
      });
      if (!response.ok) return;
      update = findUpdate(await response.json(), version, process.arch);
      if (!stopped) onChange();
    } catch {
      // An offline or rate-limited release check can be retried on the next interval.
    } finally {
      checking = false;
      checkController = undefined;
    }
  }

  async function installUpdate(selected, window) {
    prompting = true;
    const releaseUrl = releases + '/tag/v' + selected.version;
    let work;
    let staging;
    let relaunched = false;
    try {
      try {
        if (!swapBundles || basename(bundle) !== 'NOVA.app') throw new Error('Use an installed copy of NOVA');
        await access(bundle, constants.W_OK);
        await access(dirname(bundle), constants.W_OK);
      } catch {
        const result = await dialog.showMessageBox(window, {
          type: 'info', message: `NOVA ${selected.version} is available`,
          detail: 'Install the new version from GitHub Releases, then reopen NOVA.',
          buttons: ['Later', 'Open download page'], defaultId: 1, cancelId: 0
        });
        if (result.response === 1 && !stopped) await shell.openExternal(releaseUrl);
        return;
      }
      const result = await dialog.showMessageBox(window, {
        type: 'info', message: `Update NOVA to ${selected.version}?`,
        detail: 'NOVA will download the update and relaunch when it’s ready.',
        buttons: ['Later', 'Update and relaunch'], defaultId: 1, cancelId: 0
      });
      if (result.response !== 1 || stopped) return;
      if (!canRestart()) {
        await dialog.showMessageBox(window, {
          type: 'info', message: 'Close private windows and finish active downloads before updating.'
        });
        return;
      }

      checkController?.abort();
      installController = new AbortController();
      installing = true;
      progress = 0;
      onChange();
      work = await mkdtemp(join(tmpdir(), 'nova-update-'));
      staging = await mkdtemp(join(dirname(bundle), '.nova-update-'));
      const staged = join(staging, 'NOVA.app');
      const signal = AbortSignal.any([installController.signal, AbortSignal.timeout(20 * 60 * 1000)]);
      await stageUpdate(selected, bundle, work, staged, signal, percent => {
        if (progress === percent || stopped) return;
        progress = percent;
        onChange();
      });
      await prepareRestart();
      if (stopped || window.isDestroyed()) return;
      signal.throwIfAborted();
      if (!canRestart()) throw new Error('A download or private window is still open');
      swapBundles(bundle, staged);
      try {
        app.relaunch();
        relaunched = true;
      } catch (error) {
        try { swapBundles(bundle, staged); }
        catch { staging = undefined; }
        throw error;
      }
    } catch (error) {
      if (!stopped && !window.isDestroyed()) {
        console.error('NOVA update failed:', error.message);
        const result = await dialog.showMessageBox(window, {
          type: 'warning', message: 'NOVA could not install the update',
          detail: 'You can try again or download the new version from GitHub Releases.',
          buttons: ['Close', 'Open download page'], defaultId: 0, cancelId: 0
        }).catch(() => null);
        if (result?.response === 1) await shell.openExternal(releaseUrl).catch(() => {});
      }
    } finally {
      const removeTemporary = path => rm(path, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
      if (work) await removeTemporary(work);
      if (staging) await removeTemporary(staging);
      prompting = false;
      installing = false;
      installController = undefined;
      if (!stopped) onChange();
      if (relaunched) setImmediate(() => app.quit());
    }
  }

  const initial = setTimeout(() => void check(), 4000);
  const interval = setInterval(() => void check(), 6 * 60 * 60 * 1000);
  return {
    state: () => update && { version: update.version, installing, progress },
    install() {
      const window = getWindow();
      if (!update || !window || window.isDestroyed() || prompting || installing || stopped) return;
      activeInstall = installUpdate(update, window);
      return activeInstall;
    },
    stop() {
      stopped = true;
      checkController?.abort();
      installController?.abort();
      clearTimeout(initial);
      clearInterval(interval);
      if (installing) return activeInstall;
    }
  };
}
