import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Command } from 'cmdk';
import { ArrowDownToLine, ArrowLeftRight, Check, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, BookOpen, Briefcase, Camera, ChevronDown, CircleAlert, Clock3, Code, Coffee, Columns2, Compass, Cpu, FlaskConical, Folder, Gamepad2, Globe2, GripVertical, Heart, House, Inbox, KeyRound, Layers2, Leaf, Link2, Minus, Moon, Music, Palette, PanelLeft, PanelTop, Pause, Pin, Play, Plus, Puzzle, Rocket, RotateCw, Search, Settings, ShieldCheck, ShieldAlert, Sparkles, Star, StarOff, Terminal, Waves, Wrench, X } from 'lucide-react';
import BlurText from './BlurText';
import { TrayPanel, useTrayDrop, type TrayItem } from './TrayPanel';
import './shell.css';

type Favorite = { url: string; title: string; favicon?: string };
type Link = Favorite & { time: number };
type AddressRow = { title: string; value: string; kind: 'recent' | 'page' | 'google' };
type AddressPopup = { x: number; y: number; width: number; rows: AddressRow[]; selected: number };
type Tab = { sleeping?: boolean; id: string; title: string; url: string; favicon?: string; loading?: boolean; pinned?: boolean; error?: string };
type PageBounds = { x: number; y: number; width: number; height: number };
type TabPreviews = { images: Record<string, string>; source?: PageBounds };
type SavedLogin = { id: string; origin: string; username: string };
type Site = { origin: string; connection: 'http' | 'https' | 'unverified'; permissions: Record<string, string>; canSetPermissions: boolean; adException: boolean };
type BrowserState = {
  spaces: { id: string; name: string; emoji: string; count: number }[];
  spaceId: string;
  split?: { ids: string[]; ratio: number };
  tray: TrayItem[];
  privateMode: boolean;
  defaultBrowser: 'default' | 'available' | 'unavailable';
  update?: { version: string; installing: boolean; progress: number };
  findResult?: { matches: number; active: number };
  savedLogins: SavedLogin[];
  site?: Site;
  tabPreviews?: TabPreviews;
  fullscreen?: boolean;
  activeId?: string; tabs: Tab[]; sidebar: boolean; canBack?: boolean; canForward?: boolean; zoom: number; platform: string;
  pageBlur: boolean; toolbarBlur: boolean; searchEngine: string;
  preferences: {
    sleepTabs: boolean;
    sidebar: string[]; toolbar: string[]; fontSize: number; defaultZoom: number;
    newTabPage: string; restoreTabs: boolean; rememberHistory: boolean; liveSuggestions: boolean; offerSaveLogins: boolean; blockAds: boolean; swipeHistory: boolean; pinchOverview: boolean; pinchOpenTab: boolean; downloadFolder: string;
  };
  media: { id: string; title: string; artist: string; artwork: string; favicon?: string; url: string; tabTitle: string; playing: boolean; currentTime: number; duration: number }[];
  contentBlocking: 'off' | 'basic' | 'full';
  extensions: { path: string; id?: string; name: string; version?: string; error?: string }[];
  history: Link[]; bookmarks: Link[]; favorites: Favorite[]; favoriteLimit: number; downloads: { id: string; name: string; status: string; progress: number; canResume?: boolean; canControl?: boolean }[];
};
type Panel = 'bookmarks' | 'history' | 'downloads' | 'commands' | 'tabs' | 'settings' | 'passwords' | 'extensions' | 'site' | 'tray' | 'spaces';
declare global {
  interface Window {
    nova: {
      read(): Promise<BrowserState>;
      act(action: string, value?: unknown): Promise<unknown>;
      trayFilePath(file: File): string;
      addressSuggestions(query: string): Promise<string[]>;
      addressPopup(data: AddressPopup | null): void;
      addressSelection(callback: (value: string) => void): () => void;
      subscribe(callback: (state: BrowserState) => void): () => void;
      mediaPopupClosed(callback: () => void): () => void;
      expandTabPreview(callback: (point: { x: number; y: number }) => void): () => void;
      pageBackdrop(callback: (backdrop: { top: string; side: string }) => void): () => void;
      shortcut(callback: (shortcut: string) => void): () => void;
    };
  }
}

const initial: BrowserState = { spaces: [], spaceId: "personal", tray: [], privateMode: false, defaultBrowser: 'unavailable', savedLogins: [], tabs: [], sidebar: true, pageBlur: true, toolbarBlur: true, searchEngine: 'google', zoom: 100, platform: '', history: [], bookmarks: [], favorites: [], favoriteLimit: 0, downloads: [],
  media: [], contentBlocking: 'off',
  extensions: [],
  preferences: { sleepTabs: true, sidebar: ['bookmarks', 'history', 'downloads'], toolbar: ['back', 'forward', 'reload', 'bookmark', 'copy', 'new-tab', 'tabs'], fontSize: 16, defaultZoom: 100, newTabPage: 'dashboard', restoreTabs: true, rememberHistory: true, liveSuggestions: true, offerSaveLogins: true, blockAds: true, swipeHistory: true, pinchOverview: true, pinchOpenTab: true, downloadFolder: '' }
};
const tabDragType = 'application/x-nova-tab';
const favoriteDragType = 'application/x-nova-favorite';
const run = (action: string, value?: unknown) => void window.nova.act(action, value);
function host(url: string) { return url ? new URL(url).hostname : ''; }

function recentAddressRows(history: Link[], query: string): AddressRow[] {
  const seen = new Set<string>();
  const rows: AddressRow[] = [];
  for (const item of history) {
    let url;
    try { url = new URL(item.url); } catch { continue; }
    const engine = ['google.com', 'www.google.com', 'www.bing.com', 'bing.com'].includes(url.hostname)
      ? url.pathname === '/search'
      : ['duckduckgo.com', 'www.duckduckgo.com'].includes(url.hostname) && url.pathname === '/';
    const search = engine ? url.searchParams.get('q') : null;
    const title = search || item.title || url.hostname;
    const key = search ? 'search:' + search.toLowerCase() : item.url;
    if (seen.has(key) || !(title + ' ' + item.url).toLowerCase().includes(query.toLowerCase())) continue;
    seen.add(key);
    rows.push({ title, value: item.url, kind: search ? 'recent' : 'page' });
    if (rows.length >= 6) break;
  }
  return rows;
}

function WebsiteIcon({ url, favicon, pinned }: { url: string; favicon?: string; pinned?: boolean }) {
  const [failedSource, setFailedSource] = useState('');
  if (!url) return <House size={16} />;
  const source = favicon || new URL('/favicon.ico', url).href;
  if (source === failedSource) return pinned ? <Pin size={15} /> : <Globe2 size={16} />;
  return <img className="website-icon" src={source} alt="" referrerPolicy="no-referrer" onError={() => setFailedSource(source)} />;
}

function IconButton({ label, children, onClick, disabled, pressed }: {
  label: string; children: ReactNode; onClick: () => void; disabled?: boolean; pressed?: boolean;
}) {
  return <button type="button" className="icon-button" title={label} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>{children}</button>;
}

// Regions leave open space between previews and give the active tab room to lead.
const spatialLayouts = [
  [[12, 8, 76, 82]],
  [[4, 8, 52, 77], [60, 28, 36, 61]],
  [[4, 19, 51, 70], [61, 2, 32, 44], [64, 50, 32, 45]],
  [[4, 12, 48, 48], [58, 4, 36, 43], [14, 62, 36, 35], [55, 50, 41, 47]],
  [[4, 27, 46, 65], [53, 3, 25, 43], [77, 8, 22, 42], [55, 51, 20, 45], [77, 52, 22, 46]],
  [[4, 9, 38, 49], [45, 2, 27, 46], [75, 12, 23, 43], [8, 61, 29, 36], [40, 52, 29, 45], [72, 58, 26, 38]]
];

const overviewEasing = 'cubic-bezier(.22, 1, .36, 1)';

function previewTransform(preview: HTMLElement, bounds: PageBounds) {
  const rect = preview.getBoundingClientRect();
  return `translate(${bounds.x - rect.left}px, ${bounds.y - rect.top}px) scale(${bounds.width / rect.width}, ${bounds.height / rect.height})`;
}

