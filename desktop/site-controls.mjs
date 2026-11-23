import { dialog } from 'electron';

export const permissionLabels = {
  camera: 'Camera', microphone: 'Microphone', geolocation: 'Location', notifications: 'Notifications'
};

export const siteDataTypes = ['cache', 'cookies', 'fileSystems', 'indexedDB', 'localStorage', 'serviceWorkers', 'webSQL'];

export function secureOrigin(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))) return parsed.origin;
  } catch {}
  return '';
}

function permissionKeys(permission, details) {
  if (permission === 'media') {
    const types = details.mediaTypes ?? [details.mediaType];
    const keys = [...new Set(types.map(type => type === 'video' ? 'camera' : type === 'audio' ? 'microphone' : null))];
    return keys.length && keys.every(Boolean) ? keys : [];
  }
  return permission === 'geolocation' || permission === 'notifications' ? [permission] : [];
}

export function installPermissions(session, { getWindow, isActive, readDecision, writeDecision, onDeviceAccess }) {
  let promptOpen = false;
  function site(contents, url, details = {}) {
    if (!contents || contents.isDestroyed() || !details.isMainFrame) return '';
    const top = secureOrigin(contents.getURL());
    return top && top === secureOrigin(url ?? details.requestingUrl) ? top : '';
  }
  session.setPermissionCheckHandler((contents, permission, origin, details) => {
    if (permission === 'fullscreen') return isActive(contents);
    const requestingSite = site(contents, origin, details);
    const keys = permissionKeys(permission, details);
    return Boolean(requestingSite && keys.length && keys.every(key => readDecision(requestingSite, key) === 'allow'));
  });
  session.setPermissionRequestHandler((contents, permission, respond, details) => {
    if (permission === 'fullscreen') return respond(isActive(contents));
    const origin = site(contents, details.requestingUrl, details);
    const keys = permissionKeys(permission, details);
    if (!origin || !keys.length || !isActive(contents)) return respond(false);
    if (keys.some(key => readDecision(origin, key) === 'block')) return respond(false);
    const undecided = keys.filter(key => readDecision(origin, key) !== 'allow');
    const allow = () => {
      if (keys.includes('camera') || keys.includes('microphone')) onDeviceAccess?.(contents);
      respond(true);
    };
    if (!undecided.length) return allow();
    if (promptOpen) return respond(false);
    promptOpen = true;
    const frame = contents.mainFrame;
    const requested = undecided.map(key => permissionLabels[key]).join(' and ');
    void dialog.showMessageBox(getWindow(), {
      type: 'question', title: 'Site permission',
      message: `Allow ${requested.toLowerCase()} access?`,
      detail: origin + ' is requesting access.',
      buttons: ['Allow once', 'Always allow', 'Always block', 'Cancel'], defaultId: 0, cancelId: 3
    }).then(({ response }) => {
      if (contents.isDestroyed() || !isActive(contents) || contents.mainFrame !== frame || secureOrigin(contents.getURL()) !== origin) return respond(false);
      if (response === 1) writeDecision(origin, undecided, 'allow');
      if (response === 2) writeDecision(origin, undecided, 'block');
      if (response === 0 || response === 1) allow();
      else respond(false);
    }, () => respond(false)).finally(() => { promptOpen = false; });
  });
}
