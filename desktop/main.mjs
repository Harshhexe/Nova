import { createRequire } from 'node:module';
import { app, BrowserWindow, Menu, WebContentsView, ipcMain, session, shell, clipboard, protocol, net, dialog, screen } from 'electron';
import { readFile, realpath, writeFile, rename, mkdtemp, rm } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { basename, isAbsolute, join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { installPermissions, permissionLabels, secureOrigin, siteDataTypes } from './site-controls.mjs';
import { installLoginPrompts } from './login-prompts.mjs';
import { passwordVault, fillLogin } from './credentials.mjs';
import { suggestionsHandler } from '../server/suggestions.mjs';
import { createContentBlocker } from './content-blocker.mjs';
import { createBrowserUpdater } from './browser-updates.mjs';

const privateMode = app.commandLine.hasSwitch('nova-private');
const root = fileURLToPath(new URL('../', import.meta.url));
const chromePath = join(root, 'desktop-dist/index.html');
const chromeUrl = pathToFileURL(chromePath).href;
const tourUrl = chromeUrl + '?tour';
const startUrl = 'nova://home/';
const spotlightUrl = 'nova://home/?spotlight';
const startFiles = join(root, 'dist');
const sidebarWidth = 60;
const topInset = 49;
const pageGap = 5;
const favoriteLimit = 3;
const searchEngines = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  bing: 'https://www.bing.com/search?q='
};
const webPreferences = { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true };
const chromePreferences = () => privateMode
  ? { ...webPreferences, session: session.fromPartition('nova-private-chrome', { cache: false }) }
  : webPreferences;
