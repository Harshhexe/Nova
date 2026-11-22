import { dialog, ipcMain } from 'electron';

export function installLoginPrompts({ session, getWindow, isActive, enabled, save, matches }) {
  const pending = new Map();
  let prompting = false;

  function cancel(contents) {
    clearTimeout(pending.get(contents)?.timer);
    pending.delete(contents);
  }

  function origin(event) {
    if (!enabled() || event.sender.session !== session || !isActive(event.sender) ||
        !event.senderFrame || event.senderFrame !== event.sender.mainFrame) return '';
    try {
      const url = new URL(event.senderFrame.url);
      return url.protocol === 'https:' ? url.origin : '';
    } catch { return ''; }
  }

  ipcMain.handle('nova:login-enabled', event =>
    enabled() && event.sender.session === session && event.senderFrame === event.sender.mainFrame);

  ipcMain.on('nova:login-submitted', (event, data) => {
    const site = origin(event);
    if (!site || prompting || typeof data?.username !== 'string' || !data.username.trim() ||
        data.username.length > 320 || typeof data.password !== 'string' || !data.password || data.password.length > 4096) return;
    const contents = event.sender;
    cancel(contents);
    pending.set(contents, {
      origin: site, username: data.username.trim(), password: data.password,
      timer: setTimeout(() => cancel(contents), 20000)
    });
  });

  ipcMain.on('nova:login-cleared', async event => {
    const site = origin(event);
    const contents = event.sender;
    const login = pending.get(contents);
    if (!site || !login || prompting || login.origin !== site) return;
    cancel(contents);
    prompting = true;
    try {
      if (await matches(login) || contents.isDestroyed() || !isActive(contents) || !enabled()) return;
      const { response } = await dialog.showMessageBox(getWindow(), {
        type: 'question', title: 'Save login',
        message: 'Save this login?',
        detail: site + '\n' + login.username,
        buttons: ['Save', 'Not now'], defaultId: 0, cancelId: 1
      });
      if (response === 0 && enabled() && !contents.isDestroyed() && isActive(contents) &&
          new URL(contents.getURL()).origin === site) {
        await save({ origin: site, username: login.username, password: login.password });
      }
    } catch {
      // A keychain or window may become unavailable during the prompt.
    } finally {
      prompting = false;
    }
  });

  return {
    cancel,
    cancelAll: () => { for (const contents of pending.keys()) cancel(contents); },
    navigation(contents, url) {
      const login = pending.get(contents);
      if (!login) return;
      try { if (new URL(url).origin === login.origin) return; } catch {}
      cancel(contents);
    }
  };
}
