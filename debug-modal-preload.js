const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('debugModal', {
  close: () => ipcRenderer.send('debug-modal-close'),
});

contextBridge.exposeInMainWorld('debugAPI', {
  getDebugLogs: () => ipcRenderer.invoke('get-debug-logs'),
  onDebugLog: (cb) => {
    const fn = (_e, log) => cb(log);
    ipcRenderer.on('debug-log', fn);
    return () => ipcRenderer.removeListener('debug-log', fn);
  },
  runDiagnostics: (options) => ipcRenderer.invoke('run-diagnostics', options),
  onInit: (cb) => {
    const fn = (_e, data) => cb(data);
    ipcRenderer.on('debug-modal-init', fn);
    return () => ipcRenderer.removeListener('debug-modal-init', fn);
  },
});