protocol.registerSchemesAsPrivileged([
  { scheme: 'nova', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);
app.setName('NOVA Browser');
if (!app.commandLine.hasSwitch('user-data-dir')) {
  const profilePath = join(app.getPath('appData'), 'NOVA Browser');
  mkdirSync(profilePath, { recursive: true });
  app.setPath('userData', profilePath);
}
let window;
let readyForExternalLinks = false;
const pendingExternalLinks = [];
let requestDefaultBrowser;
let isDefaultBrowser = false;
let settingDefaultBrowser = false;
let updater;
let swapAppBundles;
const privateWindows = new Set();
let startPage;
let spotlight;
let spotlightVisible = false;
let addressPopup;
let addressPopupData;
let tour;
let tourCompleted = true;
let webSession;
let activeId;
let showing;
let mediaExpanded = false;
let mediaPopup;
let mediaCloseTimer;
let fullscreenPage;
let pageBackdrop = { top: '', side: '' };
let backdropRevision = 0;
let capturingBackdrop = false;
let panel = false;
let tabPreviews;
const previewCache = new WeakMap();
let sidebar = true;
let pageBlur = true;
let toolbarBlur = true;
let searchEngine = Object.hasOwn(searchEngines, app.commandLine.getSwitchValue('nova-private-engine'))
  ? app.commandLine.getSwitchValue('nova-private-engine') : 'google';
const extraIcons = ['bookmarks', 'history', 'downloads', 'passwords'];
const iconDefaults = {
  sidebar: ['bookmarks', 'history', 'downloads'],
  toolbar: ['back', 'forward', 'reload', 'bookmark', 'copy', 'new-tab', 'tabs']
};
function defaultPreferences() {
  return {
    ...iconDefaults, fontSize: 16, defaultZoom: 100, newTabPage: 'dashboard',
    restoreTabs: !privateMode, rememberHistory: !privateMode, liveSuggestions: !privateMode, offerSaveLogins: !privateMode, blockAds: app.commandLine.getSwitchValue('nova-private-block-ads') !== 'false', swipeHistory: true, pinchOverview: true, pinchOpenTab: true, downloadFolder: app.getPath('downloads')
  };
}
let preferences;
let contentBlocker;
let contentBlocking = 'off';
let clearingData = false;
const pageFontRules = new WeakMap();
let tabs = [];
let closed = [];
let history = [];
let bookmarks = [];
let favorites = [];
let downloads = [];
const downloadItems = new Map();
let decisions = {};
let adExceptions = new Set();
let vault;
let loginPrompts;
let loginList = [];
let findResult;
let findRequest;
let findText = '';

const extensions = new Map();
let choosingExtension = false;
let saveQueue = Promise.resolve();
let file;

function webUrl(input) {
  try {
    const parsed = new URL(input);
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
  } catch { return ''; }
}

app.on('open-url', (event, input) => {
  const url = webUrl(input);
  if (!url) return;
  event.preventDefault();
  pendingExternalLinks.push(url);
  openExternalLinks();
});

function openExternalLinks() {
  if (!readyForExternalLinks || window.isDestroyed() || !pendingExternalLinks.length) return;
  closeTour(false);
  closeSpotlight(false);
  window.webContents.send('browser:shortcut', 'dismiss-panel');
  for (const url of pendingExternalLinks.splice(0)) newTab(url);
  if (window.isMinimized()) window.restore();
  window.show();
  showing?.webContents.focus();
}

function checkDefaultBrowser() {
  if (!requestDefaultBrowser) return;
  const current = app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https');
  if (current === isDefaultBrowser) return;
  isDefaultBrowser = current;
  publish(false);
}

async function makeDefaultBrowser() {
  if (!requestDefaultBrowser || settingDefaultBrowser) return false;
  checkDefaultBrowser();
  if (isDefaultBrowser) return true;
  settingDefaultBrowser = true;
  try {
    await requestDefaultBrowser();
    checkDefaultBrowser();
    return isDefaultBrowser;
  } finally {
    settingDefaultBrowser = false;
  }
}

function target(input) {
  const value = input.trim();
  if (!value) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return webUrl(value);
  if (/^(localhost|(?:\d+\.){3}\d+|[^\s/:]+\.[^\s/:]+)(?::\d+)?(?:[/?#][^\s]*)?$/i.test(value)) {
    return webUrl((/^(localhost|127\.)/i.test(value) ? 'http://' : 'https://') + value);
  }
  return searchEngines[searchEngine] + encodeURIComponent(value);
}

function notifySearchViews(event = 'nova:search-preferences') {
  for (const view of [startPage, spotlight]) {
    if (!view || view.webContents.isDestroyed()) continue;
    void view.webContents.executeJavaScriptInIsolatedWorld(1001, [{
      code: `document.dispatchEvent(new Event(${JSON.stringify(event)}));`
    }]).catch(() => {});
  }
}

async function openPrivateWindow(url = '') {
  let profile;
  try {
    profile = await mkdtemp(join(tmpdir(), 'nova-private-'));
    const args = [
      ...(app.isPackaged ? [] : [fileURLToPath(import.meta.url)]),
      '--nova-private', '--nova-private-stdin', '--user-data-dir=' + profile,
      '--nova-private-engine=' + searchEngine, '--nova-private-block-ads=' + preferences.blockAds
    ];
    const child = spawn(process.execPath, args, { detached: true, stdio: ['pipe', 'ignore', 'ignore'] });
    privateWindows.add(child);
    child.stdin.on('error', () => {});
    child.stdin.end(webUrl(url).slice(0, 8192));
    // Chromium helper processes can still be releasing the profile when the main process exits.
    const cleanup = () => setTimeout(() => {
      void rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }).catch(() => {});
    }, 750);
    child.once('exit', () => {
      privateWindows.delete(child);
      cleanup();
    });
    child.once('error', () => {
      privateWindows.delete(child);
      cleanup();
      if (!window.isDestroyed()) dialog.showErrorBox('Could not open private window', 'Try opening it again.');
    });
    child.unref();
  } catch {
    if (profile) void rm(profile, { recursive: true, force: true }).catch(() => {});
    dialog.showErrorBox('Could not open private window', 'NOVA could not create a temporary profile.');
  }
}

async function privateStartAddress() {
  if (!privateMode || !app.commandLine.hasSwitch('nova-private-stdin')) return '';
  let address = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    if (address.length + chunk.length > 8192) return '';
    address += chunk;
  }
  return webUrl(address);
}

function setSitePermissions(origin, keys, value) {
  const site = { ...decisions[origin] };
  for (const key of keys) {
    if (value === 'ask') delete site[key];
    else site[key] = value;
  }
  if (Object.keys(site).length) decisions[origin] = site;
  else delete decisions[origin];
  publish();
}

async function refreshLogins() {
  if (!vault) return;
  try { loginList = await vault.list(); }
  catch { loginList = []; }
  publish(false);
}

async function changeLogin(action, value) {
  if (!vault) return;
  try {
    if (action === 'password-save') {
      const { origin, username, password } = value ?? {};
      if (typeof origin !== 'string' || !secureOrigin(origin).startsWith('https:') ||
          typeof username !== 'string' || username.length > 320 ||
          typeof password !== 'string' || !password || password.length > 4096) {
        throw new Error('Enter an HTTPS website and a password.');
      }
      await vault.save(secureOrigin(origin), username.trim(), password);
    } else {
      if (typeof value !== 'string') return;
      await vault.remove(value);
    }
    await refreshLogins();
    return true;
  } catch (error) {
    if (!window.isDestroyed()) dialog.showErrorBox('Unable to update saved passwords', error.message);
    return false;
  }
}

async function autofillLogin(contents, id, origin) {
  try {
    if (contents !== showing?.webContents || !vault) return;
    const entry = await vault.get(id, origin);
    if (!entry || contents !== showing?.webContents) return;
    if (!await fillLogin(contents, entry) && !window.isDestroyed()) {
      await dialog.showMessageBox(window, { message: 'NOVA couldn’t find a matching sign-in form on this page.' });
    }
  } catch {
    if (!window.isDestroyed()) dialog.showErrorBox('Could not fill the login', 'Check that the sign-in page is still open.');
  }
}

function pageContextMenu(contents, params) {
  if (contents !== showing?.webContents || tour) return;
  const link = webUrl(params.linkURL);
  const image = params.mediaType === 'image' && webUrl(params.srcURL);
  const origin = secureOrigin(contents.getURL());
  const menu = [];
  if (link) menu.push(
    { label: 'Open Link in New Tab', click: () => newTab(link) },
    { label: 'Open Link in Private Window', click: () => void openPrivateWindow(link) },
    { label: 'Copy Link Address', click: () => clipboard.writeText(link) },
    { label: 'Save Link As…', click: () => contents.downloadURL(link) }
  );
  if (image) menu.push(
    { label: 'Open Image in New Tab', click: () => newTab(image) },
    { label: 'Copy Image', click: () => contents.copyImageAt(params.x, params.y) },
    { label: 'Save Image As…', click: () => contents.downloadURL(image) }
  );
  if (params.isEditable) {
    if (menu.length) menu.push({ type: 'separator' });
    menu.push(...editMenu(params.editFlags));
    const logins = loginList.filter(login => login.origin === origin);
    if (logins.length) menu.push({
      label: 'Fill Saved Login',
      submenu: logins.map(login => ({
        label: login.username || 'Saved login', click: () => void autofillLogin(contents, login.id, origin)
      }))
    });
  } else if (params.selectionText.trim()) {
    const selection = params.selectionText.trim().slice(0, 8192);
    menu.push(
      { label: 'Copy', click: () => contents.copy() },
      { label: 'Search for Selection', click: () => newTab(searchEngines[searchEngine] + encodeURIComponent(selection)) }
    );
  }
  if (!menu.length) {
    const current = state();
    menu.push(
      { label: 'Back', enabled: current.canBack, click: () => act('back') },
      { label: 'Forward', enabled: current.canForward, click: () => act('forward') },
      { label: 'Reload', click: () => act('reload') },
      { type: 'separator' },
      { label: 'Print…', click: () => contents.print() }
    );
  }
  Menu.buildFromTemplate(menu).popup({ window, frame: params.frame });
}

function editMenu(flags) {
  return [
    { role: 'cut', enabled: flags.canCut },
    { role: 'copy', enabled: flags.canCopy },
    { role: 'paste', enabled: flags.canPaste },
    { role: 'selectAll', enabled: flags.canSelectAll }
  ];
}

function installEditMenu(contents) {
  contents.on('context-menu', (_event, params) => {
    if (params.isEditable) Menu.buildFromTemplate(editMenu(params.editFlags)).popup({ window, frame: params.frame });
  });
}

const active = () => tabs.find(tab => tab.id === activeId);
const siteOrigin = url => url ? new URL(url).origin : '';
const showingTourDashboard = () => Boolean(tour && tour.step >= 2);
const sidebarVisible = () => sidebar || showingTourDashboard();

function state() {
  const current = active();
  const navigation = current?.url ? current.view?.webContents.navigationHistory : undefined;
  const origin = current?.url ? siteOrigin(current.url) : '';
  return {
    tabs: tabs.map(({ id, title, url, favicon, loading, pinned, error }) => ({ id, title, url, favicon, loading, pinned, error })),
    media: tabs.filter(tab => tab.media).map(tab => ({ ...tab.media, id: tab.id, favicon: tab.favicon, url: tab.url, tabTitle: tab.title })),
    tabPreviews: tabPreviews?.ready ? { images: tabPreviews.images, source: tabPreviews.source } : undefined,
    activeId, sidebar: sidebarVisible(), pageBlur, toolbarBlur, searchEngine, preferences, contentBlocking, history, bookmarks, favorites, favoriteLimit,
    extensions: [...extensions.values()],
    privateMode,
    defaultBrowser: requestDefaultBrowser ? isDefaultBrowser ? 'default' : 'available' : 'unavailable',
    update: updater?.state(),
    findResult,
    savedLogins: loginList,
    site: origin ? {
      origin,
      connection: origin.startsWith('http:') ? 'http' : current.error || current.loading ? 'unverified' : 'https',
      permissions: decisions[origin] ?? {},
      canSetPermissions: Boolean(secureOrigin(origin)),
      adException: adExceptions.has(origin)
    } : undefined,
    downloads: downloads.map(({ id, name, progress, status }) => {
      const item = downloadItems.get(id);
      return { id, name, progress, status, canControl: Boolean(item), canResume: item?.canResume() };
    }),
    canBack: Boolean(navigation?.canGoBack() || (current?.url && current?.fromHome)),
    canForward: Boolean(navigation?.canGoForward() || (!current?.url && current?.homeForward)),
    zoom: Math.round((current?.view?.webContents.getZoomFactor() ?? preferences.defaultZoom / 100) * 100),
    fullscreen: Boolean(window && !window.isDestroyed() && window.isFullScreen()),
    platform: process.platform
  };
}

async function capturePreview(tab, view, width) {
  if (!tab || !view || view.webContents.isDestroyed()) return;
  const url = tab.url;
  try {
    const image = await view.webContents.capturePage(undefined, { stayHidden: true });
    if (image.isEmpty() || tab.url !== url) return;
    const preview = image.resize({ width }).toJPEG(82).toString('base64');
    const src = 'data:image/jpeg;base64,' + preview;
    previewCache.set(tab, { url, src });
    return src;
  } catch {
    // Closing a tab can interrupt capture.
  }
}

async function openTabOverview() {
  if (tabPreviews) return;
  const current = active();
  const view = showing;
  const overview = { images: {}, source: view?.getBounds(), ready: false };
  tabPreviews = overview;
  for (const tab of tabs) {
    const cached = previewCache.get(tab);
    if (cached?.url === tab.url) overview.images[tab.id] = cached.src;
  }
  if (current && view) {
    let timeout;
    const capture = capturePreview(current, view, 960);
    const src = await Promise.race([capture, new Promise(resolve => { timeout = setTimeout(resolve, 140); })]);
    clearTimeout(timeout);
    if (tabPreviews !== overview) return;
    if (src) overview.images[current.id] = src;
    else void capture.then(image => {
      if (!image || tabPreviews !== overview) return;
      overview.images[current.id] = image;
      publish(false);
    });
  }
  panel = true;
  overview.ready = true;
  layout();
  publish(false);
  void (async () => {
    for (const tab of tabs) {
      if (tabPreviews !== overview) return;
      if (tab === current || overview.images[tab.id] || !tab.view) continue;
      const src = await capturePreview(tab, tab.view, 480);
      if (tabPreviews !== overview) return;
      if (!src) continue;
      overview.images[tab.id] = src;
      publish(false);
    }
  })();
}

function publish(persist = true) {
  if (window && !window.isDestroyed()) window.webContents.send('browser:state', state());
  if (mediaPopup && !mediaPopup.isDestroyed()) {
    const media = state().media.find(item => item.playing) ?? state().media[0];
    if (media) mediaPopup.webContents.send('media-popup:data', media);
    else closeMediaPopup();
  }
  if (!persist || privateMode || !file) return;
  const data = JSON.stringify({
    tabs: tabs.map(({ id, title, url, favicon, pinned }) => ({ id, title, url, favicon, pinned })),
    activeId, sidebar, pageBlur, toolbarBlur, searchEngine, preferences, history, bookmarks, favorites, tourCompleted,
    extensions: [...extensions.keys()], decisions, adExceptions: [...adExceptions],
    downloads: downloads.map(({ id, name, progress, status, path }) => ({ id, name, progress, status, path }))
  });
  saveQueue = saveQueue.then(async () => {
    await writeFile(file + '.tmp', data);
    await rename(file + '.tmp', file);
  }).catch(error => console.error('Could not save browser session:', error));
}

function setPageBackdrop(top = '', side = '') {
  if (window.isDestroyed() || (pageBackdrop.top === top && pageBackdrop.side === side)) return;
  pageBackdrop = { top, side };
  window.webContents.send('browser:page-backdrop', pageBackdrop);
}

async function refreshPageBackdrop() {
  const captureSide = sidebar && pageBlur;
  if ((!toolbarBlur && !captureSide) || capturingBackdrop || !showing || fullscreenPage === showing || !window.isFocused() || window.isMinimized()) return;
  const view = showing;
  const { width, height } = view.getBounds();
  if (!width || !height) return;

  const revision = backdropRevision;
  capturingBackdrop = true;
  try {
    const contents = view.webContents;
    const top = toolbarBlur ? await contents.capturePage({ x: 0, y: 0, width, height: Math.min(65, height) }, { stayHidden: true }) : null;
    if (revision !== backdropRevision) return;
    const side = captureSide ? await contents.capturePage({ x: 0, y: 0, width: Math.min(65, width), height }, { stayHidden: true }) : null;
    if (revision !== backdropRevision) return;
    setPageBackdrop(
      top && !top.isEmpty() ? top.resize({ width: 96, height: 5 }).toDataURL() : '',
      sidebar && side && !side.isEmpty() ? side.resize({ width: 5, height: 96 }).toDataURL() : ''
    );
  } catch {
    // The active page can close or navigate while a frame is being captured.
  } finally {
    capturingBackdrop = false;
  }
}

function layout() {
  if (!window || window.isDestroyed()) return;
  const tab = active();
  const view = showingTourDashboard() ? startPage
    : panel || tab?.error || !tab ? undefined
    : tab.url ? tab.view : preferences.newTabPage === 'dashboard' ? startPage : undefined;
  if (showing !== view) {
    backdropRevision++;
    setPageBackdrop();
    if (showing) window.contentView.removeChildView(showing);
    if (view) window.contentView.addChildView(view);
    showing = view;
    if (addressPopupData && addressPopup) window.contentView.addChildView(addressPopup);
    if (spotlight && spotlightVisible) window.contentView.addChildView(spotlight);
    if (tour?.visible) window.contentView.addChildView(tour.view);
  }
  if (tour?.visible) resizeTour();
  if (spotlight && spotlightVisible) resizeSpotlight();
  if (view) {
    const [width, height] = window.getContentSize();
    if (view === fullscreenPage) {
      view.setBounds({ x: 0, y: 0, width, height });
      return;
    }
    const x = sidebarVisible() ? sidebarWidth : pageGap;
    view.setBounds({ x, y: topInset, width: Math.max(0, width - x - pageGap), height: Math.max(0, height - topInset - pageGap) });
  }
}

function closeMediaPopup() {
  clearTimeout(mediaCloseTimer);
  mediaExpanded = false;
  if (mediaPopup && !mediaPopup.isDestroyed()) mediaPopup.hide();
  if (window && !window.isDestroyed()) window.webContents.send('browser:media-popup-closed');
}

function scheduleMediaPopupClose() {
  clearTimeout(mediaCloseTimer);
  mediaCloseTimer = setTimeout(() => {
    if (!window || window.isDestroyed() || !mediaPopup || mediaPopup.isDestroyed()) return closeMediaPopup();
    const point = screen.getCursorScreenPoint();
    const popup = mediaPopup.getBounds();
    const parent = window.getContentBounds();
    const inside = (box) => point.x >= box.x && point.x < box.x + box.width && point.y >= box.y && point.y < box.y + box.height;
    const tileAndBridge = { x: parent.x + 4, y: parent.y + parent.height - 105, width: sidebarWidth, height: 64 };
    if (inside(popup) || inside(tileAndBridge)) return;
    closeMediaPopup();
  }, 500);
}

function openMediaPopup() {
  clearTimeout(mediaCloseTimer);
  if (!sidebar || !tabs.some(tab => tab.media)) return;
  mediaExpanded = true;
  if (!mediaPopup) {
    mediaPopup = new BrowserWindow({
      parent: window, width: 320, height: 116, frame: false, show: false, acceptFirstMouse: true,
      resizable: false, movable: false, skipTaskbar: true, hasShadow: true,
      transparent: true,
      ...(process.platform === 'darwin' ? { vibrancy: 'popover', visualEffectState: 'active' } : {}),
      webPreferences: { ...chromePreferences(), preload: join(root, 'desktop/media-popup-preload.cjs') }
    });
    mediaPopup.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mediaPopup.webContents.on('before-input-event', shortCommand);
    mediaPopup.webContents.on('will-navigate', event => event.preventDefault());
    mediaPopup.webContents.on('did-finish-load', () => publish(false));
    void mediaPopup.loadFile(join(root, 'desktop/media-popup.html'));
  }
  const bounds = window.getContentBounds();
  mediaPopup.setPosition(bounds.x + sidebarWidth - 5, bounds.y + bounds.height - 153);
  mediaPopup.showInactive();
  publish(false);
}

function shortCommand(event, input) {
  if (input.type !== 'keyDown' || !(input.meta || input.control) || input.alt) return;
  const key = input.key.toLowerCase();
  if (key === 'n' && input.shift) {
    event.preventDefault();
    void openPrivateWindow();
    return;
  }
  if (key === 'k' && !input.shift) {
    event.preventDefault();
    openBrowserSearch();
    return;
  }
  if (fullscreenPage && fullscreenPage === showing) return;
  const command = ({ k: 'commands', f: 'find', d: 'bookmark', t: input.shift ? 'reopen' : 'new', w: 'close', r: 'reload' })[key];
  if (!command) return;
  event.preventDefault();
  window.webContents.focus();
  window.webContents.send('browser:shortcut', command);
}

function openBrowserSearch() {
  if (!window || window.isDestroyed() || tour) return;
  updateAddressPopup(null);
  if (spotlight) {
    closeSpotlight();
    return;
  }
  if (fullscreenPage && fullscreenPage === showing) {
    void fullscreenPage.webContents.executeJavaScriptInIsolatedWorld(1001, [{
      code: 'if (document.fullscreenElement) document.exitFullscreen().catch(() => {});'
    }]).catch(() => {});
  }
  if (!startPage || startPage.webContents.isDestroyed()) return;
  if (showing === startPage) {
    closeMediaPopup();
    window.focus();
    startPage.webContents.focus();
    void startPage.webContents.executeJavaScriptInIsolatedWorld(1001, [{
      code: "document.dispatchEvent(new Event('nova:open-home-search'));"
    }]).catch(() => {});
    return;
  }
  closeMediaPopup();
  window.focus();
  const view = new WebContentsView({
    webPreferences: { ...webPreferences, session: startPage.webContents.session, preload: join(root, 'desktop/spotlight-preload.cjs') }
  });
  spotlight = view;
  view.setBackgroundColor('#00000000');
  const contents = view.webContents;
  installEditMenu(contents);
  const page = showing;
  const backdrop = page?.webContents.capturePage(undefined, { stayHidden: true }).catch(() => undefined);
  function navigate(url, newWindow) {
    const destination = webUrl(url);
    if (spotlight !== view || contents.getURL() !== spotlightUrl || !destination) return;
    closeSpotlight(false);
    window.webContents.send('browser:shortcut', 'dismiss-panel');
    if (newWindow) newTab(destination);
    else act('go', destination);
    showing?.webContents.focus();
  }
  contents.on('will-navigate', (event, details) => {
    event.preventDefault();
    navigate(typeof details === 'string' ? details : details?.url ?? event.url, false);
  });
  contents.setWindowOpenHandler(({ url }) => {
    navigate(url, true);
    return { action: 'deny' };
  });
  contents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape') {
      event.preventDefault();
      closeSpotlight();
    } else {
      shortCommand(event, input);
    }
  });
  void contents.loadURL(spotlightUrl).then(() => {
    if (spotlight !== view || window.isDestroyed()) return;
    spotlightVisible = true;
    resizeSpotlight();
    window.contentView.addChildView(view);
    contents.focus();
    void backdrop?.then(image => {
      if (spotlight !== view || contents.isDestroyed() || !image || image.isEmpty()) return;
      contents.send('spotlight:backdrop', image.resize({ width: 480 }).toDataURL());
    });
  }).catch(() => {
    if (spotlight !== view) return;
    closeSpotlight(false);
    window.webContents.focus();
    window.webContents.send('browser:shortcut', 'address');
  });
}

