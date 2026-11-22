const { contextBridge, ipcRenderer } = require('electron');

let currentBackdrop;
let notifyBackdrop;
ipcRenderer.on('spotlight:backdrop', (_event, image) => {
  currentBackdrop = image;
  notifyBackdrop?.(image);
});

contextBridge.exposeInMainWorld('novaSpotlight', {
  close: () => ipcRenderer.send('spotlight:close'),
  backdrop: callback => {
    notifyBackdrop = callback;
    if (currentBackdrop) callback(currentBackdrop);
    return () => { if (notifyBackdrop === callback) notifyBackdrop = undefined; };
  }
});