const spaceIconOptions = [
  { id: 'house', label: 'Home', icon: House },
  { id: 'sparkles', label: 'Sparkles', icon: Sparkles },
  { id: 'briefcase', label: 'Work', icon: Briefcase },
  { id: 'palette', label: 'Creative', icon: Palette },
  { id: 'book-open', label: 'Reading', icon: BookOpen },
  { id: 'flask', label: 'Research', icon: FlaskConical },
  { id: 'gamepad', label: 'Play', icon: Gamepad2 },
  { id: 'music', label: 'Audio', icon: Music },
  { id: 'wrench', label: 'Tools', icon: Wrench },
  { id: 'rocket', label: 'Launch', icon: Rocket },
  { id: 'leaf', label: 'Nature', icon: Leaf },
  { id: 'coffee', label: 'Daily', icon: Coffee },
  { id: 'camera', label: 'Photos', icon: Camera },
  { id: 'moon', label: 'Focus', icon: Moon },
  { id: 'waves', label: 'Flow', icon: Waves },
  { id: 'compass', label: 'Explore', icon: Compass },
  { id: 'code', label: 'Code', icon: Code },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'globe', label: 'Web', icon: Globe2 },
  { id: 'heart', label: 'Personal', icon: Heart },
  { id: 'star', label: 'Favorites', icon: Star },
  { id: 'folder', label: 'Folder', icon: Folder },
  { id: 'layers', label: 'Spaces', icon: Layers2 },
  { id: 'cpu', label: 'Tech', icon: Cpu },
] as const;

const legacyEmojiToIconKey: Record<string, string> = {
  '🏠': 'house', '✨': 'sparkles', '💼': 'briefcase', '🎨': 'palette',
  '📚': 'book-open', '🧪': 'flask', '🎮': 'gamepad', '🎵': 'music',
  '🛠️': 'wrench', '🛠': 'wrench', '🚀': 'rocket', '🌿': 'leaf',
  '☕': 'coffee', '📷': 'camera', '🌙': 'moon', '🌊': 'waves', '🧭': 'compass'
};

const iconLookup: Record<string, typeof House> = {};
for (const item of spaceIconOptions) {
  iconLookup[item.id] = item.icon;
}

function resolveSpaceIcon(value?: string) {
  if (!value) return House;
  const key = legacyEmojiToIconKey[value] || value.toLowerCase();
  return iconLookup[key] || House;
}

function SpaceIcon({ name, size = 18, className = '' }: { name?: string; size?: number; className?: string }) {
  const IconComponent = resolveSpaceIcon(name);
  return <IconComponent size={size} strokeWidth={1.8} className={`space-outline-icon ${className}`} />;
}