function resizeSpotlight() {
  const [width, height] = window.getContentSize();
  spotlight?.setBounds({ x: 0, y: 0, width, height });
}

function closeSpotlight(restoreFocus = true) {
  if (!spotlight) return;
  const view = spotlight;
  spotlight = undefined;
  if (!window.isDestroyed()) {
    if (spotlightVisible) window.contentView.removeChildView(view);
    if (restoreFocus) (showing?.webContents ?? window.webContents).focus();
  }
  spotlightVisible = false;
  if (!view.webContents.isDestroyed()) view.webContents.close();
}

function resizeTour() {
  const [width, height] = window.getContentSize();
  tour?.view.setBounds({ x: 0, y: 0, width, height });
}

async function openTour() {
  if (tour || !window || window.isDestroyed()) return;
  closeSpotlight(false);
  closeMediaPopup();
  updateAddressPopup(null);
  const view = new WebContentsView({
    webPreferences: { ...chromePreferences(), preload: join(root, 'desktop/tour-preload.cjs') }
  });
  const current = { view, step: 0, visible: false };
  tour = current;
  view.setBackgroundColor('#00000000');
  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  view.webContents.on('will-navigate', event => event.preventDefault());
  try {
    await view.webContents.loadURL(tourUrl);
    if (tour !== current || window.isDestroyed()) return;
    current.visible = true;
    resizeTour();
    window.contentView.addChildView(view);
    view.webContents.focus();
  } catch (error) {
    if (tour === current) closeTour(false);
    console.error('Could not load the NOVA tour:', error);
  }
}

