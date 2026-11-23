import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';

const idPattern = /^[a-f0-9-]{36}$/;
const inlineLimit = 32 * 1024 * 1024;

function safeUrl(value) {
  if (typeof value !== 'string' || value.length > 8192) return '';
  try {
    const url = new URL(value);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {}
  return '';
}

export async function openTrayStore(root) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const items = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !idPattern.test(entry.name)) continue;
    try {
      const item = JSON.parse(await readFile(join(root, entry.name, 'item.json'), 'utf8'));
      if (item.id === entry.name && typeof item.title === 'string' &&
          (item.kind === 'file' || (item.kind === 'link' && safeUrl(item.url)) ||
          (item.kind === 'text' && typeof item.text === 'string'))) items.push(item);
    } catch {}
  }
  items.sort((a, b) => b.created - a.created);

  function filePath(item) {
    return join(root, item.id, 'file', item.title);
  }

  async function add(drop) {
    const payload = drop && typeof drop === 'object' ? drop : {};
    const files = Array.isArray(payload.files) ? payload.files.slice(0, 50) : [];
    const url = safeUrl(payload.url);
    const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, 200_000) : '';
    const inputs = files.length ? files.map(file => ({ kind: 'file', file })) :
      url ? [{ kind: 'link', url, title: typeof payload.title === 'string' && payload.title.trim().slice(0, 240) || url }] :
      text ? [{ kind: 'text', text, title: text.split('\n')[0].slice(0, 120) }] : [];
    let saved = 0;
    for (const input of inputs) {
      const id = randomUUID();
      const dir = join(root, id);
      try {
        const item = { id, created: Date.now(), kind: input.kind, title: input.title };
        await mkdir(dir, { mode: 0o700 });
        if (input.kind === 'file') {
          const { path, name, bytes } = input.file ?? {};
          item.title = basename(typeof name === 'string' ? name : '').replace(/[\x00-\x1f]/g, '').slice(0, 70);
          if (!item.title || ['.', '..'].includes(item.title)) throw new Error('Invalid file name');
          const destination = filePath(item);
          await mkdir(join(dir, 'file'), { mode: 0o700 });
          if (typeof path === 'string' && isAbsolute(path) && (await lstat(path)).isFile()) {
            await copyFile(path, destination, constants.COPYFILE_EXCL);
          } else if (bytes instanceof ArrayBuffer && bytes.byteLength <= inlineLimit) {
            await writeFile(destination, Buffer.from(bytes), { flag: 'wx', mode: 0o600 });
          } else throw new Error('Dropped data is not a file');
          item.size = (await stat(destination)).size;
        } else if (input.kind === 'link') item.url = input.url;
        else item.text = input.text;
        const pending = join(dir, 'item.tmp');
        await writeFile(pending, JSON.stringify(item), { mode: 0o600 });
        await rename(pending, join(dir, 'item.json'));
        items.unshift(item);
        saved++;
      } catch {
        await rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    }
    return { saved, failed: inputs.length - saved || (inputs.length ? 0 : 1) };
  }

  return {
    list: () => items.map(({ text, ...item }) => ({ ...item, preview: text?.slice(0, 240) })),
    add,
    get: id => items.find(item => item.id === id),
    async revealPath(item) {
      if (item.kind !== 'file' || basename(item.title) !== item.title || ['.', '..'].includes(item.title)) return;
      const path = filePath(item);
      if ((await lstat(path)).isFile()) return path;
    },
    async remove(id) {
      const item = items.find(entry => entry.id === id);
      if (!item) return;
      const dir = join(root, item.id);
      const deleted = join(root, '.removed-' + item.id);
      await rename(dir, deleted);
      items.splice(items.indexOf(item), 1);
      await rm(deleted, { recursive: true, force: true }).catch(() => {});
    }
  };
}
