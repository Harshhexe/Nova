const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('novaTour', {
  step: (step, name) => ipcRenderer.invoke('tour:step', step, name),
  targets: () => ipcRenderer.invoke('tour:targets'),
  finish: () => ipcRenderer.invoke('tour:finish')
});
