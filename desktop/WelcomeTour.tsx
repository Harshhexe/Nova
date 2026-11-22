import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { TourDemos } from './TourDemos';
import { createTourAudio } from './tour-audio';
import './tour.css';
import './tour-demos.css';

type Target = { x: number; y: number; width: number; height: number };
type TourTargets = { bounds: Target[]; backdrop?: Target & { src: string } };
declare global {
  interface Window {
    novaTour?: {
      step: (step: number, name?: string) => Promise<void>;
      targets: () => Promise<TourTargets>;
      finish: () => Promise<void>;
    };
  }
}

const chapters = [
  { name: 'Dashboard', title: 'Make your new tab yours.', description: 'Add the sites you visit most and set a wallpaper, clock, and greeting you want to see.' },
  { name: 'Sidebar', title: 'Pin the sites you use most.', description: 'The sidebar holds up to three favorites, your open tabs, and tools like bookmarks, history, and downloads.' },
  { name: 'Gestures & search', title: 'Gestures and shortcuts.', description: 'See all your tabs, go back or forward, and start a search from any page.' }
];

function Aurora() {
  return <div className="tour-aurora" aria-hidden="true">
    <div className="aurora-ribbon ribbon-violet" />
    <div className="aurora-ribbon ribbon-teal" />
    <div className="aurora-ribbon ribbon-rose" />
    <div className="tour-grain" />
  </div>;
}

function TourHighlight({ targets }: { targets: Target[] }) {
  const padded = targets.map(({ x, y, width, height }) => ({
    x: Math.max(0, x - 4), y: Math.max(0, y - 4), width: width + 8, height: height + 8
  }));
  const mask = padded.length ? {
    maskImage: Array.from({ length: padded.length + 1 }, () => 'linear-gradient(white, white)').join(','),
    maskSize: ['100% 100%', ...padded.map(({ width, height }) => width + 'px ' + height + 'px')].join(','),
    maskPosition: ['0 0', ...padded.map(({ x, y }) => x + 'px ' + y + 'px')].join(','),
    maskRepeat: 'no-repeat',
    maskComposite: 'exclude'
  } : undefined;
  return <div className="tour-highlights" aria-hidden="true">
    <div className="tour-scrim" style={mask} />
    {padded.map(({ x, y, width, height }, index) =>
      <span className="tour-outline" key={index} style={{ left: x, top: y, width, height }} />)}
  </div>;
}