function closeTour(completed) {
  if (!tour) return;
  const { view, visible } = tour;
  tour = undefined;
  if (completed) tourCompleted = true;
  if (!window.isDestroyed()) {
    if (visible) window.contentView.removeChildView(view);
    layout();
    (showing?.webContents ?? window.webContents).focus();
    publish(completed);
  }
  if (!view.webContents.isDestroyed()) view.webContents.close();
}

async function updateTourStep(step, name) {
  if (!Number.isInteger(step) || step < 0 || step > 4 || !tour) return;
  const current = tour;
  current.step = step;
  layout();
  publish(false);
  if (step !== 2 || typeof name !== 'string' || !name.trim() || !startPage) return;
  const value = JSON.stringify(name.trim().slice(0, 30));
  const applyName = () => startPage.webContents.executeJavaScriptInIsolatedWorld(1001, [{
    code: `document.dispatchEvent(new CustomEvent('nova:tour-name', { detail: ${value} }));`
  }]).catch(() => {});
  if (startPage.webContents.isLoadingMainFrame()) startPage.webContents.once('did-finish-load', applyName);
  else await applyName();
}

async function tourTargets() {
  const step = tour?.step;
  if (step === undefined || step < 2) return { bounds: [] };
  const [contents, selectors, offset] = step === 2
    ? [startPage.webContents, ['.customize', '.favorites-handle'], startPage.getBounds()]
    : [window.webContents, step === 3 ? ['.sidebar'] : ['.address-pill', '.tab-controls'], { x: 0, y: 0 }];
  const source = JSON.stringify(selectors);
  try {
    const pageBounds = startPage.getBounds();
    const [rects, backdrop] = await Promise.all([contents.executeJavaScriptInIsolatedWorld(1001, [{
      code: `${source}.flatMap(selector => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect?.width && rect?.height ? [{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }] : [];
      })`
    }]), startPage.webContents.capturePage(undefined, { stayHidden: true }).catch(() => undefined)]);
    return {
      bounds: rects.map(rect => ({ ...rect, x: rect.x + offset.x, y: rect.y + offset.y })),
      backdrop: backdrop && !backdrop.isEmpty()
        ? { ...pageBounds, src: backdrop.resize({ width: 480 }).toDataURL() }
        : undefined
    };
  } catch {
    return { bounds: [] };
  }
}

function createPage(pageSession = webSession) {
  const view = new WebContentsView({ webPreferences: { ...webPreferences, session: pageSession } });
  view.setBackgroundColor('#17191b');
  view.setBorderRadius(9);
  return view;
}

async function renderAddressPopup() {
  const data = addressPopupData;
  if (!addressPopup || addressPopup.webContents.isDestroyed() || !data) return;
  const [width, height] = window.getContentSize();
  const x = Math.max(0, Math.round(data.x));
  const y = Math.max(0, Math.round(data.y));
  addressPopup.setBounds({
    x, y,
    width: Math.max(0, Math.min(width - x, Math.round(data.width))),
    height: Math.max(0, Math.min(height - y, 12 + 36 * data.rows.length))
  });
  addressPopup.webContents.send('address-popup:update', data);
  addressPopup.setVisible(true);
  const view = showing;
  if (!view || view.webContents.isDestroyed()) return;
  const bounds = view.getBounds();
  const popup = addressPopup.getBounds();
  const x = Math.max(0, popup.x - bounds.x);
  const y = Math.max(0, popup.y - bounds.y);
  const captureWidth = Math.min(popup.width, bounds.width - x);
  const captureHeight = Math.min(popup.height, bounds.height - y);
  if (captureWidth <= 0 || captureHeight <= 0) return;
  try {
    const image = await view.webContents.capturePage({ x, y, width: captureWidth, height: captureHeight }, { stayHidden: true });
    if (addressPopupData === data && showing === view && !image.isEmpty()) {
      addressPopup.webContents.send('address-popup:backdrop', image.resize({ width: 96, height: 36 }).toDataURL());
    }
  } catch {}
}

function updateAddressPopup(data) {
  if (!data || !Array.isArray(data.rows) || !data.rows.length || spotlightVisible ||
      ![data.x, data.y, data.width].every(Number.isFinite)) {
    addressPopupData = undefined;
    addressPopup?.setVisible(false);
    return;
  }
  addressPopupData = { ...data, rows: data.rows.slice(0, 8) };
  if (addressPopup && !addressPopup.webContents.isLoadingMainFrame()) void renderAddressPopup();
}

function createAddressPopup() {
  const view = new WebContentsView({
    webPreferences: { ...chromePreferences(), preload: join(root, 'desktop/address-popup-preload.cjs') }
  });
  addressPopup = view;
  view.setBackgroundColor('#00000000');
  view.setVisible(false);
  window.contentView.addChildView(view);
  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  view.webContents.on('will-navigate', event => event.preventDefault());
  void view.webContents.loadFile(join(root, 'desktop/address-popup.html')).then(renderAddressPopup).catch(() => {});
}

async function addressSuggestions(query) {
  if (!preferences.liveSuggestions || typeof query !== 'string') return [];
  const value = query.trim();
  // Keep URL-like input out of autocomplete.
  if (value.length < 2 || value.length > 200 || /[.:/@\\]/.test(value) ||
      target(value) !== searchEngines[searchEngine] + encodeURIComponent(value)) return [];
  return new Promise(resolve => void suggestionsHandler({
    url: '/api/suggest?q=' + encodeURIComponent(value), method: 'GET'
  }, {
    setHeader() {},
    writeHead() {},
    end(body) { resolve(JSON.parse(body)[1] ?? []); }
  }));
}

