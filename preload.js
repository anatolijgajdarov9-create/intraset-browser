const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Tab management
  createTab: (tabId, url) => ipcRenderer.invoke('create-tab', { tabId, url }),
  createPrivateTab: (tabId, url) => ipcRenderer.invoke('create-private-tab', { tabId, url }),
  switchTab: (tabId, isHome) => ipcRenderer.invoke('switch-tab', { tabId, isHome }),
  closeTab: (tabId) => ipcRenderer.invoke('close-tab', { tabId }),

  // Navigation
  navigate: (tabId, url) => ipcRenderer.invoke('navigate', { tabId, url }),
  goBack: (tabId) => ipcRenderer.invoke('go-back', { tabId }),
  goForward: (tabId) => ipcRenderer.invoke('go-forward', { tabId }),
  reload: (tabId) => ipcRenderer.invoke('reload', { tabId }),
  stopLoading: (tabId) => ipcRenderer.invoke('stop-loading', { tabId }),
  getCurrentUrl: (tabId) => ipcRenderer.invoke('get-current-url', { tabId }),
  goHome: (tabId) => ipcRenderer.invoke('go-home', { tabId }),

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // File dialog
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),

  // Event listeners (main → renderer)
  onTabNavigated: (cb) => ipcRenderer.on('tab-navigated', (_e, data) => cb(data)),
  onTabTitleUpdated: (cb) => ipcRenderer.on('tab-title-updated', (_e, data) => cb(data)),
  onTabFaviconUpdated: (cb) => ipcRenderer.on('tab-favicon-updated', (_e, data) => cb(data)),
  onTabLoading: (cb) => ipcRenderer.on('tab-loading', (_e, data) => cb(data)),
  onTabNavState: (cb) => ipcRenderer.on('tab-can-go-back', (_e, data) => cb(data)),
  onOpenNewTab: (cb) => ipcRenderer.on('open-new-tab', (_e, data) => cb(data)),

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  sidebarPanelToggled: (open) => ipcRenderer.invoke('sidebar-panel-toggled', { open }),

  // AI (node-llama-cpp — main process)
  aiGetStatus:    ()          => ipcRenderer.invoke('ai-get-status'),
  aiLoadModel:    (modelPath, serverPath, contextSize, gpuLayers) => ipcRenderer.invoke('ai-load-model', { modelPath, serverPath, contextSize, gpuLayers }),
  aiSetParams:    (temperature, topP) => ipcRenderer.invoke('ai-set-params', { temperature, topP }),
  aiUnloadModel:      ()          => ipcRenderer.invoke('ai-unload-model'),
  aiGetPageContent:   ()          => ipcRenderer.invoke('ai-get-page-content'),
  aiAnalyzePage:      (prompt)    => ipcRenderer.invoke('ai-analyze-page', { prompt }),
  aiChat:         (message)   => ipcRenderer.invoke('ai-chat', { message }),
  aiAbort:        ()          => ipcRenderer.send('ai-abort'),
  aiClearHistory: ()          => ipcRenderer.invoke('ai-clear-history'),
  aiAnalyzeSelection: (text, prompt) => ipcRenderer.invoke('ai-analyze-selection', { text, prompt }),
  aiWebSearch:    (query)     => ipcRenderer.invoke('ai-web-search', { query }),
  aiThinkResponse: (prompt)   => ipcRenderer.invoke('ai-think-response', { prompt }),
  aiFetchUrl:     (url)       => ipcRenderer.invoke('ai-fetch-url', { url }),
  aiScanModelsFolder: (folderPath) => ipcRenderer.invoke('ai-scan-models-folder', { folderPath }),
  aiEnsembleChat: (message, modelPaths, serverPath, contextSize, gpuLayers) =>
    ipcRenderer.invoke('ai-ensemble-chat', { message, modelPaths, serverPath, contextSize, gpuLayers }),
  // Возвращают функцию-отписку, чтобы не конфликтовали слушатели разных компонентов
  onAiToken:     (cb) => { const fn = (_e, t)   => cb(t);   ipcRenderer.on('ai-token',      fn); return () => ipcRenderer.removeListener('ai-token',      fn); },
  onAiDone:      (cb) => { const fn = ()        => cb();    ipcRenderer.on('ai-done',       fn); return () => ipcRenderer.removeListener('ai-done',       fn); },
  onAiError:     (cb) => { const fn = (_e, msg) => cb(msg); ipcRenderer.on('ai-error',      fn); return () => ipcRenderer.removeListener('ai-error',      fn); },
  onAiServerLog: (cb) => { const fn = (_e, t)   => cb(t);   ipcRenderer.on('ai-server-log', fn); return () => ipcRenderer.removeListener('ai-server-log', fn); },
  onAiSelectionRequest: (cb) => { const fn = (_e, data) => cb(data); ipcRenderer.on('ai-selection-request', fn); return () => ipcRenderer.removeListener('ai-selection-request', fn); },
  onAiThinkToken: (cb) => { const fn = (_e, t) => cb(t); ipcRenderer.on('ai-think-token', fn); return () => ipcRenderer.removeListener('ai-think-token', fn); },
  onAiEnsembleProgress: (cb) => { const fn = (_e, d) => cb(d); ipcRenderer.on('ai-ensemble-progress', fn); return () => ipcRenderer.removeListener('ai-ensemble-progress', fn); },
  onAiEnsembleModelDone: (cb) => { const fn = (_e, d) => cb(d); ipcRenderer.on('ai-ensemble-model-done', fn); return () => ipcRenderer.removeListener('ai-ensemble-model-done', fn); },

  // Browser-page notifications (intercepted from web pages via browser-preload.js)
  onBrowserNotification: (cb) => { const fn = (_e, data) => cb(data); ipcRenderer.on('browser-notification', fn); return () => ipcRenderer.removeListener('browser-notification', fn); },

  // Context menu actions from BrowserView
  onOpenPrivateTab: (cb) => { const fn = (_e, data) => cb(data); ipcRenderer.on('open-private-tab', fn); return () => ipcRenderer.removeListener('open-private-tab', fn); },

  openDevTools: () => ipcRenderer.invoke('open-devtools'),
  openBrowserMenu: (pos) => ipcRenderer.invoke('open-browser-menu', pos),
});