export function WelcomeTour() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [muted, setMuted] = useState(() => localStorage.getItem('nova-tour-muted') === 'true');
  const [leaving, setLeaving] = useState(false);
  const sound = useRef<ReturnType<typeof createTourAudio> | null>(null);
  const finishTimer = useRef<number | undefined>(undefined);
  const [targetState, setTargetState] = useState<TourTargets & { step: number; cardX: number; cardY: number }>();
  const card = useRef<HTMLElement>(null);
  const busy = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const guide = step >= 2;
  const chapter = guide ? chapters[step - 2] : undefined;
  const backdrop = targetState?.step === step ? targetState.backdrop : undefined;
  const mac = navigator.userAgent.includes('Macintosh');

  useEffect(() => () => {
    window.clearTimeout(finishTimer.current);
    sound.current?.dispose();
  }, []);

  function playClick() {
    if (muted) return;
    sound.current ??= createTourAudio();
    sound.current.click();
  }

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    localStorage.setItem('nova-tour-muted', String(next));
    if (sound.current) sound.current.setMuted(next);
    if (!next) {
      sound.current ??= createTourAudio();
      sound.current.click();
    }
  }

  useEffect(() => {
    if (step === 1) nameInput.current?.focus();
    else heading.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!guide) return;
    let current = true;
    let timer: number;
    const measure = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void window.novaTour?.targets().then(targets => {
          if (current) setTargetState({ ...targets, step, cardX: card.current?.offsetLeft ?? 0, cardY: card.current?.offsetTop ?? 0 });
        }).catch(() => {});
      }, 80);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      current = false;
      window.clearTimeout(timer);
      window.removeEventListener('resize', measure);
    };
  }, [guide, step]);

  async function go(next: number, displayName?: string) {
    if (busy.current) return;
    busy.current = true;
    try {
      await window.novaTour?.step(next, displayName);
      setStep(next);
    } finally {
      busy.current = false;
    }
  }

  function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void go(2, name.trim());
  }

  function finish() {
    if (busy.current) return;
    busy.current = true;
    sound.current?.fadeOut();
    setLeaving(true);
    finishTimer.current = window.setTimeout(() => {
      void window.novaTour?.finish().catch(() => {
        setLeaving(false);
        busy.current = false;
      });
    }, 240);
  }

  return <main className={'nova-tour' + (guide ? ' tour-guided' : '') + (leaving ? ' tour-leaving' : '')}
    aria-label="Welcome to NOVA" onClickCapture={event => {
      const button = (event.target as Element).closest('button');
      if (button && !button.classList.contains('tour-audio') && !busy.current) playClick();
    }}>
    <button className="tour-audio" type="button" aria-label="Mute tour audio" aria-pressed={muted} onClick={toggleSound}>
      {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}<span>Sound {muted ? 'off' : 'on'}</span>
    </button>
    {guide ? <TourHighlight targets={targetState?.step === step ? targetState.bounds : []} /> : <Aurora />}
    <div key={step} className={'tour-scene' + (step === 3 ? ' tour-sidebar-scene' : '')}>
      {step === 0 ? <section className="tour-welcome" aria-labelledby="tour-heading">
        <div className="tour-brand-mark" aria-hidden="true">✦</div>
        <h1 id="tour-heading" ref={heading} tabIndex={-1}>NOVA</h1>
        <p>Your beautiful browser</p>
        <button className="tour-primary" type="button" onClick={() => void go(1)}>Hop in <ArrowRight size={17} /></button>
      </section> : step === 1 ? <form className="tour-name-card" onSubmit={submitName}>
        <div className="tour-small-mark" aria-hidden="true">✦</div>
        <h1 ref={heading} tabIndex={-1}><label htmlFor="tour-name">What should we call you?</label></h1>
        <input id="tour-name" ref={nameInput} placeholder="Your first name" autoComplete="given-name"
          value={name} maxLength={30} onChange={event => setName(event.target.value)} />
        <div className="tour-actions">
          <button className="tour-secondary" type="button" onClick={() => void go(0)}><ArrowLeft size={15} /> Back</button>
          <button className="tour-primary" type="submit">Continue <ArrowRight size={17} /></button>
        </div>
      </form> : chapter && <section ref={card} className="tour-guide-card" aria-labelledby="tour-chapter">
        {backdrop && targetState && <div className="tour-card-frost" aria-hidden="true">
          <img alt="" src={backdrop.src} style={{ left: backdrop.x - targetState.cardX, top: backdrop.y - targetState.cardY, width: backdrop.width, height: backdrop.height }} />
        </div>}
        <div className="tour-chapter-line">
          <span>{chapter.name}</span>
          <div className="tour-progress" aria-label={`Step ${step - 1} of 3`}>
            {chapters.map((item, index) => <i key={item.name} className={index <= step - 2 ? 'filled' : undefined} />)}
          </div>
        </div>
        <div className="tour-guide-content">
          <div className="tour-guide-intro">
            <h1 id="tour-chapter" ref={heading} tabIndex={-1}>{chapter.title}</h1>
            <p>{chapter.description}</p>
          </div>
          <TourDemos chapter={step - 2} mac={mac} />
        </div>
        <div className="tour-actions">
          <button className="tour-secondary" type="button" onClick={() => void go(step - 1)}><ArrowLeft size={15} /> Back</button>
          <button className="tour-secondary tour-skip" type="button" onClick={finish}>Skip tour</button>
          <button className="tour-primary" type="button" onClick={() => step === 4 ? finish() : void go(step + 1)}>
            {step === 4 ? 'Start browsing' : 'Next'} <ArrowRight size={17} />
          </button>
        </div>
      </section>}
    </div>
  </main>;
}