function createStartPage() {
  const startSession = session.fromPartition(privateMode ? 'nova-private-start' : 'persist:nova-start');
  if (process.platform === 'darwin') {
    startSession.registerPreloadScript({ type: 'frame', filePath: join(root, 'desktop/trackpad.cjs') });
  }
  startSession.protocol.handle('nova', async request => {
    const url = new URL(request.url);
    if (url.protocol !== 'nova:' || url.host !== 'home') return new Response(null, { status: 404 });
    if (url.pathname === '/api/browser-search') {
      return Response.json({ engine: searchEngine, liveSuggestions: preferences.liveSuggestions, rememberHistory: preferences.rememberHistory, privateMode });
    }
    if (url.pathname === '/api/suggest') {
      if (!preferences.liveSuggestions) return Response.json(['', []]);
      return new Promise(send => {
        let status = 200;
        const headers = new Headers();
        void suggestionsHandler({ url: url.pathname + url.search, method: request.method }, {
          setHeader: (name, value) => headers.set(name, value),
          writeHead: code => { status = code; },
          end: body => send(new Response(body, { status, headers }))
        });
      });
    }
    try {
      const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const path = resolve(startFiles, '.' + pathname);
      if (!path.startsWith(startFiles + sep)) return new Response(null, { status: 403 });
      return await net.fetch(pathToFileURL(path).href);
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  const view = createPage(startSession);
  const contents = view.webContents;
  contents.on('before-input-event', shortCommand);
  installEditMenu(contents);
  contents.on('will-navigate', (event, details) => {
    const url = typeof details === 'string' ? details : details?.url ?? event.url;
    if (url === startUrl) return;
    event.preventDefault();
    if (webUrl(url) && showing === view) act('go', url);
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (webUrl(url) && showing === view) newTab(url);
    return { action: 'deny' };
  });
  return view;
}

function load(tab, url) {
  if (siteOrigin(tab.url) !== siteOrigin(url)) tab.favicon = undefined;
  tab.url = url;
  tab.error = '';
  tab.loading = true;
  if (!tab.view) {
    const view = createPage();
    tab.view = view;
    const contents = view.webContents;
    contents.setZoomMode('isolated');
    contents.on('did-start-navigation', (details, url, _inPlace, main) => {
      if (details.isMainFrame ?? main) loginPrompts?.navigation(contents, details.url ?? url);
    });
    contents.once('destroyed', () => loginPrompts?.cancel(contents));
    contents.on('did-finish-load', () => {
      contents.setZoomFactor(tab.zoomFactor ?? preferences.defaultZoom / 100);
      void applyPageFont(contents);
    });
    contents.on('before-input-event', shortCommand);
    contents.on('context-menu', (_event, params) => pageContextMenu(contents, params));
    contents.on('found-in-page', (_event, result) => {
      if (findRequest?.contents !== contents || findRequest.id !== result.requestId || active() !== tab) return;
      findResult = { matches: result.matches, active: result.activeMatchOrdinal };
      publish(false);
    });
    contents.on('enter-html-full-screen', () => {
      if (showing !== view) return;
      fullscreenPage = view;
      view.setBorderRadius(0);
      layout();
    });
    contents.on('leave-html-full-screen', () => {
      if (fullscreenPage !== view) return;
      fullscreenPage = undefined;
      view.setBorderRadius(9);
      layout();
    });
    for (const name of ['will-navigate', 'will-redirect', 'will-frame-navigate']) {
      contents.on(name, (event, details) => {
        if (!webUrl(typeof details === 'string' ? details : details?.url ?? event.url)) event.preventDefault();
      });
    }
    contents.setWindowOpenHandler(({ url }) => {
      if (webUrl(url)) newTab(url);
      return { action: 'deny' };
    });
    const visited = (_event, url, main = true) => {
      if (tab.homeForward || !main || !webUrl(url)) return;
      const hadError = Boolean(tab.error);
      if (siteOrigin(tab.url) !== siteOrigin(url)) tab.favicon = undefined;
      tab.url = url;
      tab.error = '';
      tab.title = new URL(url).hostname;
      if (preferences.rememberHistory) history = [{ url, title: tab.title, time: Date.now() }, ...history.filter(item => item.url !== url)].slice(0, 300);
      if (hadError) layout();
      publish();
    };
    contents.on('did-navigate', (event, url) => visited(event, url));
    contents.on('did-navigate-in-page', visited);
    contents.on('page-favicon-updated', (_event, urls) => {
      const favicon = urls.find(url => url.length <= 4096 && webUrl(url));
      if (!favicon || favicon === tab.favicon) return;
      tab.favicon = favicon;
      const bookmark = bookmarks.find(item => item.url === tab.url);
      if (bookmark) bookmark.favicon = favicon;
      const favorite = favorites.find(item => item.url === tab.url);
      if (favorite) favorite.favicon = favicon;
      publish();
    });
    contents.on('page-title-updated', (_event, title) => {
      if (tab.homeForward) return;
      tab.title = title.slice(0, 300);
      const item = history.find(item => item.url === tab.url);
      if (item) item.title = tab.title;
      publish();
    });
    contents.on('did-start-loading', () => { tab.loading = true; publish(false); });
    contents.on('did-stop-loading', () => { tab.loading = false; publish(false); });
    contents.on('did-fail-load', (_event, code, message, url, main) => {
      if (tab.homeForward || !main || code === -3) return;
      loginPrompts?.cancel(contents);
      if (webUrl(url)) tab.url = url;
      tab.loading = false;
      tab.error = message;
      layout();
      publish(false);
    });
    contents.on('render-process-gone', () => {
      loginPrompts?.cancel(contents);
      if (fullscreenPage === view) {
        fullscreenPage = undefined;
        view.setBorderRadius(9);
      }
      tab.error = 'The page stopped responding.';
      tab.loading = false;
      layout();
      publish(false);
    });
  }
  tab.view.webContents.loadURL(url).catch(() => {});
  layout();
  publish();
}

async function applyPageFont(contents) {
  if (contents.isDestroyed()) return;
  const previous = pageFontRules.get(contents);
  const rule = { key: undefined };
  pageFontRules.set(contents, rule);
  try {
    if (previous?.key) await contents.removeInsertedCSS(previous.key).catch(() => {});
    if (pageFontRules.get(contents) !== rule || preferences.fontSize === 16) return;
    const key = await contents.insertCSS(`html { font-size: ${preferences.fontSize}px !important; }`, { cssOrigin: 'user' });
    if (pageFontRules.get(contents) === rule) rule.key = key;
    else await contents.removeInsertedCSS(key);
  } catch {
    // A tab can close while its preference is being applied.
  }
}

function updatePreference(key, value, persist = true) {
  switch (key) {
    case 'sidebar':
    case 'toolbar': {
      if (!Array.isArray(value)) return;
      const options = [...new Set([...iconDefaults[key], ...extraIcons])];
      preferences[key] = [...new Set(value.filter(icon => options.includes(icon)))];
      break;
    }
    case 'defaultZoom':
      if (![75, 90, 100, 110, 125, 150, 175, 200].includes(value)) return;
      preferences.defaultZoom = value;
      for (const tab of tabs) {
        tab.zoomFactor = undefined;
        tab.view?.webContents.setZoomFactor(value / 100);
      }
      break;
    case 'fontSize':
      if (![12, 14, 16, 18, 20, 24].includes(value)) return;
      preferences.fontSize = value;
      for (const tab of tabs) if (tab.view) void applyPageFont(tab.view.webContents);
      break;
    case 'newTabPage':
      if (!['dashboard', 'blank'].includes(value)) return;
      preferences.newTabPage = value;
      break;
    case 'restoreTabs':
    case 'offerSaveLogins':
    case 'liveSuggestions':
    case 'rememberHistory':
    case 'swipeHistory':
    case 'pinchOverview':
    case 'pinchOpenTab':
    case 'blockAds':
      if (typeof value !== 'boolean') return;
      if (privateMode && ['rememberHistory', 'restoreTabs'].includes(key)) return;
      preferences[key] = value;
      if (['liveSuggestions', 'rememberHistory'].includes(key)) notifySearchViews();
      if (key === 'offerSaveLogins') {
        if (!value) loginPrompts?.cancelAll();
        for (const tab of tabs) {
          const contents = tab.view?.webContents;
          if (contents && !contents.isDestroyed()) contents.send('nova:login-config', value);
        }
      }
      if (key === 'blockAds') contentBlocker?.setEnabled(value);
      break;
    default: return;
  }
  if (persist) {
    layout();
    publish();
  }
}

async function chooseDownloadFolder() {
  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    title: 'Choose download location', defaultPath: preferences.downloadFolder, properties: ['openDirectory', 'createDirectory']
  });
  if (canceled || !filePaths[0]) return;
  preferences.downloadFolder = filePaths[0];
  webSession.setDownloadPath(preferences.downloadFolder);
  publish();
}

async function loadExtensionFolder(path) {
  try {
    const folder = await realpath(path);
    const current = extensions.get(folder);
    if (current?.id) return;
    const { id, name, version } = await webSession.extensions.loadExtension(folder, { allowFileAccess: false });
    for (const [previous, extension] of extensions) {
      if (previous !== folder && extension.id === id) extensions.delete(previous);
    }
    if (path !== folder) extensions.delete(path);
    extensions.set(folder, { path: folder, id, name, version });
  } catch (error) {
    extensions.set(path, { path, name: basename(path), error: String(error.message ?? error) });
  }
}

async function chooseExtensionFolder() {
  if (choosingExtension) return;
  choosingExtension = true;
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Load unpacked extension',
      message: 'Choose a folder you trust that contains the extension’s manifest.json.',
      properties: ['openDirectory']
    });
    if (canceled || !filePaths[0]) return;
    await loadExtensionFolder(filePaths[0]);
    publish();
  } finally {
    choosingExtension = false;
  }
}