function SpaceIconPicker({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentKey = legacyEmojiToIconKey[value] || value.toLowerCase();
  const currentOption = spaceIconOptions.find(opt => opt.id === currentKey) || spaceIconOptions[0];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="space-icon-picker-box" ref={containerRef}>
      <button
        type="button"
        className={`space-icon-box-trigger ${open ? 'active' : ''}`}
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="space-icon-box-preview">
          <SpaceIcon name={value} size={18} />
        </span>
        <ChevronDown size={13} className={`space-icon-chevron ${open ? 'rotated' : ''}`} />
      </button>

      {open && (
        <div className="space-icon-dropdown-box" role="dialog" aria-label={label}>
          <div className="space-icon-dropdown-header">
            <span>CHOOSE ICON</span>
            <small>{currentOption.label}</small>
          </div>
          <div className="space-icon-grid-box">
            {spaceIconOptions.map(option => {
              const isSelected = currentKey === option.id;
              const OptionIcon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`space-icon-tile-btn ${isSelected ? 'selected' : ''}`}
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <OptionIcon size={18} strokeWidth={1.8} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SplitDivider({ split, sidebar }: { split: NonNullable<BrowserState['split']>; sidebar: boolean }) {
  const inset = sidebar ? 60 : 5;
  return <div className="split-divider" style={{ left: `calc(${split.ratio * 100}vw + ${inset - split.ratio * (inset + 17)}px)` }}>
    <button className="split-grip" role="separator" aria-label="Resize split" aria-orientation="vertical" aria-valuenow={Math.round(split.ratio*100)} aria-valuemin={25} aria-valuemax={75}
      onPointerDown={e => e.currentTarget.setPointerCapture(e.pointerId)}
      onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) run('split-size', (e.clientX-inset-6)/(innerWidth-inset-17)); }}
      onKeyDown={e => { if (['ArrowLeft','ArrowRight'].includes(e.key)) { e.preventDefault(); run('split-size',split.ratio+(e.key==='ArrowLeft'?-.05:.05)); } }}/>
  </div>;
}

function TabOverview({ tabs, activeId, previews, onSelect, onSplit, onDismiss, splitFrom }: {
  tabs: Tab[]; activeId?: string; splitFrom?: string; previews: TabPreviews; onSplit: (ids: string[]) => void; onSelect: (id: string) => void; onDismiss: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [dragOver, setDragOver] = useState('');
  const activePreview = useRef<HTMLSpanElement>(null);
  const closing = useRef(false);
  const source = previews.source;
  const start = useRef({ source, image: activeId && previews.images[activeId] });
  const ordered = [...tabs.filter(tab => tab.id === activeId), ...tabs.filter(tab => tab.id !== activeId)];
  const compact = ordered.length > spatialLayouts.length;
  const columns = Math.ceil(Math.sqrt(ordered.length));
  const rows = Math.ceil(ordered.length / columns);

  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    const preview = activePreview.current;
    const { source: bounds, image } = start.current;
    if (preview && image && bounds && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      preview.animate([
        { transform: previewTransform(preview, bounds), borderRadius: '0px' },
        { transform: 'none' }
      ], { duration: 450, easing: overviewEasing });
    }
    return () => node.close();
  }, []);

  useEffect(() => window.nova.expandTabPreview(({ x, y }) => {
    const tab = document.elementFromPoint(x, y)?.closest<HTMLButtonElement>('.spatial-tab');
    if (tab && dialog.current?.contains(tab)) tab.click();
  }), []);

  async function finish(preview?: HTMLElement, id?: string) {
    if (closing.current) return;
    closing.current = true;
    const complete = () => id ? onSelect(id) : onDismiss();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return complete();
    const node = dialog.current;
    if (!node) return complete();
    node.classList.add('leaving');
    if (preview && source) {
      preview.closest('.spatial-slot')?.classList.add('expanding');
      await preview.animate([
        { transform: 'none' },
        { transform: previewTransform(preview, source), borderRadius: '0px' }
      ], { duration: 260, easing: overviewEasing, fill: 'forwards' }).finished.catch(() => {});
    } else {
      await node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' }).finished.catch(() => {});
    }
    complete();
  }

  return <dialog ref={dialog} className="spatial-overview" aria-label="Open tabs"
    style={{ '--preview-ratio': source?.width && source.height ? source.width / source.height : 1.6 } as CSSProperties}
    onCancel={event => { event.preventDefault(); void finish(activePreview.current ?? undefined); }}>
    {tabs.filter(tab => tab.url && !tab.error).length >= 2 && <span className="split-hint"><Columns2 size={14}/> {splitFrom ? 'Choose a second page for Split View' : 'Drag a page onto another to split'}</span>}
    <button className="spatial-dismiss" type="button" aria-label="Close tab overview" autoFocus
      onClick={() => void finish(activePreview.current ?? undefined)}><X size={18} /></button>
    <div className="spatial-scroll" onClick={event => {
      if (!(event.target as HTMLElement).closest('.spatial-tab')) void finish(activePreview.current ?? undefined);
    }}>
      <div className={'spatial-stage' + (compact ? ' compact' : '')}>
          {ordered.map((tab, index) => {
            const row = Math.floor(index / columns);
            const rowLength = Math.min(columns, ordered.length - row * columns);
            const cellWidth = 94 / columns;
            const cellHeight = 90 / rows;
            const [left, top, width, height] = compact
              ? [3 + (index % columns + (columns - rowLength) / 2) * cellWidth, 6 + row * cellHeight, cellWidth - 1, cellHeight - 1]
              : spatialLayouts[ordered.length - 1][index];
            const current = tab.id === activeId;
            const snapshot = previews.images[tab.id];
            return <div key={tab.id} className={'spatial-slot' + (current ? ' current' : '')}
              style={{ left: left + '%', top: top + '%', width: width + '%', height: height + '%', '--arrival': `${Math.min(index, 6) * 22}ms` } as CSSProperties}>
              <button className={'spatial-tab' + (dragOver === tab.id ? ' split-target' : '')} type="button"
                draggable={Boolean(tab.url && !tab.error)}
                onDragStart={event => { event.dataTransfer.setData('application/x-nova-split', tab.id); event.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={event => {
                  if (!tab.url || tab.error || !event.dataTransfer.types.includes('application/x-nova-split')) return;
                  event.preventDefault(); setDragOver(tab.id);
                }}
                onDragLeave={() => setDragOver('')} onDragEnd={() => setDragOver('')}
                onDrop={event => {
                  event.preventDefault(); setDragOver('');
                  const from = event.dataTransfer.getData('application/x-nova-split');
                  if (from && from !== tab.id) onSplit([from, tab.id]);
                }} title={tab.title} aria-current={current ? 'page' : undefined}
                disabled={Boolean(splitFrom && (tab.id === splitFrom || !tab.url || tab.error))}
                onClick={event => {
                  if (splitFrom) onSplit([splitFrom, tab.id]);
                  else void finish(event.currentTarget.querySelector<HTMLElement>('.spatial-preview') ?? undefined, tab.id);
                }}>
                <span ref={current ? activePreview : undefined} className="spatial-preview">
                  {snapshot ? <img draggable={false} src={snapshot} alt="" /> : <WebsiteIcon url={tab.url} favicon={tab.favicon} />}
                </span>
                <span className="spatial-title"><WebsiteIcon url={tab.url} favicon={tab.favicon} /><span>{tab.title || 'New tab'}</span></span>
              </button>
            </div>;
          })}
      </div>
    </div>
  </dialog>;
}

const settingsSections = [
  { id: 'toolbar', label: 'Top Bar Settings', icon: PanelTop },
  { id: 'sidebar', label: 'Customize Sidebar', icon: PanelLeft },
  { id: 'browser', label: 'Browser Settings', icon: Compass }
] as const;

const navigation = [
  { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
  { id: 'history', label: 'History', icon: Clock3 },
  { id: 'downloads', label: 'Downloads', icon: ArrowDownToLine },
  { id: 'passwords', label: 'Passwords', icon: KeyRound },
  { id: 'tray', label: 'Tray', icon: Inbox },
  { id: 'spaces', label: 'Spaces', icon: Layers2 },
  { id: 'split', label: 'Split View', icon: Columns2 }
] as const;

const toolbarOptions = [
  { id: 'back', label: 'Back', icon: ArrowLeft },
  { id: 'forward', label: 'Forward', icon: ArrowRight },
  { id: 'reload', label: 'Reload', icon: RotateCw },
  { id: 'bookmark', label: 'Bookmark page', icon: Bookmark },
  { id: 'copy', label: 'Copy link', icon: Link2 },
  { id: 'new-tab', label: 'New tab', icon: Plus },
  { id: 'tabs', label: 'Tab overview', icon: Layers2 },
  ...navigation
];

function DefaultBrowser({ status }: { status: BrowserState['defaultBrowser'] }) {
  const [request, setRequest] = useState<'idle' | 'pending' | 'unconfirmed'>('idle');
  async function makeDefault() {
    setRequest('pending');
    const changed = await window.nova.act('make-default-browser').catch(() => false);
    setRequest(changed ? 'idle' : 'unconfirmed');
  }

  return <div className="settings-card setting-row default-browser">
    <Globe2 size={18} aria-hidden="true" />
    <span role="status">
      <strong>Default browser</strong>
      <small>{status === 'default' ? 'NOVA opens web links from other apps.'
        : status === 'unavailable' ? 'Use the installed NOVA app to set it as your default.'
        : request === 'unconfirmed' ? 'You can also choose NOVA in System Settings → Desktop & Dock.'
        : 'Open links from other apps in NOVA.'}</small>
    </span>
    {status === 'available' && <button type="button" className="text-button" disabled={request === 'pending'} onClick={() => void makeDefault()}>
      {request === 'pending' ? 'Waiting for macOS…' : 'Make default'}
    </button>}
  </div>;
}

function IconPreferences({ area, selected }: { area: 'sidebar' | 'toolbar'; selected: string[] }) {
  const [dragging, setDragging] = useState<string>();
  const [destination, setDestination] = useState<string>();
  const options = area === 'sidebar' ? navigation : toolbarOptions;

  function move(id: string, visible: boolean, before?: string) {
    if (!options.some(item => item.id === id) || id === before) return;
    const next = selected.filter(item => item !== id);
    if (visible) {
      const index = before ? next.indexOf(before) : -1;
      next.splice(index < 0 ? next.length : index, 0, id);
    }
    run('preference', { key: area, value: next });
  }

  function complete(event: DragEvent, visible: boolean, before?: string) {
    if (!dragging) return;
    event.preventDefault();
    event.stopPropagation();
    move(dragging, visible, before);
    setDragging(undefined);
    setDestination(undefined);
  }

  return <div className="settings-icon-picker">
    <p>Drag icons between trays. Drop before a shown icon to reorder it.</p>
    {[true, false].map(visible => {
      const title = visible ? 'Shown' : 'Hidden';
      const ids = visible ? selected : options.filter(item => !selected.includes(item.id)).map(item => item.id);
      return <div key={title} className={'icon-tray' + (destination === title ? ' drop-ready' : '')} role="group" aria-label={title + ' icons'}
        onDragOver={event => {
          if (!dragging) return;
          event.preventDefault();
          setDestination(title);
        }} onDrop={event => complete(event, visible)}>
        <strong>{title}</strong>
        <div className="icon-tray-items">
          {ids.map(id => {
            const item = options.find(option => option.id === id);
            if (!item) return null;
            const Icon = item.icon;
            return <button type="button" key={id} className={'icon-chip' + (destination === id && dragging !== id ? ' drop-before' : '')}
              title={(visible ? 'Hide ' : 'Show ') + item.label} onClick={() => move(id, !visible)}
              draggable onDragStart={event => {
                event.dataTransfer.setData('application/x-nova-settings-icon', id);
                event.dataTransfer.effectAllowed = 'move';
                setDragging(id);
              }}
              onDragEnd={() => { setDragging(undefined); setDestination(undefined); }}
              onDragOver={event => {
                if (!visible || !dragging || dragging === id) return;
                event.preventDefault();
                event.stopPropagation();
                setDestination(id);
              }}
              onDrop={event => complete(event, visible, visible ? id : undefined)}>
              <GripVertical size={12} aria-hidden="true" /><Icon size={15} aria-hidden="true" />{item.label}
            </button>;
          })}
          {ids.length === 0 && <span className="icon-tray-empty">Drop icons here</span>}
        </div>
      </div>;
    })}
  </div>;
}

function PasswordTools({ logins, privateMode, offerSaveLogins }: { logins: SavedLogin[]; privateMode: boolean; offerSaveLogins: boolean }) {
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  return <div className="settings-card settings-detail">
    {!privateMode && <>
      <h2 className="settings-group-title">Saved logins</h2>
      <label className="setting-row">
        <span><strong>Offer to save passwords</strong><small>Ask after a recognized sign-in.</small></span>
        <input type="checkbox" role="switch" checked={offerSaveLogins}
          onChange={event => run('preference', { key: 'offerSaveLogins', value: event.target.checked })} />
      </label>
      <form className="password-form" onSubmit={event => {
        event.preventDefault();
        const form = event.currentTarget;
        const fields = new FormData(form);
        setSaving(true);
        void window.nova.act('password-save', {
          origin: fields.get('website'), username: fields.get('username'), password: fields.get('password')
        }).then(saved => { if (saved) form.reset(); }).finally(() => setSaving(false));
      }}>
        <label>Website<input name="website" type="url" placeholder="https://example.com" required /></label>
        <label>Username<input name="username" autoComplete="off" maxLength={320} /></label>
        <label>Password<input name="password" type="password" autoComplete="new-password" maxLength={4096} required /></label>
        <button className="text-button" type="submit" disabled={saving}>Save login</button>
      </form>
      <p className="password-help">Logins are stored with your device’s encryption. To fill one, right-click a sign-in field and choose Fill Saved Login.</p>
      {logins.map(login => <div className="setting-row" key={login.id}>
        <span><strong>{login.username || 'Saved login'}</strong><small>{login.origin}</small></span>
        <button className="text-button" type="button" onClick={() => run('password-remove', login.id)}>Remove</button>
      </div>)}
      <h2 className="settings-group-title">Password tools</h2>
    </>}
    {privateMode && <p className="password-help">Saved logins are unavailable in private windows.</p>}
    <div className="setting-row">
      <span><strong>Password generator</strong><small>Generate a random password locally.</small></span>
      <button className="text-button" type="button" onClick={() => {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        const random = crypto.getRandomValues(new Uint8Array(24));
        setPassword(Array.from(random, byte => alphabet[byte % alphabet.length]).join(''));
        setCopied(false);
      }}>Generate</button>
    </div>
    {password && <div className="setting-row">
      <input className="generated-password" aria-label="Generated password" value={password} readOnly />
      <button className="text-button" type="button" onClick={() => {
        run('copy-generated-password', password);
        setCopied(true);
      }}>{copied ? 'Copied' : 'Copy'}</button>
    </div>}
  </div>;
}

function Browser() {
  const [state, setState] = useState(initial);
  const [swipe, setSwipe] = useState<{ direction: 'back' | 'forward' }>();
  const [mediaOpen, setMediaOpen] = useState(false);
  const [pageBackdrop, setPageBackdrop] = useState({ top: '', side: '' });
  const [spaceName, setSpaceName] = useState('');
  const [emoji, setEmoji] = useState('sparkles');
  const [chooseSplit, setChooseSplit] = useState(false);
  const currentSpace = state.spaces.find(item => item.id === state.spaceId);
  const [panel, setPanel] = useState<Panel>();
  const trayDrop = useTrayDrop(() => { stopFavoriteDrag(); show('tray'); });
  const [settingsSection, setSettingsSection] = useState<typeof settingsSections[number]['id']>();
  const selectedSettings = settingsSections.find(section => section.id === settingsSection);
  const [address, setAddress] = useState('');
  const [filter, setFilter] = useState('');
  const [finding, setFinding] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [showFavoriteSlots, setShowFavoriteSlots] = useState(false);
  const [favoriteDropIndex, setFavoriteDropIndex] = useState<number>();
  const [chromeHovered, setChromeHovered] = useState(false);
  const [chromeFocused, setChromeFocused] = useState(false);
  const [focusAddress, setFocusAddress] = useState(false);
  const [addressPopupOpen, setAddressPopupOpen] = useState(false);
  const [addressEdited, setAddressEdited] = useState(false);
  const [addressIndex, setAddressIndex] = useState(-1);
  const [liveAddressRows, setLiveAddressRows] = useState<{ query: string; items: string[] }>();
  const addressBlurTimer = useRef<number | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const editingAddress = chromeHovered || chromeFocused || focusAddress || finding;
  const tab = state.tabs.find(item => item.id === state.activeId);
  const saved = !!tab?.url && state.bookmarks.some(item => item.url === tab.url);
  const addressQuery = addressEdited ? address.trim() : '';
  const localAddressRows = addressPopupOpen && state.preferences.rememberHistory ? recentAddressRows(state.history, addressQuery) : [];
  const googleAddressRows: AddressRow[] = state.preferences.liveSuggestions && liveAddressRows && liveAddressRows.query === addressQuery
    ? liveAddressRows.items.filter(item => item.toLowerCase() !== addressQuery.toLowerCase() &&
        !localAddressRows.some(row => row.kind === 'recent' && row.title.toLowerCase() === item.toLowerCase()))
      .slice(0, 5).map(title => ({ title, value: title, kind: 'google' }))
    : [];
  const addressRows = [...localAddressRows, ...googleAddressRows].slice(0, 8);
  if (!addressRows.length && addressQuery) {
    addressRows.push({ title: addressQuery, value: addressQuery, kind: 'google' });
  }

  useEffect(() => {
    if (!addressPopupOpen || finding || !state.preferences.liveSuggestions || addressQuery.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void window.nova.addressSuggestions(addressQuery).then(items => {
        if (!cancelled) setLiveAddressRows({ query: addressQuery, items });
      }).catch(() => {});
    }, 140);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [addressPopupOpen, addressQuery, finding, state.preferences.liveSuggestions]);

  useEffect(() => {
    function update() {
      const bounds = input.current?.closest('form')?.getBoundingClientRect();
      window.nova.addressPopup(addressPopupOpen && !finding && bounds && addressRows.length
        ? { x: bounds.left, y: bounds.bottom + 6, width: bounds.width, rows: addressRows, selected: addressIndex }
        : null);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [addressPopupOpen, addressRows, addressIndex, finding, state.sidebar, state.fullscreen]);

  useEffect(() => window.nova.addressSelection(navigate), [navigate]);

  useEffect(() => () => window.clearTimeout(addressBlurTimer.current), []);
  useEffect(() => {
    if (!state.sidebar || state.media.length === 0 || panel) setMediaOpen(false);
  }, [state.sidebar, state.media.length, panel]);

  const media = state.media.find(item => item.playing) ?? state.media[0];
  const hotkey = state.platform === 'darwin' ? '⌘' : 'Ctrl+';

  function stopFavoriteDrag() {
    setShowFavoriteSlots(false);
    setFavoriteDropIndex(undefined);
  }

  function hoverFavorite(event: DragEvent, index: number) {
    const types = event.dataTransfer.types;
    const moving = types.includes(favoriteDragType);
    if (!moving && (state.favorites.length >= state.favoriteLimit || !types.some(type => type === tabDragType || type === 'text/uri-list'))) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = moving ? 'move' : 'copy';
    setFavoriteDropIndex(index);
  }

  function dropFavorite(event: DragEvent, index: number) {
    event.preventDefault();
    stopFavoriteDrag();
    const tabId = event.dataTransfer.getData(tabDragType);
    const url = event.dataTransfer.getData(favoriteDragType) ||
      event.dataTransfer.getData('text/uri-list').split(/\r?\n/).find(line => line.trim() && !line.startsWith('#'));
    run('save-favorite', { index, tabId, url });
  }

  function show(next?: Panel, splitPicker = false) {
    setChooseSplit(splitPicker);
    setAddressPopupOpen(false);
    window.nova.addressPopup(null);
    setMediaOpen(false);
    run('media-expand', false);
    setFilter('');
    setConfirmation(false);
    setPanel(next);
    if (next === 'settings') setSettingsSection(undefined);
    run('panel', next === 'tabs' ? next : !!next);
  }
  function navigationButton(id: string, size: number) {
    const control = navigation.find(item => item.id === id);
    if (!control || (id === 'tray' && state.privateMode)) return null;
    if (control.id === 'split') return <IconButton key={id} label={state.split ? 'Exit Split View' : 'Split View'}
      pressed={Boolean(state.split)} disabled={!state.split && (!tab?.url || Boolean(tab.error) || !state.tabs.some(item => item.id !== state.activeId && item.url && !item.error))}
      onClick={() => state.split ? run('split-end') : show('tabs', true)}><Columns2 size={size}/></IconButton>;
    const label = control.id === 'spaces' ? 'Spaces · ' + (currentSpace?.name ?? 'Personal') : control.label;
    if (control.id === 'tray') return <button key={id} type="button" aria-label={label} title={label} aria-pressed={panel === 'tray'}
      className={'icon-button tray-sidebar' + (trayDrop.dragging ? ' drop-ready' : '')}
      {...trayDrop.dropProps} onClick={() => show(panel === 'tray' ? undefined : 'tray')}><Inbox size={size}/></button>;
    return <IconButton key={id} label={label} pressed={panel === control.id} onClick={() => show(panel === control.id ? undefined : control.id)}>
      {control.id === 'spaces' ? <SpaceIcon name={currentSpace?.emoji} size={size}/> : <control.icon size={size}/>}
    </IconButton>;
  }

  function navigate(url: string) {
    if (!url.trim()) return;
    show();
    setFinding(false);
    run('go', url);
    input.current?.blur();
  }
  function select(id: string) {
    show();
    setFinding(false);
    run('select', id);
  }

  useEffect(() => {
    const unsubscribe = window.nova.subscribe(setState);
    const stopMediaPopup = window.nova.mediaPopupClosed(() => setMediaOpen(false));
    const stopBackdrop = window.nova.pageBackdrop(setPageBackdrop);
    void window.nova.read().then(setState);
    const stop = window.nova.shortcut(shortcut => {
      if (shortcut === 'swipe-end') setSwipe(undefined);
      else if (shortcut === 'swipe-back' || shortcut === 'swipe-forward') {
        setSwipe({ direction: shortcut === 'swipe-back' ? 'back' : 'forward' });
      } else if (shortcut === 'tabs') show('tabs');
      else if (shortcut === 'dismiss-panel') show();
      else if (shortcut === 'commands') show('commands');
      else if (shortcut === 'address' || shortcut === 'find') {
        show();
        setFinding(shortcut === 'find');
        setFocusAddress(true);
      } else {
        if (['new', 'close', 'reopen'].includes(shortcut)) {
          show();
          setFinding(false);
        }
        run(shortcut);
      }
    });
    return () => { unsubscribe(); stopMediaPopup(); stopBackdrop(); stop(); };
  }, []);

  useEffect(() => {
    if (!focusAddress) return;
    input.current?.focus();
    input.current?.select();
    setFocusAddress(false);
  }, [focusAddress]);

  useEffect(() => {
    setAddress(tab?.url ?? '');
  }, [tab?.url, tab?.id]);

  useEffect(() => {
    if (finding) { setAddress(''); input.current?.focus(); }
    else run('find', '');
  }, [finding]);

  const orderedTabs = [...state.tabs.filter(item => item.pinned), ...state.tabs.filter(item => !item.pinned)];
  const libraryEntries = panel === 'history' ? state.history : state.bookmarks;
  const prefs = state.preferences;
  const toolbarHas = (id: string) => prefs.toolbar.includes(id);
  const matches = libraryEntries.filter(item => (item.title + item.url).toLowerCase().includes(filter.toLowerCase()));
  const paletteOpen = panel === 'commands';
  const backdropStyle = {
    '--toolbar-backdrop': pageBackdrop.top ? `url("${pageBackdrop.top}")` : undefined,
    '--sidebar-backdrop': pageBackdrop.side ? `url("${pageBackdrop.side}")` : undefined
  } as CSSProperties;

  return <div className={'browser ' + (state.sidebar ? 'with-sidebar ' : '') + (state.platform === 'darwin' && !state.fullscreen ? 'mac' : '')} style={backdropStyle}>
    <header className="chrome">
      <div className="toolbar-glass" aria-hidden="true" />
      {swipe && (swipe.direction === 'back' ? state.canBack : state.canForward) && <div className={`swipe-indicator ${swipe.direction}`} role="status">
        {swipe.direction === 'back' ? <><ArrowLeft size={22} /> Back</> : <>Forward <ArrowRight size={22} /></>}
      </div>}
      {!state.sidebar && <div className="sidebar-toggle">
        <IconButton label="Show sidebar" onClick={() => run('sidebar', true)}><PanelLeft size={16} /></IconButton>
      </div>}
      <div className="toolbar-content" style={{ '--toolbar-actions-width': `${prefs.toolbar.filter(id => !['back', 'forward', 'reload'].includes(id)).length * 29 + 10 + (state.split ? 58 : 0)}px` } as CSSProperties}>
        <div className="toolbar-group history-controls" role="group" aria-label="Page navigation">
          {prefs.toolbar.filter(id => id === 'back' || id === 'forward').map(id => id === 'back'
            ? <IconButton key={id} label="Back" disabled={!state.canBack} onClick={() => run('back')}><ArrowLeft size={16} /></IconButton>
            : <IconButton key={id} label="Forward" disabled={!state.canForward} onClick={() => run('forward')}><ArrowRight size={16} /></IconButton>)}
        </div>
        <form className={'address-pill' + (editingAddress ? ' editing' : '') + (finding ? ' finding' : '')}
          onPointerEnter={() => setChromeHovered(true)}
          onPointerLeave={() => setChromeHovered(false)}
          onSubmit={event => {
            event.preventDefault();
            if (finding) run('find-next');
            else navigate(addressRows[addressIndex]?.value ?? address);
          }}>
          {state.site && !finding ? <span className="address-leading site-indicator">
            <IconButton label={'Site controls for ' + state.site.origin} pressed={panel === 'site'}
              onClick={() => show(panel === 'site' ? undefined : 'site')}>
              {state.site.connection === 'https' ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
            </IconButton>
          </span> : <span className="address-leading" aria-hidden="true"><Search size={14} /></span>}
          <input ref={input} aria-label={finding ? 'Find in page' : 'Address and search'}
            autoComplete="off" spellCheck={false}
            placeholder={finding ? 'Find in page' : 'Search or enter a URL'}
            value={editingAddress ? address : (state.privateMode ? 'Private · ' : '') + (tab?.title || 'New tab')}
            title={editingAddress ? undefined : tab?.title}
            onFocus={() => {
              window.clearTimeout(addressBlurTimer.current);
              setChromeFocused(true);
              setFocusAddress(true);
              setAddressEdited(false);
              setAddressIndex(-1);
              setAddressPopupOpen(true);
            }}
            onBlur={() => {
              setChromeFocused(false);
              addressBlurTimer.current = window.setTimeout(() => {
                setAddressPopupOpen(false);
                if (!finding) setAddress(tab?.url ?? '');
              }, 180);
            }}
            onChange={event => {
              setAddress(event.target.value);
              if (finding) run('find', event.target.value);
              else {
                setAddressEdited(true);
                setAddressIndex(-1);
                setAddressPopupOpen(true);
              }
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (finding) run('find-next', event.shiftKey ? 'previous' : 'next');
                else navigate(addressRows[addressIndex]?.value ?? address);
                return;
              }
              if (!finding && addressRows.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                event.preventDefault();
                const delta = event.key === 'ArrowDown' ? 1 : -1;
                setAddressIndex(index => index < 0 && delta < 0 ? addressRows.length - 1
                  : (index + delta + addressRows.length) % addressRows.length);
                return;
              }
              if (event.key !== 'Escape') return;
              setAddressPopupOpen(false);
              setFinding(false);
              setChromeHovered(false);
              setAddress(tab?.url ?? '');
              event.currentTarget.blur();
            }} />
          <span className="address-trailing">
            {finding ? <>
              <span className="find-count" aria-live="polite">{state.findResult
                ? (state.findResult.matches ? state.findResult.active + ' of ' + state.findResult.matches : '0 matches')
                : ''}</span>
              <IconButton label="Previous match" disabled={!state.findResult?.matches} onClick={() => run('find-next', 'previous')}><ArrowLeft size={14} /></IconButton>
              <IconButton label="Next match" disabled={!state.findResult?.matches} onClick={() => run('find-next', 'next')}><ArrowRight size={14} /></IconButton>
              <IconButton label="Close find" onClick={() => { setFinding(false); setAddress(tab?.url ?? ''); }}><X size={15} /></IconButton>
            </>
              : toolbarHas('reload') && <IconButton label={tab?.loading ? 'Stop loading' : 'Reload'} disabled={!tab?.url} onClick={() => run('reload')}>
                {tab?.loading ? <X size={14} /> : <RotateCw size={14} />}
              </IconButton>}
          </span>
        </form>
        <div className="toolbar-group tab-controls" role="group" aria-label="Page and tab actions">
          {state.split && <>
            <IconButton label="Swap split panes" onClick={() => run('split-swap')}><ArrowLeftRight size={16}/></IconButton>
            <IconButton label="Exit split view" onClick={() => run('split-end')}><X size={16}/></IconButton>
          </>}
          {prefs.toolbar.map(id => {
            if (id === 'bookmark') return <IconButton key={id} label={saved ? 'Remove bookmark' : 'Bookmark page'} pressed={saved} disabled={!tab?.url} onClick={() => run('bookmark')}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></IconButton>;
            if (id === 'copy') return <IconButton key={id} label="Copy page link" disabled={!tab?.url} onClick={() => run('copy')}><Link2 size={16} /></IconButton>;
            if (id === 'new-tab') return <IconButton key={id} label="New tab" onClick={() => { show(); run('new'); setFocusAddress(true); }}><Plus size={17} /></IconButton>;
            if (id === 'tabs') return <IconButton key={id} label="Open tabs" onClick={() => show('tabs')}><Layers2 size={16} /></IconButton>;
            return navigationButton(id, 16);
          })}
        </div>
      </div>
    </header>
    {state.sidebar && <div className="sidebar-glass" aria-hidden="true" />}
    {state.sidebar && <aside className="sidebar"
      onDragEnter={event => {
        if (event.dataTransfer.types.includes('text/uri-list')) setShowFavoriteSlots(true);
      }}
      onDragLeave={event => {
        if (!event.dataTransfer.types.includes('text/uri-list')) return;
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) stopFavoriteDrag();
      }}
      onDrop={stopFavoriteDrag}>
      <div className="sidebar-heading">
        <IconButton label="Hide sidebar" onClick={() => run('sidebar', false)}><PanelLeft size={16} /></IconButton>
      </div>
      {(showFavoriteSlots || state.favorites.length > 0) && <div className="sidebar-favorites" role="group" aria-label="Favorites, up to three sites">
        {Array.from({ length: showFavoriteSlots ? state.favoriteLimit : state.favorites.length }, (_, index) => {
          const item = state.favorites[index];
          return <div key={index} className={'tab favorite-slot' + (favoriteDropIndex === index ? ' drop-target' : '') + (!item ? ' empty-slot' : '')}
            onDragOver={event => hoverFavorite(event, index)} onDragLeave={() => setFavoriteDropIndex(undefined)} onDrop={event => dropFavorite(event, index)}>
            {item ? <>
              <button className="tab-label" type="button" title={item.title || host(item.url)} aria-label={'Open favorite ' + (item.title || host(item.url))}
                draggable onDragStart={event => {
                  setShowFavoriteSlots(true);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData(favoriteDragType, item.url);
                }} onDragEnd={stopFavoriteDrag} onClick={() => { show(); run('open-favorite', item.url); }}>
                <WebsiteIcon url={item.url} favicon={item.favicon} />
              </button>
              <IconButton label={'Remove favorite ' + item.title} onClick={() => run('remove-favorite', item.url)}><StarOff size={13} /></IconButton>
            </> : <span className="tab-label" aria-hidden="true"><Plus size={14} /></span>}
          </div>;
        })}
      </div>}
      <div className="vertical-tabs" aria-label="Open tabs">
        {orderedTabs.map(item => <div className={'tab ' + (item.id === state.activeId ? 'selected' : '')} key={item.id}>
          <button className="tab-label" aria-current={item.id === state.activeId ? 'page' : undefined} onClick={() => select(item.id)} title={(item.sleeping ? 'Sleeping · ' : '') + (item.title || host(item.url))} aria-label={item.title || host(item.url)}
            draggable={!!item.url} onDragStart={event => {
              if (!item.url) { event.preventDefault(); return; }
              setShowFavoriteSlots(true);
              event.dataTransfer.effectAllowed = 'copy';
              event.dataTransfer.setData(tabDragType, item.id);
            }} onDragEnd={stopFavoriteDrag}>
            {item.sleeping ? <span className="sleep-indicator">z</span> : null}{item.loading ? <RotateCw className="spin" size={13} /> : <WebsiteIcon url={item.url} favicon={item.favicon} pinned={item.pinned} />}
          </button>
          <IconButton label={'Close ' + item.title} onClick={() => run('close', item.id)}><X size={13} /></IconButton>
        </div>)}
        <IconButton label="New tab" onClick={() => { show(); run('new'); setFocusAddress(true); }}><Plus size={18} /></IconButton>
      </div>
      <div className="sidebar-library" role="group" aria-label="Library">
        {prefs.sidebar.map(id => navigationButton(id, 17))}
      </div>
      {media && <div className="media-anchor" onPointerEnter={() => { setMediaOpen(true); run('media-expand', true); }}
        onPointerLeave={() => { setMediaOpen(false); run('media-expand', false); }}
        onFocus={() => { setMediaOpen(true); run('media-expand', true); }}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setMediaOpen(false); run('media-expand', false); }
        }}>
        <button className="media-thumbnail" aria-label={'Now playing: ' + (media.title || media.tabTitle)} aria-expanded={mediaOpen}
          onClick={() => { setMediaOpen(!mediaOpen); run('media-expand', !mediaOpen); }}>
          <WebsiteIcon url={media.url} favicon={media.artwork || media.favicon} />
          {media.playing && <span className="media-bars" aria-hidden="true"><i/><i/><i/></span>}
        </button>

      </div>}
      <div className="sidebar-settings">
        {state.update && <div className="sidebar-update">
          {state.update.installing
            ? <div className="icon-button update-progress" role="progressbar"
                aria-label="NOVA update download" aria-valuenow={state.update.progress}
                title={state.update.progress === 100 ? 'Installing NOVA update' : 'Downloading NOVA update'}>
                {state.update.progress}%
              </div>
            : <IconButton label={`Update NOVA to ${state.update.version}`} onClick={() => run('browser-update')}>
                <ArrowDownToLine size={17} />
              </IconButton>}
        </div>}
        <IconButton label="Settings" pressed={panel === 'settings'} onClick={() => show(panel === 'settings' ? undefined : 'settings')}><Settings size={17} /></IconButton>
      </div>
    </aside>}
    <main className="viewport">
      {state.split && !panel && <SplitDivider split={state.split} sidebar={state.sidebar}/>}
      {panel === 'spaces' && <section className="library space-library">
        <header className="library-head"><div className="library-symbol"><Layers2/></div><h1 className="library-title">Spaces</h1><IconButton label="Close spaces" onClick={() => show()}><X size={18}/></IconButton></header>
        <div className="space-grid">{state.spaces.map((space, index) => <button key={space.id} className="space-tile" aria-pressed={state.spaceId === space.id}
          style={{'--space-hue': (index * 73 + 168) % 360} as CSSProperties}
          onClick={() => { setPanel(undefined); run('space-select', space.id); }}>
          <div className="space-tile-icon-surface"><SpaceIcon name={space.emoji} size={22} /></div>
          <span className="space-info"><strong>{space.name}</strong><small>{space.count} {space.count === 1 ? 'tab' : 'tabs'}</small></span>{state.spaceId === space.id && <Check size={16}/>}
        </button>)}</div>
        {currentSpace && <div className="space-emoji-setting">
          <span>Icon for <strong>{currentSpace.name}</strong></span>
          <SpaceIconPicker value={currentSpace.emoji} onChange={value => run('space-emoji', { id: currentSpace.id, emoji: value })} label={`Icon for ${currentSpace.name}`}/>
        </div>}
        <form className="space-create" onSubmit={event => {
          event.preventDefault(); if (!spaceName.trim()) return;
          setPanel(undefined); run('space-new', { name: spaceName, emoji }); setSpaceName('');
        }}><SpaceIconPicker value={emoji} onChange={setEmoji} label="New Space icon"/><input aria-label="Space name" placeholder="Name a new space" maxLength={40} value={spaceName} onChange={event => setSpaceName(event.target.value)}/>
        <button disabled={!spaceName.trim()}><Plus size={16}/> Create space</button></form>
      </section>}
      {panel === 'tray' && <TrayPanel items={state.tray} drop={trayDrop} onClose={() => show()} />}
      {panel === 'settings' && <section className="library browser-settings" aria-labelledby="browser-settings-heading">
        <header className="library-head">
          {selectedSettings
            ? <IconButton label="Back to settings" onClick={() => setSettingsSection(undefined)}><ArrowLeft size={18} /></IconButton>
            : <div className="library-symbol"><Settings /></div>}
          <h1 id="browser-settings-heading" className="library-title">{selectedSettings?.label ?? 'Settings'}</h1>
          <IconButton label="Close settings" onClick={() => show()}><X size={18} /></IconButton>
        </header>
        {state.platform === 'darwin' && !state.privateMode && (!selectedSettings || settingsSection === 'browser') &&
          <DefaultBrowser status={state.defaultBrowser} />}
        {!selectedSettings ? <div className="settings-options">
          {settingsSections.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={'settings-option option-' + id} aria-label={label} onClick={() => setSettingsSection(id)}>
            <Icon size={20} aria-hidden="true" />
            <span>{id === 'sidebar' ? 'Sidebar' : label}</span>
          </button>)}
        </div> : <div key={settingsSection} className="settings-card settings-detail">
          {settingsSection === 'toolbar' && <>
            <IconPreferences area="toolbar" selected={prefs.toolbar} />
            <label className="setting-row">
            <span><strong>Blur behind the top bar</strong><small>Use the page beneath the toolbar as a live backdrop.</small></span>
            <input type="checkbox" role="switch" checked={state.toolbarBlur} onChange={event => run('toolbar-blur', event.target.checked)} />
            </label>
          </>}
          {settingsSection === 'sidebar' && <>
            <IconPreferences area="sidebar" selected={prefs.sidebar} />
            <label className="setting-row">
              <span><strong>Show sidebar</strong><small>Keep tabs and favorites visible while browsing.</small></span>
              <input type="checkbox" role="switch" checked={state.sidebar} onChange={event => run('sidebar', event.target.checked)} />
            </label>
            <label className="setting-row">
              <span><strong>Blur behind the sidebar</strong><small>Use the edge of the page as a live backdrop.</small></span>
              <input type="checkbox" role="switch" checked={state.pageBlur} onChange={event => run('page-blur', event.target.checked)} />
            </label>
          </>}
          {settingsSection === 'browser' && <>
            <label className="setting-row"><span><strong>Sleeping tabs</strong><small>Release memory after 15 minutes of inactivity. Select a sleeping tab to reload it.</small></span>
              <input type="checkbox" checked={prefs.sleepTabs} onChange={e => run('preference', { key: 'sleepTabs', value: e.target.checked })}/></label>
            <h2 className="settings-group-title">Appearance</h2>
            <label className="setting-row">
              <span><strong>Page font size</strong><small>Changes the base text size on websites. Some sites use fixed sizes.</small></span>
              <select value={prefs.fontSize} onChange={event => run('preference', { key: 'fontSize', value: Number(event.target.value) })}>
                {[12, 14, 16, 18, 20, 24].map(size => <option key={size} value={size}>{size} px</option>)}
              </select>
            </label>
            <label className="setting-row">
              <span><strong>Default page zoom</strong><small>Scales text, images, and layout on websites.</small></span>
              <select value={prefs.defaultZoom} onChange={event => run('preference', { key: 'defaultZoom', value: Number(event.target.value) })}>
                {[75, 90, 100, 110, 125, 150, 175, 200].map(zoom => <option key={zoom} value={zoom}>{zoom}%</option>)}
              </select>
            </label>
            <h2 className="settings-group-title">Search and new tabs</h2>
            <label className="setting-row">
            <span><strong>Search engine</strong><small>Used by the address bar, dashboard, and quick search.</small></span>
            <select value={state.searchEngine} onChange={event => run('search-engine', event.target.value)}>
              <option value="google">Google</option>
              <option value="duckduckgo">DuckDuckGo</option>
              <option value="bing">Bing</option>
            </select>
            </label>
            <label className="setting-row">
              <span><strong>Live search suggestions</strong><small>Send search terms to Google for autocomplete.</small></span>
              <input type="checkbox" role="switch" checked={prefs.liveSuggestions}
                onChange={event => run('preference', { key: 'liveSuggestions', value: event.target.checked })} />
            </label>
            <label className="setting-row">
              <span><strong>New tabs open with</strong><small>Choose what appears when you open a new tab.</small></span>
              <select value={prefs.newTabPage} onChange={event => run('preference', { key: 'newTabPage', value: event.target.value })}>
                <option value="dashboard">NOVA dashboard</option><option value="blank">Blank page</option>
              </select>
            </label>
            <label className="setting-row">
              <span><strong>Restore tabs on launch</strong><small>Reopen tabs from your last session.</small></span>
              <input type="checkbox" role="switch" checked={prefs.restoreTabs} disabled={state.privateMode} onChange={event => run('preference', { key: 'restoreTabs', value: event.target.checked })} />
            </label>
            <h2 className="settings-group-title">Gestures</h2>
            {([
              ['swipeHistory', 'Back and forward', 'Swipe right with two fingers to go back, or left to go forward. Lift your fingers to navigate.'],
              ['pinchOverview', 'Show all tabs', 'Pinch two fingers together anywhere in NOVA to open Tab Overview.'],
              ['pinchOpenTab', 'Open a tab preview', 'Hover over a preview in Tab Overview and spread two fingers apart to open it.']
            ] as const).map(([key, title, instructions]) => <label className="setting-row" key={key}>
              <span><strong>{title}</strong><small>{instructions}</small></span>
              <input type="checkbox" role="switch" aria-label={title} checked={prefs[key]} disabled={state.platform !== 'darwin'}
                onChange={event => run('preference', { key, value: event.target.checked })} />
            </label>)}
            {state.platform !== 'darwin' && <p>These trackpad gestures are available on macOS.</p>}
            <h2 className="settings-group-title">Downloads</h2>
            <div className="setting-row">
              <span><strong>Download location</strong><small className="download-path" title={prefs.downloadFolder}>{prefs.downloadFolder}</small></span>
              <button className="text-button" type="button" onClick={() => run('download-folder')}>Choose folder</button>
            </div>
            <h2 className="settings-group-title">Extensions</h2>
            <div className="setting-row">
              <span><strong>Manage extensions</strong><small>Load a compatible unpacked extension from a local folder.</small></span>
              <button className="text-button" type="button" onClick={() => show('extensions')}>Open Extensions</button>
            </div>
            <h2 className="settings-group-title">Privacy and data</h2>
            <label className="setting-row">
              <span><strong>Ads and trackers</strong><small>{state.contentBlocking === 'basic' ? 'Basic blocking is active while the full filters load.' : 'Choose whether NOVA blocks ads and trackers across websites.'} Reload open pages after changing this.</small></span>
              <select value={prefs.blockAds ? 'block' : 'show'} onChange={event => run('preference', { key: 'blockAds', value: event.target.value === 'block' })}>
                <option value="block">Block ads</option>
                <option value="show">Show ads</option>
              </select>
            </label>
            <label className="setting-row">
              <span><strong>Remember browsing history</strong><small>Save future visits in History.</small></span>
              <input type="checkbox" role="switch" checked={prefs.rememberHistory} disabled={state.privateMode} onChange={event => run('preference', { key: 'rememberHistory', value: event.target.checked })} />
            </label>
            <div className="setting-row">
              <span><strong>Browsing history</strong><small>Review or clear the list of visited sites.</small></span>
              <button className="text-button" type="button" onClick={() => show('history')}>Open History</button>
            </div>
            {state.site && <div className="setting-row">
              <span><strong>Current site</strong><small>{state.site.origin} · Permissions, site data, and ad blocking</small></span>
              <button className="text-button" type="button" onClick={() => show('site')}>Site controls</button>
            </div>}
            {!state.privateMode && <div className="setting-row">
              <span><strong>Passwords</strong><small>Manage saved logins and generate passwords.</small></span>
              <button className="text-button" type="button" onClick={() => show('passwords')}>Open Passwords</button>
            </div>}
            <div className="setting-row">
              <span><strong>Cookies and site data</strong><small>Clear website cookies, stored data, and cache.</small></span>
              <button className="text-button" type="button" onClick={() => run('clear-site-data')}>Clear site data…</button>
            </div>
          </>}
        </div>}
      </section>}
      {panel === 'passwords' && <section className="library" aria-labelledby="password-tools-heading">
        <header className="library-head">
          <div className="library-symbol"><KeyRound /></div>
          <h1 id="password-tools-heading" className="library-title">Passwords</h1>
          <IconButton label="Close passwords" onClick={() => show()}><X size={18} /></IconButton>
        </header>
        <PasswordTools logins={state.savedLogins} privateMode={state.privateMode} offerSaveLogins={prefs.offerSaveLogins} />
      </section>}
      {panel === 'site' && state.site && <section className="library" aria-labelledby="site-controls-heading">
        <header className="library-head">
          <div className="library-symbol"><ShieldCheck /></div>
          <h1 id="site-controls-heading" className="library-title">Site controls</h1>
          <IconButton label="Close site controls" onClick={() => show()}><X size={18} /></IconButton>
        </header>
        <div className="settings-card">
          <div className="setting-row"><span><strong>{state.site.origin}</strong>
            <small>{{ https: 'HTTPS connection', http: 'Unencrypted HTTP connection', unverified: 'Connection unverified' }[state.site.connection]}</small></span></div>
          <h2 className="settings-group-title">Permissions</h2>
          {([['camera', 'Camera'], ['microphone', 'Microphone'], ['geolocation', 'Location'], ['notifications', 'Notifications']] as const).map(([key, label]) =>
            <label className="setting-row" key={key}><span><strong>{label}</strong></span>
              <select value={state.site?.permissions[key] ?? 'ask'} disabled={!state.site?.canSetPermissions}
                onChange={event => run('site-permission', { key, decision: event.target.value })}>
                <option value="ask">Ask</option><option value="allow">Allow</option><option value="block">Block</option>
              </select>
            </label>)}
          <h2 className="settings-group-title">Site data and blocking</h2>
          <label className="setting-row">
            <span><strong>Allow ads and trackers on this site</strong><small>Reload the page after changing this.</small></span>
            <input type="checkbox" role="switch" checked={state.site.adException} disabled={!prefs.blockAds}
              onChange={event => run('site-ad-exception', event.target.checked)} />
          </label>
          <div className="setting-row"><span><strong>Cookies and stored data</strong></span>
            <button className="text-button" onClick={() => run('clear-current-site')}>Clear this site’s data…</button>
          </div>
        </div>
      </section>}
      {panel === 'extensions' && <section className="library" aria-labelledby="extensions-heading">
        <header className="library-head">
          <div className="library-symbol"><Puzzle /></div>
          <h1 id="extensions-heading" className="library-title">Extensions</h1>
          <IconButton label="Close extensions" onClick={() => show()}><X size={18} /></IconButton>
        </header>
        <div className="settings-card">
          <div className="setting-row">
            <span><strong>Load unpacked</strong><small>Choose a trusted folder containing manifest.json. Compatibility depends on the extension.</small></span>
            <button className="text-button" type="button" onClick={() => run('load-extension')}>Choose folder</button>
          </div>
          {state.extensions.map(extension => <div className="setting-row" key={extension.path}>
            <span><strong title={extension.path}>{extension.name}</strong>
              <small>{extension.error ? 'Could not load · ' + extension.error : 'Loaded · Version ' + extension.version}</small></span>
            <button className="text-button" type="button" aria-label={'Remove ' + extension.name} onClick={() => run('remove-extension', extension.path)}>Remove</button>
          </div>)}
        </div>
      </section>}
      {panel && !paletteOpen && panel !== 'tabs' && panel !== 'settings' && panel !== 'passwords' && panel !== 'extensions' && panel !== 'site' && panel !== 'spaces' && panel !== 'tray' && <section className="library">
        <header className="library-head">
          <div className="library-symbol">{panel === 'history' ? <Clock3 /> : panel === 'downloads' ? <ArrowDownToLine /> : <Bookmark />}</div>
          <div className="library-title" role="heading" aria-level={1}><BlurText text={panel[0].toUpperCase() + panel.slice(1)} trigger="load" blur={5} distance={6} /></div>
          <IconButton label="Close panel" onClick={() => show()}><X size={18}/></IconButton>
        </header>
        {panel !== 'downloads' && <div className="library-tools">
          <label className="filter"><Search size={16} /><input aria-label={'Filter ' + panel} placeholder={'Filter ' + panel} value={filter} onChange={event => setFilter(event.target.value)} /></label>
          {panel === 'history' && state.history.length > 0 && <><button className="text-button" onClick={() => {
            if (confirmation) run('clear-history');
            setConfirmation(!confirmation);
          }}>{confirmation ? 'Confirm clear' : 'Clear history'}</button>{confirmation && <button className="text-button" onClick={() => setConfirmation(false)}>Cancel</button>}</>}
        </div>}
        <div className="library-list">
          {panel === 'downloads' ? (state.downloads.length ? state.downloads.map(item => <div className="entry" key={item.id}>
            <ArrowDownToLine size={18} /><div className="entry-text"><strong>{item.name}</strong><small>{item.status === 'progressing' ? item.progress + '%' : item.status}</small></div>
            {item.status === 'completed' && <IconButton label="Show in folder" onClick={() => run('reveal-download', item.id)}><ArrowUpRight size={16} /></IconButton>}
            {item.canControl && item.status === 'progressing' && <IconButton label="Pause download" onClick={() => run('download-control', { id: item.id, action: 'pause' })}><Pause size={16} /></IconButton>}
            {item.canResume && ['paused', 'interrupted'].includes(item.status) && <IconButton label="Resume download" onClick={() => run('download-control', { id: item.id, action: 'resume' })}><Play size={16} /></IconButton>}
            {item.canControl && <IconButton label="Cancel download" onClick={() => run('download-control', { id: item.id, action: 'cancel' })}><X size={16} /></IconButton>}
          </div>) : <p className="empty">Downloads will appear here.</p>) :
            (matches.length ? matches.map(item => <div className="entry" key={item.url}>
              <button className="entry-link" onClick={() => navigate(item.url)}><Globe2 size={18}/><div className="entry-text"><strong>{item.title}</strong><small>{host(item.url)}</small></div><ArrowUpRight size={15} /></button>
              {panel === 'bookmarks' && <IconButton label="Remove bookmark" onClick={() => run('remove-bookmark', item.url)}><X size={15}/></IconButton>}
            </div>) : <p className="empty">{filter ? 'No matching pages.' : panel === 'history' ? 'Visited pages will appear here.' : 'Use the bookmark button to save a page.'}</p>)}
        </div>
      </section>}
      {!panel && tab?.error && <div className="page-error"><CircleAlert size={32}/><h1>This page couldn’t load</h1><p>{tab.error}</p><button className="text-button" onClick={() => run('reload')}>Try again</button></div>}
    </main>
    {panel === 'tabs' && state.tabPreviews && <TabOverview
      splitFrom={chooseSplit ? state.activeId : undefined} tabs={orderedTabs} activeId={state.activeId} previews={state.tabPreviews}
      onSplit={ids => { setPanel(undefined); run('split', ids); }}
      onDismiss={() => show()}
      onSelect={id => {
        setPanel(undefined);
        setFinding(false);
        run('select', id);
      }}
    />}
    <Command.Dialog open={paletteOpen} onOpenChange={open => { if (!open) show(); }} label="Browser commands">
      <div className="command-search"><Search size={19}/><Command.Input placeholder="Find a tab or run a command…" /><kbd>Esc</kbd></div>
      <Command.List>
        <Command.Empty>No matching commands or tabs.</Command.Empty>
        {panel === 'commands' && <Command.Group heading="Browser">
          <Command.Item onSelect={() => show('settings')}><Settings size={16} /> Settings</Command.Item>
          <Command.Item onSelect={() => show('extensions')}><Puzzle size={16} /> Extensions</Command.Item>
          <Command.Item onSelect={() => { show(); run('private-window'); }}><ShieldCheck size={16} /> New private window <kbd>{hotkey}⇧N</kbd></Command.Item>
          <Command.Item onSelect={() => { show(); run('new'); }}><Plus size={16}/> New tab <kbd>{hotkey}T</kbd></Command.Item>
          <Command.Item onSelect={() => { show(); run('reopen'); }}><RotateCw size={16}/> Reopen closed tab <kbd>{hotkey}⇧T</kbd></Command.Item>
          <Command.Item onSelect={() => { show(); run('sidebar'); }}><PanelLeft size={16}/> {state.sidebar ? 'Hide sidebar' : 'Show sidebar'}</Command.Item>
          {navigation.filter(item => item.id !== 'tray' || !state.privateMode).map(({ id, label, icon: Icon }) => <Command.Item key={id} onSelect={() => id === 'split' ? show('tabs', Boolean(tab?.url)) : show(id)}><Icon size={16}/> Open {label.toLowerCase()}</Command.Item>)}
          <Command.Item onSelect={() => { show(); run('pin'); }}><Pin size={16}/> {tab?.pinned ? 'Unpin tab' : 'Pin tab'}</Command.Item>
          {tab?.url && <>
            <Command.Item onSelect={() => { show(); run('copy'); }}><Link2 size={16}/> Copy page link</Command.Item>
            <Command.Item onSelect={() => { show(); setAddress(''); setFinding(true); setFocusAddress(true); }}><Search size={16}/> Find in page <kbd>{hotkey}F</kbd></Command.Item>
            <Command.Item onSelect={() => { show(); run('zoom', 1); }}><Plus size={16}/> Zoom in <kbd>{state.zoom}%</kbd></Command.Item>
            <Command.Item onSelect={() => { show(); run('zoom', -1); }}><Minus size={16}/> Zoom out</Command.Item>
            <Command.Item onSelect={() => { show(); run('zoom', 0); }}><Compass size={16}/> Reset zoom</Command.Item>
          </>}
        </Command.Group>}
        <Command.Group heading="Open tabs">{orderedTabs.map(item =>
          <Command.Item key={item.id} value={item.id + ' ' + item.title + ' ' + item.url} onSelect={() => select(item.id)}>
            <Globe2 size={16} />{item.title}
          </Command.Item>
        )}</Command.Group>
      </Command.List>
    </Command.Dialog>
  </div>;
}

const root = createRoot(document.getElementById('root')!);
if (window.novaTour) {
  void import('./WelcomeTour').then(({ WelcomeTour }) => root.render(<WelcomeTour />));
} else {
  root.render(<Browser />);
}
