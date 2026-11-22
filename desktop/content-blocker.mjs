import { ElectronBlocker } from '@ghostery/adblocker-electron';
import { readFile, rename, stat, writeFile } from 'node:fs/promises';

const refreshInterval = 6 * 60 * 60 * 1000;
const basicFilters = [
  '||doubleclick.net^', '||googlesyndication.com^', '||googleadservices.com^',
  '||adnxs.com^', '||amazon-adsystem.com^'
].join('\n');

export function createContentBlocker(webSession, cachePath, onChange, isAllowed = () => false) {
  let engine = ElectronBlocker.parse(basicFilters, { loadCosmeticFilters: false });
  let full = false;
  let requested = false;
  let loading;
  const configured = new WeakSet();

  function configureExceptions() {
    if (configured.has(engine)) return;
    configured.add(engine);
    for (const method of ['onBeforeRequest', 'onHeadersReceived']) {
      const handle = engine[method];
      engine[method] = (details, callback) => {
        const top = details.resourceType === 'mainFrame' ? details.url : details.frame?.top?.url || details.webContents?.getURL();
        return isAllowed(top) ? callback({}) : handle(details, callback);
      };
    }
    const inject = engine.onInjectCosmeticFilters;
    engine.onInjectCosmeticFilters = (event, url, message) =>
      isAllowed(event.senderFrame?.top?.url || url) ? undefined : inject(event, url, message);
  }

  function apply() {
    configureExceptions();
    const enabled = engine.isBlockingEnabled(webSession);
    if (requested && !enabled) engine.enableBlockingInSession(webSession);
    if (!requested && enabled) engine.disableBlockingInSession(webSession);
    onChange(requested ? (full ? 'full' : 'basic') : 'off');
  }

  function replace(next) {
    if (engine.isBlockingEnabled(webSession)) engine.disableBlockingInSession(webSession);
    engine = next;
    full = true;
    apply();
  }

  async function refresh() {
    try {
      const metadata = await stat(cachePath);
      if (!full) replace(ElectronBlocker.deserialize(new Uint8Array(await readFile(cachePath))));
      if (Date.now() - metadata.mtimeMs < refreshInterval) return;
    } catch {
      // Fetch fresh lists when the cache is missing or from an older engine.
    }
    if (!requested) return;
    try {
      const fetchLists = async url => {
        if (url.endsWith('/ublock-origin/quick-fixes.txt')) {
          const upstream = await fetch('https://ublockorigin.github.io/uAssets/filters/quick-fixes.min.txt', { signal: AbortSignal.timeout(3500) }).catch(() => null);
          if (upstream?.ok) return upstream;
        }
        const response = await fetch(url, { signal: AbortSignal.timeout(3500) }).catch(() =>
          fetch(url.replace('https://raw.githubusercontent.com/ghostery/adblocker/master/', 'https://cdn.jsdelivr.net/gh/ghostery/adblocker@master/'), { signal: AbortSignal.timeout(8000) })
        );
        if (!response.ok) throw new Error('Filter download returned ' + response.status);
        return response;
      };
      const next = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetchLists);
      replace(next);
      await writeFile(cachePath + '.tmp', next.serialize());
      await rename(cachePath + '.tmp', cachePath);
    } catch (error) {
      console.warn('NOVA ad filter update failed:', error.message);
    }
  }

  return {
    setEnabled(enabled) {
      requested = enabled;
      apply();
      if (enabled && !loading) loading = refresh().finally(() => { loading = undefined; });
    }
  };
}