async function clearSiteData(origin) {
  if (clearingData) return;
  clearingData = true;
  try {
    const { response } = await dialog.showMessageBox(window, {
      type: 'warning', message: 'Clear cookies and site data?',
      detail: origin ? `This can sign you out of ${origin} and remove its site data.`
        : 'This will sign you out of websites and remove their local data and cache.',
      buttons: ['Cancel', 'Clear data'], defaultId: 0, cancelId: 0
    });
    if (response !== 1) return;
    await webSession.clearData({ dataTypes: siteDataTypes, ...(origin ? { origins: [origin] } : {}) });
    await dialog.showMessageBox(window, { message: 'Website data cleared.' });
  } catch {
    if (!window.isDestroyed()) dialog.showErrorBox('Could not clear website data', 'Some site data may remain.');
  } finally {
    clearingData = false;
  }
}

function newTab(url = '', restored = {}) {
  const tab = { id: randomUUID(), title: 'New tab', ...restored, url };
  tabs.push(tab);
  select(tab.id);
}

function select(id) {
  if (id !== activeId) loginPrompts?.cancelAll();
  const tab = tabs.find(entry => entry.id === id);
  if (!tab) return;
  if (id !== activeId && showing && showing !== fullscreenPage) void capturePreview(active(), showing, 560);
  closeMediaPopup();
  clearFind();
  activeId = id;
  panel = false;
  tabPreviews = undefined;
  if (tab.url && !tab.view) load(tab, tab.url);
  layout();
  publish();
}

function goHome(tab) {
  loginPrompts?.cancelAll();
  if (!tab.url) return;
  clearFind();
  if (tab.view) {
    const contents = tab.view.webContents;
    tab.homeMuted = contents.isAudioMuted();
    contents.setAudioMuted(true);
  }
  tab.homeForward = { url: tab.url, title: tab.title, favicon: tab.favicon, error: tab.error };
  tab.media = undefined;
  Object.assign(tab, { url: '', title: 'New tab', favicon: undefined, error: '', loading: false });
  layout();
  publish();
}

function clearFind() {
  if (findRequest && !findRequest.contents.isDestroyed()) findRequest.contents.stopFindInPage('clearSelection');
  findRequest = undefined;
  findResult = undefined;
  findText = '';
}

