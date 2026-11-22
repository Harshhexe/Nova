const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('addressPopup', {
  select: index => ipcRenderer.send('address-popup:select', index),
  update: callback => ipcRenderer.on('address-popup:update', (_event, data) => callback(data))
});
