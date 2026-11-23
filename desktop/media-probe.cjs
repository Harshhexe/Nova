const { ipcRenderer } = require('electron');

let last = '';
let refresh;

function findMedia() {
  const elements = [...document.querySelectorAll('video, audio')];
  return elements.find(item => !item.paused && !item.ended) ||
    elements.find(item => item.currentTime > 0 && !item.ended);
}

function report() {
  clearTimeout(refresh);
  const media = findMedia();
  const metadata = navigator.mediaSession?.metadata;
  const artwork = metadata?.artwork?.findLast(item => /^https?:/.test(item.src))?.src || '';
  const data = media ? {
    title: metadata?.title || document.title,
    artist: metadata?.artist || '',
    artwork, video: media instanceof HTMLVideoElement,
    playing: !media.paused && !media.ended,
    currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
    duration: Number.isFinite(media.duration) ? media.duration : 0
  } : null;
  const value = JSON.stringify(data);
  if (value !== last) {
    last = value;
    ipcRenderer.send('nova:media', data);
  }
  if (media) refresh = setTimeout(report, 1500);
}
for (const event of ['play', 'pause', 'ended', 'loadedmetadata', 'durationchange', 'emptied', 'seeked']) document.addEventListener(event, report, true);
document.addEventListener('DOMContentLoaded', report, { once: true });
ipcRenderer.on('nova:media-control', (_event, action) => {
  const media = findMedia();
  if (!media) return;
  if (action === 'toggle') {
    if (media.paused) media.play().catch(() => {});
    else media.pause();
  } else if (action && action.type === 'seek' && Number.isFinite(action.time) && Number.isFinite(media.duration)) {
    media.currentTime = Math.max(0, Math.min(media.duration, action.time));
  }
  report();
});
