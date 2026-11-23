const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('nova', {
  read: () => ipcRenderer.invoke('browser:read'),
  act: (action, value) => ipcRenderer.invoke('browser:act', action, value),
  trayFilePath: file => webUtils.getPathForFile(file),
  addressSuggestions: query => ipcRenderer.invoke('browser:address-suggestions', query),
  addressPopup: data => ipcRenderer.send('browser:address-popup', data),
  addressSelection: callback => {
    const receive = (_event, value) => callback(value);
    ipcRenderer.on('browser:address-selection', receive);
    return () => ipcRenderer.removeListener('browser:address-selection', receive);
  },
  subscribe: (callback) => {
    const receive = (_event, state) => callback(state);
    ipcRenderer.on('browser:state', receive);
    return () => ipcRenderer.removeListener('browser:state', receive);
  },
  pageBackdrop: (callback) => {
    const receive = (_event, backdrop) => callback(backdrop);
    ipcRenderer.on('browser:page-backdrop', receive);
    return () => ipcRenderer.removeListener('browser:page-backdrop', receive);
  },
  mediaPopupClosed: (callback) => {
    const receive = () => callback();
    ipcRenderer.on('browser:media-popup-closed', receive);
    return () => ipcRenderer.removeListener('browser:media-popup-closed', receive);
  },
  expandTabPreview: (callback) => {
    const receive = (_event, point) => callback(point);
    ipcRenderer.on('browser:expand-tab-preview', receive);
    return () => ipcRenderer.removeListener('browser:expand-tab-preview', receive);
  },
  shortcut: (callback) => {
    const receive = (_event, shortcut) => callback(shortcut);
    ipcRenderer.on('browser:shortcut', receive);
    return () => ipcRenderer.removeListener('browser:shortcut', receive);
  }
});
