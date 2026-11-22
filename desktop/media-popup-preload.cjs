const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mediaPopup', {
  subscribe: callback => ipcRenderer.on('media-popup:data', (_event, data) => callback(data)),
  act: (action, id) => ipcRenderer.send('media-popup:action', action, id),
  enter: () => ipcRenderer.send('media-popup:enter'),
  close: () => ipcRenderer.send('media-popup:close')
});
