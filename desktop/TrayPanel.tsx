import { useState, type DragEvent, type ReactNode } from 'react';
import { ArrowUpRight, Clipboard, File, Inbox, Link, X } from 'lucide-react';

export type TrayItem = {
  id: string;
  kind: 'file' | 'link' | 'text';
  title: string;
  preview?: string;
  url?: string;
  size?: number;
};

function webAddress(value: string) {
  try {
    const url = new URL(value.trim());
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {}
  return '';
}

async function readDrop(data: DataTransfer) {
  const droppedFiles = Array.from(data.files).slice(0, 50);
  if (droppedFiles.length) {
    const files = [];
    let remainingBytes = 32 * 1024 * 1024;
    for (const file of droppedFiles) {
      const path = window.nova.trayFilePath(file);
      if (path) files.push({ name: file.name, path });
      else if (file.size <= remainingBytes) {
        remainingBytes -= file.size;
        files.push({ name: file.name, bytes: await file.arrayBuffer() });
      } else files.push({ name: file.name });
    }
    return { files };
  }
  const text = data.getData('text/plain');
  const uri = data.getData('text/uri-list').split(/\r?\n/).find(line => webAddress(line));
  const html = data.getData('text/html');
  const fragment = document.createElement('template');
  if (html) fragment.innerHTML = html;
  const media = fragment.content.querySelector('img[src], video[src], video source[src], audio[src], audio source[src]');
  const anchor = fragment.content.querySelector('a[href]');
  const title = media?.getAttribute('alt') || anchor?.textContent || '';
  const mediaSource = media?.getAttribute('src') || '';
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(mediaSource) && mediaSource.length < 32 * 1024 * 1024) {
    const extension = mediaSource.slice(11, mediaSource.indexOf(';')).toLowerCase();
    const bytes = Uint8Array.from(atob(mediaSource.slice(mediaSource.indexOf(',') + 1)), char => char.charCodeAt(0)).buffer;
    return { files: [{ name: 'Dropped image.' + extension, bytes }] };
  }
  const mediaUrl = webAddress(mediaSource);
  const url = mediaUrl || webAddress(uri || '') ||
    webAddress(text) || webAddress(anchor?.getAttribute('href') || '');
  return { url, title, text: text || fragment.content.textContent || '' };
}

type DropProps = {
  onDragOver: (event: DragEvent) => void;
  onDragLeave: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
};

export function useTrayDrop(onDrop: () => void) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('');
  const dropProps: DropProps = {
    onDragOver(event) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
      setDragging(true);
    },
    onDragLeave(event) {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false);
    },
    onDrop(event) {
      event.preventDefault();
      event.stopPropagation();
      setDragging(false);
      onDrop();
      setStatus('Saving…');
      void readDrop(event.dataTransfer).then(payload => window.nova.act('tray-drop', payload)).then(value => {
        const result = value as { saved: number; failed: number } | undefined;
        if (!result?.saved) setStatus('That item couldn’t be saved. Try dragging a file, link, or selected text.');
        else setStatus(result.failed ? `Saved ${result.saved}. Couldn’t save ${result.failed}.` : '');
      }).catch(() => setStatus('Couldn’t save this drop.'));
    }
  };
  return { dragging, status, dropProps };
}

export function TrayPanel({ items, drop, onClose }: {
  items: TrayItem[];
  drop: ReturnType<typeof useTrayDrop>;
  onClose: () => void;
}) {
  const [actionStatus, setActionStatus] = useState('');
  function action(name: string, item: TrayItem) {
    setActionStatus('');
    void window.nova.act(name, item.id).then(() => {
      if (name === 'tray-copy') setActionStatus('Copied.');
      if (name === 'tray-open' && item.kind === 'link') onClose();
    }).catch(() => setActionStatus('Couldn’t access this item.'));
  }
  function button(label: string, icon: ReactNode, click: () => void) {
    return <button type="button" className="icon-button" aria-label={label} title={label} onClick={click}>{icon}</button>;
  }
  return <section className="library" aria-labelledby="tray-heading">
    <header className="library-head">
      <div className="library-symbol"><Inbox /></div>
      <h1 id="tray-heading" className="library-title">Tray</h1>
      {button('Close Tray', <X size={18} />, onClose)}
    </header>
    <div className={'tray-drop-area' + (drop.dragging ? ' drop-ready' : '')} {...drop.dropProps}>
      <Inbox size={21} aria-hidden="true" />
      <p>Drop files, links, or selected text here</p>
    </div>
    {(drop.status || actionStatus) && <p className="empty" role="status">{drop.status || actionStatus}</p>}
    <div className="library-list">
      {items.map(item => <div className="entry" key={item.id}>
        {item.kind === 'file' ? <File size={18} /> : item.kind === 'link' ? <Link size={18} /> : <Clipboard size={18} />}
        <div className="entry-text"><strong title={item.title}>{item.title}</strong>
          <small>{item.kind === 'file' ? `${Math.ceil((item.size ?? 0) / 1024).toLocaleString()} KB` : item.url || item.preview}</small>
        </div>
        {item.kind !== 'text' && button(item.kind === 'file' ? 'Reveal ' + item.title : 'Open ' + item.title, <ArrowUpRight size={16} />, () => action('tray-open', item))}
        {item.kind !== 'file' && button('Copy ' + item.title, <Clipboard size={16} />, () => action('tray-copy', item))}
        {button('Remove ' + item.title, <X size={16} />, () => action('tray-remove', item))}
      </div>)}
    </div>
  </section>;
}
