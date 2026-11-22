import { safeStorage } from 'electron';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export function passwordVault(path) {
  let queue = Promise.resolve();
  async function read() {
    try {
      const data = await readFile(path);
      const { result } = await safeStorage.decryptStringAsync(data);
      return JSON.parse(result);
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }
  function change(update) {
    const operation = queue.then(async () => {
      if (!await safeStorage.isAsyncEncryptionAvailable() ||
          (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) {
        throw new Error('Secure OS password storage is unavailable.');
      }
      const entries = update(await read());
      await writeFile(path + '.tmp', await safeStorage.encryptStringAsync(JSON.stringify(entries)), { mode: 0o600 });
      await rename(path + '.tmp', path);
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return {
    async list() {
      await queue;
      return (await read()).map(({ id, origin, username }) => ({ id, origin, username }));
    },
    save(origin, username, password) {
      return change(entries => {
        const existing = entries.find(item => item.origin === origin && item.username === username);
        const entry = { id: existing?.id ?? randomUUID(), origin, username, password };
        return [entry, ...entries.filter(item => item.id !== entry.id)];
      });
    },
    remove(id) { return change(entries => entries.filter(item => item.id !== id)); },
    async get(id, origin) {
      await queue;
      return (await read()).find(item => item.id === id && item.origin === origin);
    }
  };
}

export async function fillLogin(contents, entry) {
  if (contents.isDestroyed() || new URL(contents.getURL()).origin !== entry.origin || !entry.origin.startsWith('https:')) return false;
  // Fill the visible sign-in form only, without submitting or reading other form values.
  const result = await contents.executeJavaScriptInIsolatedWorld(1002, [{
    code: `(() => {
      const login = ${JSON.stringify(entry)};
      if (location.origin !== login.origin) return false;
      const visible = input => input.getClientRects().length && !input.disabled && !input.readOnly &&
        getComputedStyle(input).visibility === 'visible';
      const passwords = [...document.querySelectorAll('input[type=password]:not([autocomplete=new-password])')].filter(visible);
      const password = passwords.includes(document.activeElement) ? document.activeElement : passwords[0];
      if (!password || passwords.length !== 1 || password.form?.querySelector('input[autocomplete=new-password]')) return false;
      if (password.form && new URL(password.form.action, location.href).origin !== login.origin) return false;
      const area = password.form || document;
      const user = [...area.querySelectorAll('input[autocomplete=username], input[type=email], input[type=text]')].find(visible);
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      for (const [input, value] of [[user, login.username], [password, login.password]]) {
        if (!input) continue;
        setValue.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    })()`
  }]);
  return result === true;
}
