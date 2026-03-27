const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] preload.js loaded');

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

  // External AI Providers (OpenAI, Anthropic, Google)
  aiGetProviders: () => ipcRenderer.invoke('ai-get-providers'),
  aiSetProvider: (provider) => ipcRenderer.invoke('ai-set-provider', { provider }),
  aiSetApiKey: (apiKey, provider = null) => ipcRenderer.invoke('ai-set-api-key', { provider, apiKey }),
  aiSetModel: (model) => ipcRenderer.invoke('ai-set-model', { model }),
  aiWebSearch: (query) => ipcRenderer.invoke('ai-web-search', { query }),
  aiWebSearchBing: (query) => ipcRenderer.invoke('ai-web-search-bing', { query }),
  aiGetProviderStatus: (provider) => ipcRenderer.invoke('ai-get-provider-status', { provider }),
  aiChatWithProvider: (message, model, options) => ipcRenderer.invoke('ai-chat-with-provider', { message, model, options }),
  // Provider streaming events
  onAiProviderToken: (cb) => { const fn = (_e, t) => cb(t); ipcRenderer.on('ai-provider-token', fn); return () => ipcRenderer.removeListener('ai-provider-token', fn); },
  onAiProviderDone: (cb) => { const fn = () => cb(); ipcRenderer.on('ai-provider-done', fn); return () => ipcRenderer.removeListener('ai-provider-done', fn); },
  onAiProviderError: (cb) => { const fn = (_e, msg) => cb(msg); ipcRenderer.on('ai-provider-error', fn); return () => ipcRenderer.removeListener('ai-provider-error', fn); },
  aiAbort:        ()          => ipcRenderer.send('ai-abort'),
  aiClearHistory: ()          => ipcRenderer.invoke('ai-clear-history'),
  // AI Chat History
  aiHistoryList: () => ipcRenderer.invoke('ai-history-list'),
  aiHistoryLoad: (sessionId) => ipcRenderer.invoke('ai-history-load', { sessionId }),
  aiHistorySave: (sessionId, messages, title, provider, model) => ipcRenderer.invoke('ai-history-save', { sessionId, messages, title, provider, model }),
  aiHistoryDelete: (sessionId) => ipcRenderer.invoke('ai-history-delete', { sessionId }),
  aiHistoryRename: (sessionId, title) => ipcRenderer.invoke('ai-history-rename', { sessionId, title }),
  aiHistoryGetCurrent: () => ipcRenderer.invoke('ai-history-get-current'),
  aiHistoryNewSession: () => ipcRenderer.invoke('ai-history-new-session'),
  aiAnalyzeSelection: (text, prompt) => ipcRenderer.invoke('ai-analyze-selection', { text, prompt }),
  aiWebSearch:    (query)     => ipcRenderer.invoke('ai-web-search', { query }),
  // aiThinkResponse: (prompt) => ipcRenderer.invoke('ai-think-response', { prompt }), // DISABLED: мышление отключено
  aiFetchUrl:     (url)       => ipcRenderer.invoke('ai-fetch-url', { url }),
  aiWikiSearch:   (query)     => ipcRenderer.invoke('ai-wiki-search', { query }),
  aiWikiPage:     (title)     => ipcRenderer.invoke('ai-wiki-page', { title }),
  aiScanModelsFolder: (folderPath) => ipcRenderer.invoke('ai-scan-models-folder', { folderPath }),
  aiEnsembleChat: (message, modelPaths, serverPath, contextSize, gpuLayers) =>
    ipcRenderer.invoke('ai-ensemble-chat', { message, modelPaths, serverPath, contextSize, gpuLayers }),
  // Возвращают функцию-отписку, чтобы не конфликтовали слушатели разных компонентов
  onAiToken:     (cb) => { const fn = (_e, t)   => cb(t);   ipcRenderer.on('ai-token',      fn); return () => ipcRenderer.removeListener('ai-token',      fn); },
  onAiDone:      (cb) => { const fn = ()        => cb();    ipcRenderer.on('ai-done',       fn); return () => ipcRenderer.removeListener('ai-done',       fn); },
  onAiError:     (cb) => { const fn = (_e, msg) => cb(msg); ipcRenderer.on('ai-error',      fn); return () => ipcRenderer.removeListener('ai-error',      fn); },
  onAiServerLog: (cb) => { const fn = (_e, t)   => cb(t);   ipcRenderer.on('ai-server-log', fn); return () => ipcRenderer.removeListener('ai-server-log', fn); },
  onAiSelectionRequest: (cb) => { const fn = (_e, data) => cb(data); ipcRenderer.on('ai-selection-request', fn); return () => ipcRenderer.removeListener('ai-selection-request', fn); },
  // onAiThinkToken: (cb) => { const fn = (_e, t) => cb(t); ipcRenderer.on('ai-think-token', fn); return () => ipcRenderer.removeListener('ai-think-token', fn); }, // DISABLED: мышление отключено
  onAiEnsembleProgress: (cb) => { const fn = (_e, d) => cb(d); ipcRenderer.on('ai-ensemble-progress', fn); return () => ipcRenderer.removeListener('ai-ensemble-progress', fn); },
  onAiEnsembleModelDone: (cb) => { const fn = (_e, d) => cb(d); ipcRenderer.on('ai-ensemble-model-done', fn); return () => ipcRenderer.removeListener('ai-ensemble-model-done', fn); },

  // Browser-page notifications (intercepted from web pages via browser-preload.js)
  onBrowserNotification: (cb) => { const fn = (_e, data) => cb(data); ipcRenderer.on('browser-notification', fn); return () => ipcRenderer.removeListener('browser-notification', fn); },

  // Context menu actions from BrowserView
  onOpenPrivateTab: (cb) => { const fn = (_e, data) => cb(data); ipcRenderer.on('open-private-tab', fn); return () => ipcRenderer.removeListener('open-private-tab', fn); },

  // AI Provider - clipboard check for image support detection
  aiCheckClipboard: () => ipcRenderer.invoke('ai-check-clipboard'),
  aiGetOpenRouterModels: () => ipcRenderer.invoke('ai-get-openrouter-models'),

  // Downloads
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  clearDownloads: () => ipcRenderer.invoke('clear-downloads'),
  onDownloadStarted: (cb) => { 
    console.log('[Preload-DBG] onDownloadStarted called - setting up listener');
    const fn = (_e, data) => { 
      console.log('[Preload-DBG] download-started RECEIVED:', JSON.stringify(data, null, 2)); 
      console.log('[Preload-DBG] Full event object keys:', Object.keys(_e));
      console.log('[Preload-DBG] ipcRenderer event listeners count:', ipcRenderer.listenerCount('download-started'));
      cb(data); 
    }; 
    console.log('[Preload-DBG] Setting up download-started listener');
    ipcRenderer.on('download-started', fn); 
    return () => { 
      console.log('[Preload-DBG] Removing download-started listener');
      ipcRenderer.removeListener('download-started', fn); 
    }; 
  },
  onDownloadUpdated: (cb) => { 
    console.log('[Preload-DBG] onDownloadUpdated called - setting up listener');
    const fn = (_e, data) => { 
      console.log('[Preload-DBG] download-updated RECEIVED:', JSON.stringify(data, null, 2)); 
      cb(data); 
    }; 
    console.log('[Preload-DBG] Setting up download-updated listener');
    ipcRenderer.on('download-updated', fn); 
    return () => { 
      console.log('[Preload-DBG] Removing download-updated listener');
      ipcRenderer.removeListener('download-updated', fn); 
    }; 
  },

  openDevTools: () => ipcRenderer.invoke('open-devtools'),
  openBrowserMenu: (pos) => ipcRenderer.invoke('open-browser-menu', pos),
  showInFolder: (downloadId) => ipcRenderer.invoke('show-in-folder', { downloadId }),
  removeDownload: (downloadId) => ipcRenderer.invoke('remove-download', { downloadId }),

  // Интрасеть (intraset-network)
  intraGetStatus: () => ipcRenderer.invoke('intra-get-status'),
  intraGetNodes: () => ipcRenderer.invoke('intra-get-nodes'),
  intraGetFiles: () => ipcRenderer.invoke('intra-get-files'),
  intraAddNode: (host, port, name) => ipcRenderer.invoke('intra-add-node', { host, port, name }),
  intraGetMessages: (contactId) => ipcRenderer.invoke('intra-get-messages', { contactId }),
  intraSendMessage: (receiverId, content) => ipcRenderer.invoke('intra-send-message', { receiverId, content }),
});
