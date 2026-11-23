import { useState } from 'react';
import { ArrowLeftRight, Moon, PictureInPicture2, ArrowLeft, ArrowRight, Bookmark, Clock3, Download, Folder, Globe2, Layers2, MousePointer2, Plus, RotateCcw, Search, Settings2, Star } from 'lucide-react';

const toolIcons = { tray: Folder, spaces: Layers2, split: ArrowLeftRight, pip: PictureInPicture2, sleep: Moon };

type Tool = keyof typeof toolIcons;
type DemoId = Tool | 'favorites' | 'customize' | 'pin' | 'tools' | 'history' | 'overview' | 'expand' | 'search';

const demos = {
  favorites: { label: 'Favorites', text: 'Click Show favorites to open the shelf. Use + to add a shortcut or a folder.' },
  customize: { label: 'Customize', text: 'Click Customize to choose a wallpaper, including one that changes with the time of day, and adjust your clock and greeting.' },
  pin: { label: 'Pin a site', text: 'Grab a tab and drop it in a dashed favorite slot. Your pinned site stays even after you close the tab.' },
  tools: { label: 'Sidebar tools', text: 'Use the sidebar to switch tabs or open bookmarks, history, and downloads. Choose which icons appear in Sidebar Settings.' },
  history: { label: 'Back / forward', text: 'Swipe right with two fingers to go back, or left to go forward. Lift your fingers to navigate.' },
  overview: { label: 'Show tabs', text: 'Pinch two fingers together to see all your open tabs.' },
  expand: { label: 'Open a tab', text: 'Hover over a preview, then spread two fingers apart to open that tab.' },
  search: { label: 'Search', text: 'Press the search shortcut to open NOVA search over the page you’re on.' },
  tray: { label: 'Tray', text: 'Drop files, links, and text onto Tray to keep them handy.' },
  spaces: { label: 'Spaces', text: 'Create a Space with its own emoji, tabs, favorites, and wallpaper.' },
  split: { label: 'Split View', text: 'Open two pages side by side and drag the divider to resize them.' },
  pip: { label: 'Picture in Picture', text: 'Right-click a supported video to float it above other windows.' },
  sleep: { label: 'Sleeping tabs', text: 'Eligible background tabs release memory after 15 minutes and reload when you select them.' }
} satisfies Record<DemoId, { label: string; text: string }>;

const chapterDemos: DemoId[][] = [
  ['favorites', 'customize'],
  ['pin', 'tools'],
  ['history', 'overview', 'expand', 'search'],
  ['tray', 'spaces', 'split', 'pip', 'sleep']
];

function Pointer({ className = '' }: { className?: string }) {
  return <span className={'demo-pointer ' + className}><MousePointer2 size={21} fill="currentColor" /><i /></span>;
}

function DashboardDemo({ kind }: { kind: 'favorites' | 'customize' }) {
  return <div className={'demo-dashboard demo-' + kind}>
    <div className="demo-browser-header"><i /><i /><i /><span>New tab</span></div>
    <div className="demo-dashboard-clock">10:42</div>
    <span className="demo-customize-chip"><Settings2 size={11} /> Customize</span>
    <div className="demo-shelf">
      <span className="demo-shelf-trigger">Show favorites</span>
      <div className="demo-shelf-items">
        <span><Globe2 size={17} /></span><span><Folder size={17} /></span><span><Plus size={17} /></span>
      </div>
    </div>
    {kind === 'customize' && <div className="demo-appearance">
      <strong>Appearance</strong>
      <span>Show clock<i /></span>
      <span>Personal greeting<i /></span>
      <span>Wallpaper studio<ArrowRight size={11} /></span>
    </div>}
    <Pointer />
  </div>;
}

