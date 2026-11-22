const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('addressPopup', {
  select: index => ipcRenderer.send('address-popup:select', index),
  backdrop: callback => ipcRenderer.on('address-popup:backdrop', (_event, image) => callback(image)),
  update: callback => ipcRenderer.on('address-popup:update', (_event, data) => callback(data))
});
