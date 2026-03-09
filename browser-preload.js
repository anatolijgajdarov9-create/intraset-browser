// Preload script for BrowserView instances (web pages).
// Runs in an isolated context (contextIsolation: true).
// Exposes __intraNotifSend to the page's main world so our
// executeJavaScript override of window.Notification can call it.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__intraNotifSend', (title, body, icon) => {
  try {
    ipcRenderer.send('browser-notification', {
      title: String(title || ''),
      body: String(body || ''),
      icon: icon ? String(icon) : null,
    });
  } catch (_) {}
});