function SidebarDemo({ kind }: { kind: 'pin' | 'tools' }) {
  return <div className={'demo-sidebar demo-' + kind}>
    <div className="demo-browser-header"><i /><i /><i /><span>Design library</span></div>
    <div className="demo-rail">
      <span className="demo-pin-slot"><Star size={12} /></span>
      <span className="demo-open-tab" aria-hidden="true"><Globe2 size={15} /></span>
      <span><Plus size={14} /></span>
      <div className="demo-library"><Bookmark size={14} /><Clock3 size={14} /><Download size={14} /></div>
    </div>
    {kind === 'pin'
      ? <><span className="demo-dragged-site"><Globe2 size={15} /></span><Pointer /></>
      : <><div className="demo-library-panel"><Bookmark size={17} /><strong>Bookmarks</strong><span>Design library</span></div><Pointer /></>}
  </div>;
}

function Trackpad({ kind }: { kind: 'history' | 'overview' | 'expand' }) {
  return <div className="demo-trackpad">
    <div className="demo-fingers"><i /><i /></div>
    <span>{kind === 'history' ? 'Swipe' : kind === 'overview' ? 'Pinch in' : 'Spread out'}</span>
  </div>;
}

function GestureDemo({ kind, mac }: { kind: 'history' | 'overview' | 'expand' | 'search'; mac: boolean }) {
  const overview = kind === 'overview' || kind === 'expand';
  return <div className={'demo-gesture demo-' + kind}>
    <div className="demo-gesture-browser">
      <div className="demo-browser-header"><i /><i /><i /><span>Design library</span></div>
      {overview ? <div className="demo-tab-previews">
        <span /><span className="demo-selected-preview" /><span />
        {kind === 'expand' && <Pointer />}
      </div> : <div className="demo-webpage"><span /><span /><span /></div>}
      {kind === 'history' && <>
        <span className="demo-hist-arrow demo-hist-back"><ArrowLeft size={17} /></span>
        <span className="demo-hist-arrow demo-hist-forward"><ArrowRight size={17} /></span>
      </>}
      {kind === 'search' && <div className="demo-search-float"><Search size={15} /> Search anything…</div>}
    </div>
    {kind === 'search' ? <div className="demo-keyboard">
      <kbd>{mac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd>
    </div> : mac ? <Trackpad kind={kind} /> : <div className="demo-keyboard"><kbd><Layers2 size={16} /></kbd></div>}
  </div>;
}

export function TourDemos({ chapter, mac }: { chapter: number; mac: boolean }) {
  const choices = chapterDemos[chapter].filter(id => mac || (id !== 'history' && id !== 'expand'));
  const [selection, setSelection] = useState<DemoId>(choices[0]);
  const [playback, setPlayback] = useState(0);
  const { text } = demos[selection];
  const details = selection === 'search'
    ? text.replace('the search shortcut', mac ? '⌘K' : 'Ctrl+K')
    : selection === 'overview' && !mac ? 'Click Tab Overview in the top bar to see all your tabs.' : text;

  return <div className="tour-demos">
    <div className="tour-demo-controls" aria-label="Tour demonstrations">
      {choices.map(id => <button key={id} type="button" aria-pressed={id === selection} onClick={() => {
        setSelection(id);
        setPlayback(count => count + 1);
      }}>{demos[id].label}</button>)}
    </div>
    <div className="tour-demo-stage" key={selection + playback} aria-hidden="true">
      {selection === 'favorites' || selection === 'customize'
        ? <DashboardDemo kind={selection} />
        : selection === 'pin' || selection === 'tools'
          ? <SidebarDemo kind={selection} />
          : selection === 'history' || selection === 'overview' || selection === 'expand' || selection === 'search'
            ? <GestureDemo kind={selection} mac={mac} />
            : <div className="demo-browser-tool">{(() => { const Icon = toolIcons[selection]; return <Icon size={44}/>; })()}</div>}
    </div>
    <div className="tour-demo-caption">
      <p>{details}</p>
      <button type="button" className="tour-replay" aria-label="Replay demonstration" title="Replay demonstration"
        onClick={() => setPlayback(count => count + 1)}><RotateCcw size={16} /></button>
    </div>
  </div>;
}
