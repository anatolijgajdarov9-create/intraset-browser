const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ctxMenu', {
  onShow: (cb) => ipcRenderer.on('ctx-show', (_e, data) => cb(data)),
  select: (action, payload) => ipcRenderer.send('ctx-select', { action, payload }),
  close: () => ipcRenderer.send('ctx-close'),
});
