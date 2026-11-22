const { ipcRenderer } = require('electron');

let distance = 0;
let handled = false;
let indicated;
ipcRenderer.on('nova:trackpad-begin', () => {
  distance = 0;
  handled = false;
  indicated = undefined;
});


if (process.isMainFrame) window.addEventListener('wheel', event => {
  if (!event.isTrusted || event.ctrlKey || event.shiftKey || event.deltaMode !== 0) return;
  if (handled || Math.abs(event.deltaX) < Math.abs(event.deltaY) * 2 || !event.deltaX) return;

  for (const element of [...event.composedPath(), document.scrollingElement]) {
    if (!(element instanceof Element) || element.scrollWidth <= element.clientWidth + 1) continue;
    if (element === document.scrollingElement || /auto|scroll/.test(getComputedStyle(element).overflowX)) {
      handled = true;
      ipcRenderer.send('nova:trackpad-distance', 'back', 0);
      return;
    }
  }

  if (Math.sign(distance) !== Math.sign(event.deltaX)) distance = 0;
  distance += event.deltaX;
  const direction = distance < 0 ? 'back' : 'forward';
  ipcRenderer.send('nova:trackpad-distance', direction, Math.abs(distance));
  if (Math.abs(distance) >= 24 && indicated !== direction) {
    indicated = direction;
    ipcRenderer.send('nova:trackpad-history', direction, 'preview');
  }
}, { capture: true, passive: true });