function act(action, value) {
  const tab = active();
  const contents = tab?.view?.webContents;
  switch (action) {
    case 'new': return newTab();
    case 'make-default-browser': return makeDefaultBrowser();
    case 'browser-update': return updater?.install();
    case 'select': return select(value);
    case 'reopen': {
      const item = closed.pop();
      return item && newTab(item.url, item);
    }
    case 'close': {
      const index = tabs.findIndex(item => item.id === (value ?? activeId));
      if (index < 0) return;
      const [removed] = tabs.splice(index, 1);
      const { id, title, url, favicon, pinned } = removed;
      closed.push({ id, title, url, favicon, pinned });
      if (closed.length > 40) closed.shift();
      if (!tabs.length) newTab();
      else if (id === activeId) select(tabs[Math.min(index, tabs.length - 1)].id);
      removed.view?.webContents.close();
      break;
    }
    case 'go': {
      const url = typeof value === 'string' && target(value.slice(0, 8192));
      if (!url || !tab) return;
      clearFind();
      if (tab.homeForward) {
        tab.view?.webContents.close();
        tab.view = undefined;
        tab.homeForward = undefined;
      }
      if (!tab.url) tab.fromHome = true;
      panel = false;
      return load(tab, url);
    }
    case 'home': if (tab) { panel = false; return goHome(tab); } break;
    case 'back':
      if (!tab?.url) return;
      if (contents?.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
      else if (tab?.fromHome) return goHome(tab);
      break;
    case 'forward':
      if (tab?.homeForward) {
        Object.assign(tab, tab.homeForward, { homeForward: undefined, fromHome: true });
        contents?.setAudioMuted(Boolean(tab.homeMuted));
        tab.homeMuted = undefined;
      } else if (contents?.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
      break;
    case 'reload':
      if (tab?.error) return load(tab, tab.url);
      if (tab?.loading) contents?.stop();
      else contents?.reload();
      break;
    case 'sidebar': sidebar = typeof value === 'boolean' ? value : !sidebar; if (!sidebar) closeMediaPopup(); break;
    case 'media-expand':
      if (value === true) openMediaPopup();
      else scheduleMediaPopupClose();
      return;
    case 'media-toggle': {
      const mediaTab = tabs.find(item => item.id === value && item.media);
      if (mediaTab?.view && !mediaTab.view.webContents.isDestroyed()) mediaTab.view.webContents.send('nova:media-control', 'toggle');
      return;
    }
    case 'media-seek': {
      const mediaTab = tabs.find(item => item.id === value?.id && item.media);
      if (Number.isFinite(value?.time) && mediaTab?.view && !mediaTab.view.webContents.isDestroyed()) {
        mediaTab.view.webContents.send('nova:media-control', { type: 'seek', time: value.time });
      }
      return;
    }
    case 'preference': return updatePreference(value?.key, value?.value);
    case 'download-folder': return chooseDownloadFolder();
    case 'load-extension': return chooseExtensionFolder();
    case 'remove-extension': {
      const extension = extensions.get(value);
      if (!extension) return;
      if (extension.id) webSession.extensions.removeExtension(extension.id);
      extensions.delete(value);
      break;
    }
    case 'clear-site-data': return clearSiteData();
    case 'clear-current-site': return tab?.url && clearSiteData(siteOrigin(tab.url));
    case 'private-window': return openPrivateWindow();
    case 'site-permission':
      if (tab?.url && secureOrigin(tab.url) && Object.hasOwn(permissionLabels, value?.key) &&
          ['ask', 'allow', 'block'].includes(value?.decision)) {
        setSitePermissions(siteOrigin(tab.url), [value.key], value.decision);
      }
      return;
    case 'site-ad-exception':
      if (!tab?.url || typeof value !== 'boolean') return;
      if (value) adExceptions.add(siteOrigin(tab.url));
      else adExceptions.delete(siteOrigin(tab.url));
      break;
    case 'password-save':
    case 'password-remove': return changeLogin(action, value);
    case 'download-control': {
      const item = downloadItems.get(value?.id);
      const entry = downloads.find(entry => entry.id === value?.id);
      if (!item || !entry) return;
      if (value.action === 'pause' && entry.status === 'progressing') { item.pause(); entry.status = 'paused'; }
      else if (value.action === 'resume' && ['paused', 'interrupted'].includes(entry.status) && item.canResume()) {
        item.resume();
        entry.status = 'progressing';
      } else if (value.action === 'cancel') item.cancel();
      publish();
      return;
    }
    case 'copy-generated-password':
      if (typeof value === 'string' && /^[A-Za-z0-9_-]{24}$/.test(value)) clipboard.writeText(value);
      return;
    case 'page-blur':
      if (typeof value !== 'boolean') return;
      pageBlur = value;
      backdropRevision++;
      if (!pageBlur) setPageBackdrop(pageBackdrop.top);
      break;
    case 'toolbar-blur':
      if (typeof value !== 'boolean') return;
      toolbarBlur = value;
      backdropRevision++;
      if (!toolbarBlur) setPageBackdrop('', pageBackdrop.side);
      break;
    case 'search-engine':
      if (typeof value !== 'string' || !Object.hasOwn(searchEngines, value)) return;
      searchEngine = value;
      notifySearchViews();
      break;
    case 'save-favorite': {
      const index = value?.index;
      if (!Number.isInteger(index) || index < 0 || index >= favoriteLimit) return;
      const source = value.tabId ? tabs.find(item => item.id === value.tabId) : undefined;
      const url = source?.url || (typeof value.url === 'string' && value.url.length <= 8192 && webUrl(value.url));
      if (!url) return;
      const previous = favorites.findIndex(item => item.url === url);
      if (previous < 0 && favorites.length >= favoriteLimit) return;
      const [existing] = previous >= 0 ? favorites.splice(previous, 1) : [];
      favorites.splice(index, 0, existing ?? { url, title: source?.title || new URL(url).hostname, favicon: source?.favicon });
      break;
    }
    case 'remove-favorite':
      favorites = favorites.filter(item => item.url !== value);
      break;
    case 'open-favorite': {
      const favorite = favorites.find(item => item.url === value);
      if (!favorite) return;
      const open = tabs.find(item => item.url === favorite.url);
      return open ? select(open.id) : newTab(favorite.url, favorite);
    }
    case 'panel':
      if (value === 'tabs') return openTabOverview();
      panel = value === true;
      tabPreviews = undefined;
      break;
    case 'pin': if (tab) tab.pinned = !tab.pinned; break;
    case 'bookmark':
      if (!tab?.url) return;
      if (bookmarks.some(item => item.url === tab.url)) bookmarks = bookmarks.filter(item => item.url !== tab.url);
      else bookmarks = [{ title: tab.title, url: tab.url, favicon: tab.favicon, time: Date.now() }, ...bookmarks];
      break;
    case 'remove-bookmark': bookmarks = bookmarks.filter(item => item.url !== value); break;
    case 'clear-history': history = []; notifySearchViews('nova:clear-search-history'); break;
    case 'copy': if (tab?.url) clipboard.writeText(tab.url); break;
    case 'zoom':
      if (contents && [-1, 0, 1].includes(value)) {
        tab.zoomFactor = value === 0 ? undefined : Math.max(.5, Math.min(2, contents.getZoomFactor() + value * .1));
        contents.setZoomFactor(tab.zoomFactor ?? preferences.defaultZoom / 100);
      }
      break;
    case 'find':
      clearFind();
      if (contents && tab?.url && typeof value === 'string' && value) {
        findText = value.slice(0, 500);
        findRequest = { contents, id: contents.findInPage(findText, { findNext: true }) };
      }
      publish(false);
      return;
    case 'find-next':
      if (findRequest?.contents === contents && findText) {
        findRequest = { contents, id: contents.findInPage(findText, { forward: value !== 'previous', findNext: false }) };
      }
      return;
    case 'reveal-download': {
      const item = downloads.find(entry => entry.id === value && entry.status === 'completed');
      if (item?.path) shell.showItemInFolder(item.path);
      return;
    }
    default: return;
  }
  layout();
  publish();
}

async function launch() {
  const privateAddress = await privateStartAddress();
  file = join(app.getPath('userData'), 'browser-session.json');
  let saved = {};
  try { if (!privateMode) saved = JSON.parse(await readFile(file, 'utf8')); } catch {}
  // Existing profiles can replay the tour without interrupting their next launch.
  tourCompleted = privateMode || (typeof saved.tourCompleted === 'boolean' ? saved.tourCompleted : Boolean(saved.tabs));
  preferences = defaultPreferences();
  if (!privateMode) {
    decisions = saved.decisions && typeof saved.decisions === 'object' ? saved.decisions : {};
    adExceptions = new Set(Array.isArray(saved.adExceptions) ? saved.adExceptions : []);
    downloads = (Array.isArray(saved.downloads) ? saved.downloads : []).slice(0, 80)
      .map(entry => ({ ...entry, status: ['progressing', 'paused'].includes(entry.status) ? 'interrupted' : entry.status }));
    vault = passwordVault(join(app.getPath('userData'), 'saved-logins.bin'));
  }
  const stored = saved.preferences ?? {};
  for (const key of ['sidebar', 'toolbar', 'fontSize', 'defaultZoom', 'newTabPage', 'restoreTabs', 'rememberHistory', 'liveSuggestions', 'offerSaveLogins', 'blockAds', 'swipeHistory', 'pinchOverview', 'pinchOpenTab']) {
    if (Object.hasOwn(stored, key)) updatePreference(key, stored[key], false);
  }
  if (typeof stored.downloadFolder === 'string' && isAbsolute(stored.downloadFolder)) preferences.downloadFolder = stored.downloadFolder;
  ({ history = [], bookmarks = [], sidebar = true } = saved);
  pageBlur = saved.pageBlur !== false;
  toolbarBlur = typeof saved.toolbarBlur === 'boolean' ? saved.toolbarBlur : pageBlur;
  if (typeof saved.searchEngine === 'string' && Object.hasOwn(searchEngines, saved.searchEngine)) searchEngine = saved.searchEngine;
  favorites = (saved.favorites ?? []).filter(item => webUrl(item?.url)).slice(0, favoriteLimit);
  tabs = (preferences.restoreTabs ? saved.tabs ?? [] : []).slice(0, 100).map(item => ({
    id: item.id, title: item.title, pinned: item.pinned, url: webUrl(item.url), favicon: webUrl(item.favicon)
  }));

  webSession = session.fromPartition(privateMode ? 'nova-private-web' : 'persist:nova-web', { cache: !privateMode });
  if (process.platform === 'darwin') {
    webSession.registerPreloadScript({ type: 'frame', filePath: join(root, 'desktop/trackpad.cjs') });
    let gesture;
    try {
      const trackpad = createRequire(import.meta.url)('./native/trackpad.node');
      if (app.isPackaged && !privateMode) {
        requestDefaultBrowser = trackpad.requestDefaultBrowser;
        swapAppBundles = trackpad.swapAppBundles;
        checkDefaultBrowser();
      }
      trackpad.start(phase => {
        if (phase === 'pinch-in' || phase === 'pinch-out') {
          if (tour || !window?.isFocused() || (fullscreenPage && fullscreenPage === showing)) return;
          if (phase === 'pinch-in' && preferences.pinchOverview && !tabPreviews) {
            window.webContents.focus();
            window.webContents.send('browser:shortcut', 'tabs');
          } else if (phase === 'pinch-out' && preferences.pinchOpenTab && tabPreviews?.ready) {
            const bounds = window.getContentBounds();
            const cursor = screen.getCursorScreenPoint();
            window.webContents.send('browser:expand-tab-preview', { x: cursor.x - bounds.x, y: cursor.y - bounds.y });
          }
          return;
        }
        if (phase === 'begin') {
          gesture = preferences.swipeHistory && showing && fullscreenPage !== showing && { contents: showing.webContents };
          gesture?.contents.send('nova:trackpad-begin');
          return;
        }
        const finished = gesture;
        gesture = undefined;
        if (finished) window.webContents.send('browser:shortcut', 'swipe-end');
        if (phase === 'release' && preferences.swipeHistory && finished?.distance >= 110 && showing?.webContents === finished.contents) {
          void act(finished.direction);
        }
      });
    } catch (error) {
      console.warn('NOVA native trackpad gestures unavailable:', error.message);
    }
    ipcMain.on('nova:trackpad-distance', (event, direction, distance) => {
      if (!preferences.swipeHistory || !gesture || event.sender !== gesture.contents || event.sender !== showing?.webContents) return;
      if ((direction !== 'back' && direction !== 'forward') || !Number.isFinite(distance)) return;
      gesture.direction = direction;
      gesture.distance = distance;
    });
    ipcMain.on('nova:trackpad-history', (event, direction, phase) => {
      if (!preferences.swipeHistory || !gesture || !showing || event.sender !== gesture.contents || event.sender !== showing.webContents || fullscreenPage === showing) return;
      if (direction !== 'back' && direction !== 'forward') return;
      if (phase === 'preview') window.webContents.send('browser:shortcut', 'swipe-' + direction);
    });
  }
  if (vault) {
    webSession.registerPreloadScript({ type: 'frame', filePath: join(root, 'desktop/login-detection.cjs') });
    loginPrompts = installLoginPrompts({
      session: webSession, getWindow: () => window, isActive: contents => showing?.webContents === contents,
      enabled: () => preferences.offerSaveLogins,
      save: login => changeLogin('password-save', login),
      matches: async login => {
        const saved = loginList.find(item => item.origin === login.origin && item.username === login.username);
        return saved && (await vault.get(saved.id, login.origin))?.password === login.password;
      }
    });
  }
  webSession.registerPreloadScript({ type: 'frame', filePath: join(root, 'desktop/media-probe.cjs') });
  ipcMain.on('media-popup:enter', event => {
    if (mediaPopup && event.sender === mediaPopup.webContents) clearTimeout(mediaCloseTimer);
  });
  ipcMain.on('media-popup:close', event => {
    if (mediaPopup && event.sender === mediaPopup.webContents) scheduleMediaPopupClose();
  });
  ipcMain.on('media-popup:action', (event, action, value) => {
    if (!mediaPopup || event.sender !== mediaPopup.webContents || !['media-toggle', 'media-seek', 'select'].includes(action)) return;
    act(action, value);
    if (action === 'select') closeMediaPopup();
  });
  ipcMain.on('nova:media', (event, media) => {
    if (event.senderFrame !== event.sender.mainFrame) return;
    const tab = tabs.find(item => item.view?.webContents === event.sender);
    if (!tab || tab.homeForward) return;
    tab.media = media && typeof media === 'object' ? {
      title: typeof media.title === 'string' ? media.title.slice(0, 300) : '',
      artist: typeof media.artist === 'string' ? media.artist.slice(0, 200) : '',
      artwork: typeof media.artwork === 'string' ? webUrl(media.artwork) : '',
      playing: media.playing === true,
      currentTime: Number.isFinite(media.currentTime) ? Math.max(0, media.currentTime) : 0,
      duration: Number.isFinite(media.duration) ? Math.max(0, media.duration) : 0
    } : undefined;
    publish(false);
  });
  contentBlocker = createContentBlocker(webSession, join(app.getPath('userData'), 'ad-filter-cache-v2.bin'), status => {
    contentBlocking = status;
    publish(false);
  }, url => {
    try { return adExceptions.has(new URL(url).origin); }
    catch { return false; }
  });
  contentBlocker.setEnabled(preferences.blockAds);
  webSession.setDownloadPath(preferences.downloadFolder);
  installPermissions(webSession, {
    getWindow: () => window,
    isActive: contents => showing?.webContents === contents,
    readDecision: (origin, key) => decisions[origin]?.[key],
    writeDecision: setSitePermissions
  });
  if (Array.isArray(saved.extensions)) {
    for (const path of new Set(saved.extensions)) {
      if (typeof path === 'string' && isAbsolute(path)) await loadExtensionFolder(path);
    }
  }
  webSession.on('will-download', (_event, item) => {
    const filename = basename(item.getFilename()) || 'download';
    item.setSaveDialogOptions({ defaultPath: join(preferences.downloadFolder, filename) });
    const entry = { id: randomUUID(), name: item.getFilename(), status: 'progressing', progress: 0 };
    downloadItems.set(entry.id, item);
    downloads = [entry, ...downloads].slice(0, 80);
    publish();
    item.on('updated', (_event, status) => {
      entry.status = item.isPaused() ? 'paused' : status;
      const total = item.getTotalBytes();
      entry.progress = total ? Math.round(item.getReceivedBytes() / total * 100) : 0;
      publish(false);
    });
    item.once('done', (_event, status) => {
      downloadItems.delete(entry.id);
      Object.assign(entry, { status, path: item.getSavePath(), progress: status === 'completed' ? 100 : entry.progress });
      publish();
    });
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [
      { label: 'New Tab', accelerator: 'CommandOrControl+T', click: () => newTab() },
      { label: 'New Private Window', accelerator: 'CommandOrControl+Shift+N', click: () => void openPrivateWindow() },
      { type: 'separator' },
      { role: 'close' }
    ] },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Take the NOVA Tour', click: () => void openTour() },
        { type: 'separator' },
        { label: 'Search or Enter Address', accelerator: 'CommandOrControl+K', click: openBrowserSearch },
        { label: 'Toggle Sidebar', accelerator: 'CommandOrControl+Shift+S', click: () => act('sidebar') },
        { label: 'Show All Tabs', accelerator: 'CommandOrControl+Shift+\\', click: () => {
          window?.webContents.focus();
          window?.webContents.send('browser:shortcut', 'tabs');
        } }
      ]
    },
    { role: 'windowMenu' }
  ]));
  window = new BrowserWindow({
    title: privateMode ? 'NOVA Private' : 'NOVA Browser', width: 1440, height: 940, minWidth: 760, minHeight: 540, show: tourCompleted,
    ...(process.platform === 'darwin' ? {
      backgroundColor: '#00000000',
      vibrancy: 'under-window',
      visualEffectState: 'followWindow',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 20, y: 18 }
    } : { backgroundColor: '#17191b' }),
    webPreferences: { ...chromePreferences(), preload: join(root, 'desktop/preload.cjs') }
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('before-input-event', shortCommand);
  installEditMenu(window.webContents);
  window.on('resize', () => { layout(); if (mediaExpanded) openMediaPopup(); });
  window.on('move', () => { if (mediaExpanded) openMediaPopup(); });
  window.on('focus', checkDefaultBrowser);
  if (app.isPackaged && process.platform === 'darwin' && !privateMode) {
    updater = createBrowserUpdater({
      swapBundles: swapAppBundles, getWindow: () => window,
      canRestart: () => !privateWindows.size && !downloadItems.size,
      prepareRestart: () => { publish(); return saveQueue; },
      onChange: () => publish(false)
    });
  }
  function updateFullscreenLayout() {
    layout();
    publish(false);
  }
  window.on('enter-full-screen', updateFullscreenLayout);
  window.on('leave-full-screen', updateFullscreenLayout);
  const backdropTimer = setInterval(refreshPageBackdrop, 650);
  const filterTimer = setInterval(() => {
    if (preferences.blockAds) contentBlocker.setEnabled(true);
  }, 2 * 60 * 60 * 1000);
  window.on('closed', () => {
    closeTour(false);
    closeSpotlight(false);
    addressPopup?.webContents.close();
    clearInterval(backdropTimer);
    clearInterval(filterTimer);
    for (const tab of tabs) tab.view?.webContents.close();
    startPage.webContents.close();
  });
  function trusted(event) { return event.sender === window.webContents && event.senderFrame?.url === chromeUrl; }
  function trustedTour(event) { return event.sender === tour?.view.webContents && event.senderFrame?.url === tourUrl; }
  ipcMain.handle('tour:step', (event, step, name) => {
    if (trustedTour(event)) return updateTourStep(step, name);
  });
  ipcMain.handle('tour:targets', event => trustedTour(event) ? tourTargets() : { bounds: [] });
  ipcMain.handle('tour:finish', async event => {
    if (!trustedTour(event)) return;
    closeTour(true);
    await saveQueue;
  });
  ipcMain.handle('browser:read', event => trusted(event) ? state() : null);
  ipcMain.handle('browser:act', (event, action, value) => { if (trusted(event)) return act(action, value); });
  ipcMain.handle('browser:address-suggestions', (event, query) => trusted(event) ? addressSuggestions(query) : []);
  ipcMain.on('browser:address-popup', (event, data) => {
    if (trusted(event)) updateAddressPopup(data);
  });
  ipcMain.on('address-popup:select', (event, index) => {
    if (event.sender !== addressPopup?.webContents || !Number.isInteger(index) || !addressPopupData?.rows[index]) return;
    updateAddressPopup(null);
    window.webContents.focus();
    window.webContents.send('browser:address-selection', index);
  });
  ipcMain.on('spotlight:close', event => {
    if (event.sender === spotlight?.webContents && event.senderFrame?.url === spotlightUrl) closeSpotlight();
  });
  startPage = createStartPage();
  void startPage.webContents.loadURL(startUrl).catch(error => console.error('Could not load the NOVA dashboard:', error));
  if (!pendingExternalLinks.length) {
    if (tabs.length) select(tabs.find(tab => tab.id === saved.activeId)?.id ?? tabs[0].id);
    else newTab(privateAddress);
  }
  await window.loadFile(chromePath);
  createAddressPopup();
  const openedViaLink = pendingExternalLinks.length > 0;
  readyForExternalLinks = true;
  openExternalLinks();
  if (vault) void refreshLogins();
  app.on('window-all-closed', () => app.quit());
  let savedOnQuit = false;
  let preparingToQuit = false;
  app.on('before-quit', event => {
    if (savedOnQuit) return;
    event.preventDefault();
    if (preparingToQuit) return;
    preparingToQuit = true;
    publish();
    void Promise.allSettled([saveQueue, updater?.stop()]).then(() => {
      savedOnQuit = true;
      app.quit();
    });
  });
  if (!tourCompleted && !openedViaLink) {
    await openTour();
    if (!window.isDestroyed()) window.show();
  }
}

app.whenReady().then(launch).catch(error => {
  console.error(error);
  app.exit(1);
});
