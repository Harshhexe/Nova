import { useEffect, useState, type CSSProperties } from 'react';

export const wallpaperTimes = [
  { id: 'night', label: 'Night', minute: 0, sky: '#090e2a', horizon: '#19285a', accent: '#765bc5', stars: 1 },
  { id: 'morning', label: 'Morning', minute: 360, sky: '#29244c', horizon: '#744f72', accent: '#ffb17f', stars: 0 },
  { id: 'day', label: 'Day', minute: 720, sky: '#234b76', horizon: '#507d9e', accent: '#a4d8ce', stars: 0 },
  { id: 'evening', label: 'Evening', minute: 1080, sky: '#251d46', horizon: '#634477', accent: '#e481a7', stars: .2 }
] as const;

export type WallpaperColors = Partial<Record<typeof wallpaperTimes[number]['id'], string>>;

export function wallpaperAccent(time: typeof wallpaperTimes[number], colors?: WallpaperColors) {
  const accent = colors?.[time.id];
  return typeof accent === 'string' && /^#[0-9a-f]{6}$/i.test(accent) ? accent : time.accent;
}

function mixColor(start: string, end: string, amount: number) {
  const channels = [1, 3, 5].map(offset => {
    const before = parseInt(start.slice(offset, offset + 2), 16);
    const after = parseInt(end.slice(offset, offset + 2), 16);
    return Math.round(before + (after - before) * amount);
  });
  return `rgb(${channels.join(', ')})`;
}

export function timeWallpaperStyle(date: Date, colors?: WallpaperColors) {
  const minute = date.getHours() * 60 + date.getMinutes();
  const index = Math.floor(minute / 360);
  const current = wallpaperTimes[index];
  const next = wallpaperTimes[(index + 1) % wallpaperTimes.length];
  const fraction = (minute - current.minute) / 360;
  const amount = fraction * fraction * (3 - 2 * fraction);

  return {
    '--time-sky': mixColor(current.sky, next.sky, amount),
    '--time-horizon': mixColor(current.horizon, next.horizon, amount),
    '--time-accent': mixColor(wallpaperAccent(current, colors), wallpaperAccent(next, colors), amount),
    '--time-stars': current.stars + (next.stars - current.stars) * amount
  } as CSSProperties;
}

export function TimeWallpaper({ colors }: { colors?: WallpaperColors }) {
  const [date, setDate] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function update() {
      clearTimeout(timer);
      if (document.hidden) return;
      const now = new Date();
      setDate(now);
      timer = setTimeout(update, 60_000 - now.getSeconds() * 1000 - now.getMilliseconds());
    }
    update();
    document.addEventListener('visibilitychange', update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return <div className="time-wallpaper" style={timeWallpaperStyle(date, colors)} aria-hidden="true" />;
}
