const { app, BrowserWindow, BrowserView, ipcMain, shell, dialog, Menu, clipboard, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = !app.isPackaged;

console.log('[MAIN] App starting... isDev:', isDev, 'isPackaged:', app.isPackaged);

let mainWindow;
let browserViews = new Map(); // tabId -> BrowserView
let privateTabs = new Set();  // tabIds that are private (use ephemeral partition)
let activeTabId = null;
let sidebarPanelOpen = false;
let contextMenuWin = null;    // custom context menu overlay window
let debugModalWin = null;     // debug modal window

// Debug logs buffer
const debugLogs = [];
const MAX_DEBUG_LOGS = 500;

function addDebugLog(tag, message, level = 'info') {
  const log = { time: new Date().toLocaleTimeString('ru-RU'), tag, level, message };
  debugLogs.push(log);
  if (debugLogs.length > MAX_DEBUG_LOGS) debugLogs.shift();
  console.log('[DEBUG-LOG]', tag, message, '| Total logs:', debugLogs.length, '| Modal exists:', !!debugModalWin);
  if (debugModalWin && !debugModalWin.isDestroyed()) {
    console.log('[DEBUG-LOG] Sending to modal...');
    debugModalWin.webContents.send('debug-log', log);
  } else {
    console.log('[DEBUG-LOG] Modal not available');
  }
}

// Добавим тестовый лог при старте
console.log('[MAIN] Debug logs system initialized. debugLogs:', debugLogs.length);

// Downloads storage (global)
const downloads = new Map(); // downloadId -> { id, filename, url, savePath, receivedBytes, totalBytes, state, startTime }
let downloadIdCounter = 0;
const DOWNLOAD_DEBUG = true; // Включить диагностический лог для загрузок
let pendingSavePath = null;  // Ожидающий путь для сохранения изображения (save-image)

// Файл для сохранения загрузок
let downloadsFilePath = '';

function getDownloadsFilePath() {
  if (!downloadsFilePath) {
    downloadsFilePath = path.join(app.getPath('userData'), 'downloads.json');
    console.log('[Download-DBG] downloadsFilePath:', downloadsFilePath);
  }
  return downloadsFilePath;
}

function saveDownloadsToFile() {
  try {
    const data = {
      downloadIdCounter,
      downloads: Array.from(downloads.values())
    };
    fs.writeFileSync(getDownloadsFilePath(), JSON.stringify(data, null, 2));
    if (DOWNLOAD_DEBUG) console.log('[Download-DBG] Downloads saved to file, count:', downloads.size);
  } catch (err) {
    console.error('[Download-DBG] Error saving downloads:', err);
  }
}

function loadDownloadsFromFile() {
  try {
    const filePath = getDownloadsFilePath();
    console.log('[Download-DBG] Loading downloads from:', filePath);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      downloadIdCounter = data.downloadIdCounter || 0;
      data.downloads?.forEach(dl => downloads.set(dl.id, dl));
      console.log('[Download-DBG] Downloads loaded from file:', downloads.size);
    } else {
      console.log('[Download-DBG] No downloads file found');
    }
  } catch (err) {
    console.error('[Download-DBG] Error loading downloads:', err);
  }
}

console.log('[MAIN] Downloads Map initialized');

// ─── AI state (llama-server subprocess + HTTP streaming) ─────────────────────
const net            = require('net');
const http           = require('http');
const https          = require('https');
const { spawn }      = require('child_process');

let llamaServerProc  = null;
let llamaServerPort  = null;
let aiCurrentModelName = null;
let aiAbortCtrl      = null;
let aiHistory        = [];   // { role, content }[]
let llamaContextSize = 4096;
let aiTemperature   = 0.7;
let aiTopP          = 0.9;
let aiGenerating    = false;

// ─── External AI Provider Configuration ────────────────────────────────────────
const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    keyPrefix: 'sk-',
    needsModel: true
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    apiUrl: 'https://api.anthropic.com/v1/messages',
    keyPrefix: 'sk-ant-',
    needsModel: true
  },
  google: {
    name: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent',
    keyPrefix: 'AIza',
    needsModel: true
  },
  openrouter: {
    name: 'OpenRouter',
    models: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash', 'meta-llama/llama-3.1-70b-instruct'],
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    keyPrefix: 'sk-or-',
    needsModel: true
  }
};

// Auto-detect provider from API key
function detectProvider(apiKey) {
  const key = apiKey.trim();
  console.log('[AI Provider] Detecting from key:', key.slice(0, 15) + '...');
  
  // Check more specific prefixes first (longer = more specific)
  if (key.startsWith('sk-or-v1-') || key.startsWith('sk-or-')) {
    console.log('[AI Provider] Detected as openrouter (sk-or-v1-/sk-or-)');
    return 'openrouter';
  }
  if (key.startsWith('sk-ant-')) {
    console.log('[AI Provider] Detected as anthropic (sk-ant-)');
    return 'anthropic';
  }
  if (key.startsWith('AIza')) {
    console.log('[AI Provider] Detected as google (AIza)');
    return 'google';
  }
  
  // Then check shorter prefixes
  for (const [id, provider] of Object.entries(AI_PROVIDERS)) {
    if (provider.keyPrefix && key.startsWith(provider.keyPrefix)) {
      console.log('[AI Provider] Detected by prefix:', id, provider.name);
      return id;
    }
  }
  
  // Fallback: check by length/pattern
  if (key.startsWith('sk-') && key.length >= 48) {
    // Most likely OpenAI, but could also be other - default to openrouter
    console.log('[AI Provider] Defaulting to openrouter (generic sk- with 48+ chars)');
    return 'openrouter';
  }
  
  console.log('[AI Provider] Could not detect, returning null');
  return null;
}

let aiProviderConfig = {
  activeProvider: null,
  activeModel: null,
  apiKeys: {},
  enabled: false
};

function loadAiProviderConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'ai-providers.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      console.log('[AI Providers] Raw config file:', raw);
      const loaded = JSON.parse(raw);
      
      // Migration: fix incorrectly saved provider keys
      if (loaded.apiKeys && loaded.activeProvider) {
        const currentKey = loaded.apiKeys[loaded.activeProvider];
        if (currentKey) {
          const correctProvider = detectProvider(currentKey);
          if (correctProvider && correctProvider !== loaded.activeProvider) {
            console.log('[AI Providers] Migrating key from', loaded.activeProvider, 'to', correctProvider);
            loaded.apiKeys[correctProvider] = currentKey;
            delete loaded.apiKeys[loaded.activeProvider];
            loaded.activeProvider = correctProvider;
            // Also fix activeModel based on new provider
            if (AI_PROVIDERS[correctProvider]) {
              loaded.activeModel = AI_PROVIDERS[correctProvider].models[0];
            }
          }
        }
      }
      
      console.log('[AI Providers] Parsed config:', JSON.stringify(loaded));
      aiProviderConfig = { ...aiProviderConfig, ...loaded };
      console.log('[AI Providers] Merged, activeProvider:', aiProviderConfig.activeProvider, 'apiKeys:', Object.keys(aiProviderConfig.apiKeys));
    } else {
      console.log('[AI Providers] Config file not found');
    }
  } catch (e) { console.error('[AI Providers] Load error:', e.message); }
}

function saveAiProviderConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'ai-providers.json');
    fs.writeFileSync(configPath, JSON.stringify(aiProviderConfig, null, 2));
  } catch (e) { console.error('[AI Providers] Save error:', e.message); }
}

// ─── AI Chat History Management ────────────────────────────────────────────────
const AI_HISTORY_DIR = path.join(app.getPath('userData'), 'ai-history');
const MAX_HISTORY_FILES = 50;
const MAX_MESSAGES_PER_SESSION = 100;
const MAX_CHARS_PER_SESSION = 500000;

function ensureHistoryDir() {
  if (!fs.existsSync(AI_HISTORY_DIR)) {
    fs.mkdirSync(AI_HISTORY_DIR, { recursive: true });
  }
}

function getHistoryFilePath(sessionId) {
  return path.join(AI_HISTORY_DIR, `${sessionId}.json`);
}

function listChatSessions() {
  ensureHistoryDir();
  try {
    const files = fs.readdirSync(AI_HISTORY_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(AI_HISTORY_DIR, f);
        const stats = fs.statSync(filePath);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          return {
            id: f.replace('.json', ''),
            title: data.title || 'Без названия',
            preview: data.messages?.[0]?.text?.slice(0, 60) || '',
            messageCount: data.messages?.length || 0,
            createdAt: data.createdAt || stats.birthtime.getTime(),
            updatedAt: data.updatedAt || stats.mtime.getTime(),
            provider: data.provider || null,
            model: data.model || null
          };
        } catch {
          return { id: f.replace('.json', ''), title: 'Повреждён', preview: '', messageCount: 0, createdAt: stats.birthtime.getTime(), updatedAt: stats.mtime.getTime() };
        }
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
    
    // Cleanup old files if over limit
    if (files.length > MAX_HISTORY_FILES) {
      const toDelete = files.slice(MAX_HISTORY_FILES);
      for (const f of toDelete) {
        try { fs.unlinkSync(path.join(AI_HISTORY_DIR, `${f.id}.json`)); } catch (_) {}
      }
    }
    
    return files.slice(0, MAX_HISTORY_FILES);
  } catch (e) {
    console.error('[AI History] List error:', e.message);
    return [];
  }
}

function saveChatSession(sessionId, messages, title, provider, model) {
  ensureHistoryDir();
  
  // Trim messages if too many
  let trimmedMessages = messages;
  let totalChars = messages.reduce((s, m) => s + (m.text?.length || 0), 0);
  
  while (trimmedMessages.length > MAX_MESSAGES_PER_SESSION || totalChars > MAX_CHARS_PER_SESSION) {
    // Remove oldest non-system messages (keep first 2 as context)
    if (trimmedMessages.length > 4) {
      trimmedMessages = [trimmedMessages[0], trimmedMessages[1], ...trimmedMessages.slice(2, -2), trimmedMessages[trimmedMessages.length - 1]];
      totalChars = trimmedMessages.reduce((s, m) => s + (m.text?.length || 0), 0);
    } else {
      break;
    }
  }
  
  const sessionData = {
    id: sessionId,
    title: title || `Чат ${new Date().toLocaleDateString('ru-RU')}`,
    messages: trimmedMessages,
    provider,
    model,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  try {
    fs.writeFileSync(getHistoryFilePath(sessionId), JSON.stringify(sessionData, null, 2));
    return { success: true };
  } catch (e) {
    console.error('[AI History] Save error:', e.message);
    return { success: false, error: e.message };
  }
}

function loadChatSession(sessionId) {
  try {
    const filePath = getHistoryFilePath(sessionId);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return { success: true, session: data };
    }
    return { success: false, error: 'Сессия не найдена' };
  } catch (e) {
    console.error('[AI History] Load error:', e.message);
    return { success: false, error: e.message };
  }
}

function deleteChatSession(sessionId) {
  try {
    const filePath = getHistoryFilePath(sessionId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return { success: true };
  } catch (e) {
    console.error('[AI History] Delete error:', e.message);
    return { success: false, error: e.message };
  }
}

function renameChatSession(sessionId, newTitle) {
  try {
    const filePath = getHistoryFilePath(sessionId);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      data.title = newTitle;
      data.updatedAt = Date.now();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return { success: true };
    }
    return { success: false, error: 'Сессия не найдена' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

loadAiProviderConfig();

function getFreePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
  });
}

async function unloadAiModel() {
  if (aiAbortCtrl) { try { aiAbortCtrl.abort(); } catch (_) {} aiAbortCtrl = null; }
  if (llamaServerProc) { try { llamaServerProc.kill(); } catch (_) {} llamaServerProc = null; }
  llamaServerPort = null;
  aiCurrentModelName = null;
  aiHistory = [];
  aiGenerating = false;
}

// ─── Helper: run one model for a single non-streaming inference ──────────────
// Spawns llama-server, waits for ready, sends one /v1/chat/completions request
// (stream:false), collects the full response, kills the server, returns text.
async function runModelOnce(modelPath, resolvedSrv, messages, contextSize, gpuLayers, onServerReady) {
  const port = await getFreePort();
  return new Promise((resolve) => {
    let proc;
    const srvDir = path.dirname(resolvedSrv);
    try {
      proc = spawn(
        resolvedSrv,
        ['-m', modelPath, '--port', String(port), '-c', String(contextSize || 4096),
         '--n-gpu-layers', String(gpuLayers != null ? gpuLayers : 0)],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          cwd: srvDir,
          env: { ...process.env, PATH: srvDir + path.delimiter + (process.env.PATH || '') }
        }
      );
    } catch (err) {
      resolve({ success: false, text: '', error: err.message });
      return;
    }

    let started = false;
    let settled = false;
    const cleanup = () => { try { proc.kill(); } catch (_) {} };

    const doInference = () => {
      if (started) return;
      started = true;
      try { if (onServerReady) onServerReady(); } catch (_) {}
      const body = JSON.stringify({
        messages, stream: false, max_tokens: 1200,
        temperature: aiTemperature, top_p: aiTopP
      });
      const req = http.request({
        hostname: '127.0.0.1', port, path: '/v1/chat/completions', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 180000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk.toString());
        res.on('end', () => {
          if (settled) return; settled = true;
          try {
            const parsed = JSON.parse(data);
            const text = parsed.choices?.[0]?.message?.content || '';
            resolve({ success: true, text });
          } catch { resolve({ success: false, text: '', error: 'Ошибка разбора ответа' }); }
          cleanup();
        });
        res.on('error', (e) => {
          if (settled) return; settled = true;
          resolve({ success: false, text: '', error: e.message });
          cleanup();
        });
      });
      req.on('error', (e) => {
        if (settled) return; settled = true;
        resolve({ success: false, text: '', error: e.message });
        cleanup();
      });
      req.write(body);
      req.end();
    };

    const handleOutput = (data) => {
      const text = data.toString();
      if (!started && (
        text.includes('HTTP server listening') ||
        text.includes('server is listening') ||
        text.includes('all slots are idle') ||
        text.includes('model loaded')
      )) doInference();
    };
    proc.stdout.on('data', handleOutput);
    proc.stderr.on('data', handleOutput);
    proc.on('error', (err) => {
      if (!settled) { settled = true; resolve({ success: false, text: '', error: err.message }); }
    });
    proc.on('exit', (code) => {
      if (!settled) { settled = true; resolve({ success: false, text: '', error: `Процесс завершился (код ${code})` }); }
    });

    const pollHealth = () => {
      if (started || !proc) return;
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) doInference();
        else setTimeout(pollHealth, 1000);
        res.resume();
      });
      req.on('error', () => setTimeout(pollHealth, 1000));
      req.end();
    };
    setTimeout(pollHealth, 3000);

    setTimeout(() => {
      if (!settled) { settled = true; resolve({ success: false, text: '', error: 'Таймаут загрузки модели (120с)' }); cleanup(); }
    }, 120000);
  });
}

// Размеры UI (должны совпадать с CSS-переменными в index.css)
const SIDEBAR_WIDTH   = 56;
const SIDEBAR_PANEL_W = 320;
const TABBAR_HEIGHT   = 38;
const NAVBAR_HEIGHT   = 46;

function createMainWindow() {
  console.log('[MAIN] createMainWindow called');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, 'intrabrowser-logo.ico'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
  });

  let shown = false;
  const tryShow = () => {
    if (!shown && mainWindow && !mainWindow.isDestroyed()) {
      shown = true;
      console.log('[MAIN] MainWindow ready to show!');
      mainWindow.show();
    }
  };

  mainWindow.once('ready-to-show', tryShow);
  mainWindow.webContents.once('did-finish-load', tryShow);

  if (isDev) {
    console.log('[MAIN] Loading dev URL: http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
  } else {
    console.log('[MAIN] Loading prod file:', path.join(__dirname, 'build', 'index.html'));
    mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    browserViews.clear();
  });

  // Глобальный обработчик загрузок для всех сессий (включая домашнюю страницу)
  mainWindow.webContents.session.on('will-download', (event, item) => {
    console.log('[Download-DBG] ★★★ GLOBAL will-download EVENT FIRED ★★★ item:', item.getFilename());
    const tabId = activeTabId || 'home';
    try {
      const downloadId = `dl-${++downloadIdCounter}`;
      const filename = item.getFilename();
      const url = item.getURL();
      const totalBytes = item.getTotalBytes();
      
      if (pendingSavePath) {
        if (DOWNLOAD_DEBUG) console.log('[Download-DBG] will-download: save-image detected, applying pendingSavePath:', pendingSavePath);
        item.setSavePath(pendingSavePath);
        pendingSavePath = null;
      }
      
      const dl = {
        id: downloadId,
        filename,
        url,
        savePath: null,
        receivedBytes: 0,
        totalBytes: totalBytes || 0,
        state: 'progressing',
        startTime: Date.now(),
      };
      downloads.set(downloadId, dl);
      saveDownloadsToFile();
      console.log('[Download-DBG] Download added to Map. Total downloads:', downloads.size, 'download:', dl);

      // Отправляем событие сразу и через setImmediate
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-started', { tabId, download: dl });
        console.log('[Download-DBG] download-started sent (direct)');
        setImmediate(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download-started', { tabId, download: dl });
            console.log('[Download-DBG] download-started sent (setImmediate)');
          }
        });
      }

      item.on('updated', (e, state) => {
        dl.receivedBytes = item.getReceivedBytes();
        dl.totalBytes = item.getTotalBytes();
        dl.state = state === 'completed' ? 'completed' : 'progressing';
        if (mainWindow && !mainWindow.isDestroyed()) {
          setImmediate(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('download-updated', { tabId, download: dl });
            }
          });
        }
      });

      item.on('done', (e, state) => {
        dl.receivedBytes = item.getReceivedBytes();
        dl.totalBytes = item.getTotalBytes();
        dl.state = state === 'completed' ? 'completed' : (state === 'cancelled' ? 'cancelled' : 'interrupted');
        dl.savePath = item.getSavePath();
        saveDownloadsToFile();
        if (mainWindow && !mainWindow.isDestroyed()) {
          setImmediate(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('download-updated', { tabId, download: dl });
            }
          });
        }
      });
    } catch (err) {
      console.error('[Download] error:', err);
    }
  });

  mainWindow.on('resize', () => {
    if (activeTabId && browserViews.has(activeTabId)) {
      resizeBrowserView(browserViews.get(activeTabId));
    }
  });
}

function resizeBrowserView(view) {
  if (!mainWindow || !view) return;
  const [winWidth, winHeight] = mainWindow.getContentSize();
  const headerHeight = TABBAR_HEIGHT + NAVBAR_HEIGHT;
  const xOffset = SIDEBAR_WIDTH + (sidebarPanelOpen ? SIDEBAR_PANEL_W : 0);
  view.setBounds({
    x: xOffset,
    y: headerHeight,
    width: winWidth - xOffset,
    height: winHeight - headerHeight
  });
}

function setupBrowserViewEvents(view, tabId) {
  console.log('[Download-DBG] setupBrowserViewEvents called for tabId:', tabId);
  view.webContents.on('did-navigate', (_e, navUrl) => {
    mainWindow.webContents.send('tab-navigated', { tabId, url: navUrl });
  });
  view.webContents.on('did-navigate-in-page', (_e, navUrl) => {
    mainWindow.webContents.send('tab-navigated', { tabId, url: navUrl });
  });
  view.webContents.on('page-title-updated', (_e, title) => {
    mainWindow.webContents.send('tab-title-updated', { tabId, title });
  });
  view.webContents.on('page-favicon-updated', (_e, favicons) => {
    mainWindow.webContents.send('tab-favicon-updated', { tabId, favicon: favicons[0] });
  });
  view.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('tab-loading', { tabId, loading: true });
  });
  view.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('tab-loading', { tabId, loading: false });
  });
  view.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('tab-can-go-back', {
      tabId,
      canGoBack: view.webContents.canGoBack(),
      canGoForward: view.webContents.canGoForward()
    });
  });

  // Downloads handling - используем session-level обработчик
  console.log('[Download-DBG] Setting up will-download listener for tabId:', tabId);
  view.webContents.session.on('will-download', (event, item) => {
    console.log('[Download-DBG] ★★★ SESSION will-download EVENT FIRED ★★★ for tabId:', tabId, 'item:', item.getFilename());
    console.log('[Download-DBG] mainWindow webContents isReady:', mainWindow?.webContents?.isLoading?.() === false ? 'ready' : 'not ready');
    try {
      const downloadId = `dl-${++downloadIdCounter}`;
      const filename = item.getFilename();
      const url = item.getURL();
      const totalBytes = item.getTotalBytes();
      
      // Если есть ожидающий путь сохранения (save-image), используем его
      if (pendingSavePath) {
        if (DOWNLOAD_DEBUG) console.log('[Download-DBG] will-download: save-image detected, applying pendingSavePath:', pendingSavePath);
        item.setSavePath(pendingSavePath);
        dl.savePath = pendingSavePath;
        pendingSavePath = null; // Сбрасываем после использования
      }
      
      if (DOWNLOAD_DEBUG) {
        console.log('[Download-DBG] will-download:', { filename, url, totalBytes, tabId });
        console.log('[Download-DBG] mainWindow exists:', !!mainWindow, 'isDestroyed:', mainWindow?.isDestroyed());
      }

      const dl = {
        id: downloadId,
        filename,
        url,
        savePath: null,
        receivedBytes: 0,
        totalBytes: totalBytes || 0,
        state: 'progressing',
        startTime: Date.now(),
      };
      downloads.set(downloadId, dl);
      saveDownloadsToFile();
      console.log('[Download-DBG] Download added to Map. Total downloads:', downloads.size, 'Download:', dl);

      console.log('[Download-DBG] About to send download-started. mainWindow:', !!mainWindow, 'isDestroyed:', mainWindow?.isDestroyed?.() || 'N/A');
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (DOWNLOAD_DEBUG) console.log('[Download-DBG] Sending download-started event');
        // Используем setImmediate для гарантии что событие отправится после загрузки страницы
        setImmediate(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download-started', { tabId, download: dl });
            console.log('[Download-DBG] download-started sent via setImmediate');
          }
        });
      } else {
        if (DOWNLOAD_DEBUG) console.log('[Download-DBG] CANNOT send - mainWindow is null or destroyed');
      }

      item.on('updated', (e, state) => {
        dl.receivedBytes = item.getReceivedBytes();
        dl.totalBytes = item.getTotalBytes();
        dl.state = state === 'completed' ? 'completed' : 'progressing';
        if (DOWNLOAD_DEBUG) console.log('[Download-DBG] updated:', dl.receivedBytes, '/', dl.totalBytes, 'state:', state);
        if (mainWindow && !mainWindow.isDestroyed()) {
          setImmediate(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('download-updated', { tabId, download: dl });
            }
          });
        }
      });

      item.on('done', (e, state) => {
        dl.receivedBytes = item.getReceivedBytes();
        dl.totalBytes = item.getTotalBytes();
        dl.state = state === 'completed' ? 'completed' : (state === 'cancelled' ? 'cancelled' : 'interrupted');
        dl.savePath = item.getSavePath();
        if (DOWNLOAD_DEBUG) console.log('[Download-DBG] done:', filename, state, 'savePath:', dl.savePath);
        saveDownloadsToFile();
        if (mainWindow && !mainWindow.isDestroyed()) {
          setImmediate(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('download-updated', { tabId, download: dl });
            }
          });
        }
      });
    } catch (err) {
      console.error('[Download] error:', err);
    }
  });

  view.webContents.setWindowOpenHandler(({ url }) => {
    mainWindow.webContents.send('open-new-tab', { url });
    return { action: 'deny' };
  });

  // ─── Контекстное меню (правая кнопка мыши) — кастомное overlay-окно ─────
  view.webContents.on('context-menu', (_e, params) => {
    const items = [];

    // Навигация
    items.push(
      { type: 'item', label: 'Назад',       enabled: view.webContents.canGoBack(),    action: 'go-back' },
      { type: 'item', label: 'Вперёд',      enabled: view.webContents.canGoForward(), action: 'go-forward' },
      { type: 'item', label: 'Перезагрузить', enabled: true,                          action: 'reload' },
      { type: 'separator' }
    );

    if (params.linkURL) {
      items.push(
        { type: 'item', label: 'Открыть в новой вкладке',     action: 'open-new-tab',     payload: { url: params.linkURL } },
        { type: 'item', label: 'Открыть в приватной вкладке', action: 'open-private-tab', payload: { url: params.linkURL } },
        { type: 'item', label: 'Копировать ссылку',           action: 'copy-link',        payload: { url: params.linkURL } },
        { type: 'separator' }
      );
    }

    if (params.mediaType === 'image' && params.srcURL) {
      items.push(
        { type: 'item', label: 'Сохранить изображение', action: 'save-image', payload: { url: params.srcURL } },
        { type: 'separator' }
      );
    }

    if (params.selectionText) {
      const snippet = params.selectionText.slice(0, 20) + (params.selectionText.length > 20 ? '…' : '');
      items.push(
        { type: 'item', label: 'Копировать',          action: 'copy' },
        { type: 'item', label: `Найти «${snippet}»`,  action: 'search-text', payload: { text: params.selectionText } },
        {
          type: 'submenu', label: 'AI анализ текста', iconKey: 'ai-analyze', isAi: true, enabled: true,
          children: [
            { label: 'Резюмировать',    action: 'ai-summarize-selection', iconKey: 'ai-summarize', payload: { text: params.selectionText } },
            { label: 'Ключевые тезисы', action: 'ai-theses-selection',    iconKey: 'ai-theses',    payload: { text: params.selectionText } },
            { label: 'Объяснить',       action: 'ai-explain-selection',   iconKey: 'ai-explain',   payload: { text: params.selectionText } },
            { label: 'Перевести',       action: 'ai-translate-selection', iconKey: 'ai-translate', payload: { text: params.selectionText } },
            { label: 'Найти информацию', action: 'ai-search-selection',   iconKey: 'ai-search',    payload: { text: params.selectionText } },
            { label: 'Улучшить стиль',  action: 'ai-improve-selection',  iconKey: 'ai-improve',   payload: { text: params.selectionText } },
            { label: 'Сократить',       action: 'ai-shorten-selection',   iconKey: 'ai-shorten',   payload: { text: params.selectionText } },
            { label: 'Расширить',       action: 'ai-expand-selection',    iconKey: 'ai-expand',   payload: { text: params.selectionText } },
            { label: 'Объяснить код',   action: 'ai-code-selection',     iconKey: 'ai-code',     payload: { text: params.selectionText } },
            { label: 'Извлечь данные',  action: 'ai-extract-selection',  iconKey: 'ai-extract',  payload: { text: params.selectionText } },
          ]
        },
        { type: 'separator' }
      );
    }

    if (params.isEditable) {
      items.push(
        { type: 'item', label: 'Вырезать',  action: 'cut' },
        { type: 'item', label: 'Копировать', action: 'copy' },
        { type: 'item', label: 'Вставить',  action: 'paste' },
        { type: 'separator' }
      );
    }

    items.push(
      { type: 'item', label: 'Копировать URL страницы',   action: 'copy-url' },
      { type: 'separator' },
      { type: 'item', label: 'Просмотр кода страницы',    action: 'devtools' },
      { type: 'item', label: 'Отладка и диагностика',    action: 'open-debug-modal' }
    );

    // Размер окна-меню
    const ITEM_H = 34, SEP_H = 9, PAD = 10, SHADOW = 16;
    const contentH = items.reduce((h, it) => h + (it.type === 'separator' ? SEP_H : ITEM_H), PAD);
    const winH = contentH + SHADOW;
    const hasSubmenu = items.some(it => it.type === 'submenu' && it.children?.length);
    const winW = hasSubmenu ? 520 : 290;

    // Абсолютные координаты на экране
    const [wx, wy] = mainWindow.getPosition();
    const vb = view.getBounds();
    let mx = wx + vb.x + params.x;
    let my = wy + vb.y + params.y;

    // Не выходить за пределы экрана
    const disp = screen.getDisplayNearestPoint({ x: mx, y: my });
    const wa = disp.workArea;
    if (mx + winW > wa.x + wa.width)  mx = wa.x + wa.width - winW;
    if (my + winH > wa.y + wa.height) my = my - winH;
    if (mx < wa.x) mx = wa.x;
    if (my < wa.y) my = wa.y;

    if (contextMenuWin && !contextMenuWin.isDestroyed()) contextMenuWin.destroy();

    contextMenuWin = new BrowserWindow({
      width: winW, height: winH,
      x: Math.round(mx), y: Math.round(my),
      frame: false, transparent: true,
      alwaysOnTop: true, skipTaskbar: true,
      resizable: false, movable: false,
      show: false,
      webPreferences: {
        nodeIntegration: false, contextIsolation: true,
        preload: path.join(__dirname, 'context-menu-preload.js')
      }
    });

    contextMenuWin.loadFile(path.join(__dirname, 'context-menu.html'));
    contextMenuWin.once('ready-to-show', () => {
      contextMenuWin.show();
      contextMenuWin.webContents.send('ctx-show', items);
    });
    contextMenuWin.on('blur', () => {
      if (contextMenuWin && !contextMenuWin.isDestroyed()) { contextMenuWin.destroy(); contextMenuWin = null; }
    });
  });

  // Override window.Notification in the page's main world so that
  // web notifications are captured and forwarded to the UI.
  view.webContents.on('dom-ready', () => {
    view.webContents.executeJavaScript(`
      (function() {
        if (!window.__intraNotifSend) return;
        function IntraNotification(title, opts) {
          window.__intraNotifSend(
            title != null ? String(title) : '',
            (opts && opts.body) != null ? String(opts.body) : '',
            (opts && opts.icon) ? String(opts.icon) : null
          );
        }
        IntraNotification.permission = 'granted';
        IntraNotification.requestPermission = function() { return Promise.resolve('granted'); };
        IntraNotification.prototype.close = function() {};
        IntraNotification.prototype.addEventListener = function() {};
        IntraNotification.prototype.removeEventListener = function() {};
        try {
          Object.defineProperty(window, 'Notification', { value: IntraNotification, configurable: true, writable: true });
        } catch(_) { window.Notification = IntraNotification; }
      })();
    `).catch(() => {});
  });
}

function createBrowserView(tabId, url, extraPrefs = {}) {
  addDebugLog('BrowserView', `Создание BrowserView для tab: ${tabId}, url: ${url}`, 'info');
  
  const view = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      preload: path.join(__dirname, 'browser-preload.js'),
      ...extraPrefs
    }
  });

  // Log any errors during page load
  view.webContents.on('did-fail-load', (_e, errorCode, errorDesc) => {
    console.log('[BrowserView] Failed to load:', errorCode, errorDesc);
  });
  view.webContents.on('render-process-gone', (_e, details) => {
    console.log('[BrowserView] Render process gone:', details.reason);
  });
  view.webContents.on('crashed', () => {
    console.log('[BrowserView] Renderer crashed');
  });
  
  // BrowserView использует системные настройки прокси, которые могут быть недоступны.
  // Принудительно используем прямое соединение для избежания ERR_PROXY_CONNECTION_FAILED
  view.webContents.session.setProxy({ proxyRules: 'direct://' });

  browserViews.set(tabId, view);
  setupBrowserViewEvents(view, tabId);

  // Skip loading for internal URLs (intra://)
  if (url && url.startsWith('intra://')) {
    console.log('[BrowserView] Skipping internal URL:', url);
    return view;
  }
  
  if (url && url !== 'intra://home') {
    console.log('[BrowserView] Loading URL:', url);
    view.webContents.loadURL(url);
  }

  return view;
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('create-tab', (_event, { tabId, url }) => {
  // Домашние вкладки не получают BrowserView — React UI отображается напрямую
  if (url === 'intra://home') {
    return { success: true };
  }
  const view = createBrowserView(tabId, url);
  mainWindow.addBrowserView(view);
  mainWindow.setTopBrowserView(view);
  resizeBrowserView(view);
  activeTabId = tabId;
  return { success: true };
});

// Приватная вкладка — отдельная ephemeral partition
ipcMain.handle('create-private-tab', (_event, { tabId, url }) => {
  privateTabs.add(tabId);
  if (url === 'intra://home') {
    return { success: true };
  }
  const view = createBrowserView(tabId, url, { partition: `private-${tabId}` });
  mainWindow.addBrowserView(view);
  mainWindow.setTopBrowserView(view);
  resizeBrowserView(view);
  activeTabId = tabId;
  return { success: true };
});

ipcMain.handle('switch-tab', (_event, { tabId, isHome }) => {
  // Убираем все BrowserViews с экрана
  browserViews.forEach((view) => {
    try { mainWindow.removeBrowserView(view); } catch (_) {}
  });

  activeTabId = tabId;

  // Показываем BrowserView только для не-домашних вкладок
  if (!isHome) {
    const view = browserViews.get(tabId);
    if (view) {
      mainWindow.addBrowserView(view);
      mainWindow.setTopBrowserView(view);
      resizeBrowserView(view);
    }
  }

  return { success: true };
});

ipcMain.handle('close-tab', (_event, { tabId }) => {
  const view = browserViews.get(tabId);
  if (view) {
    try { mainWindow.removeBrowserView(view); } catch (_) {}
    view.webContents.destroy();
    browserViews.delete(tabId);
  }
  privateTabs.delete(tabId);
  return { success: true };
});

ipcMain.handle('navigate', (_event, { tabId, url }) => {
  addDebugLog('Navigate', `Переход на: ${url}`, 'info');
  const view = browserViews.get(tabId);
  if (!view) {
    const extraPrefs = privateTabs.has(tabId) ? { partition: `private-${tabId}` } : {};
    const newView = createBrowserView(tabId, url, extraPrefs);
    mainWindow.addBrowserView(newView);
    mainWindow.setTopBrowserView(newView);
    resizeBrowserView(newView);
    activeTabId = tabId;
  } else {
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
      const isUrl = /^[\w.-]+\.[a-z]{2,}(\/.*)?$/.test(url) || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url);
      finalUrl = isUrl ? `http://${url}` : `https://yandex.ru/search/?text=${encodeURIComponent(url)}`;
    }
    addDebugLog('Navigate', `Загрузка URL: ${finalUrl}`, 'info');
    view.webContents.loadURL(finalUrl);
    mainWindow.addBrowserView(view);
    mainWindow.setTopBrowserView(view);
    resizeBrowserView(view);
    activeTabId = tabId;
  }
  return { success: true };
});

ipcMain.handle('go-back', (_event, { tabId }) => {
  const view = browserViews.get(tabId);
  if (view && view.webContents.canGoBack()) view.webContents.goBack();
  return { success: true };
});

ipcMain.handle('go-forward', (_event, { tabId }) => {
  const view = browserViews.get(tabId);
  if (view && view.webContents.canGoForward()) view.webContents.goForward();
  return { success: true };
});

ipcMain.handle('reload', (_event, { tabId }) => {
  const view = browserViews.get(tabId);
  if (view) view.webContents.reload();
  return { success: true };
});

ipcMain.handle('stop-loading', (_event, { tabId }) => {
  const view = browserViews.get(tabId);
  if (view) view.webContents.stop();
  return { success: true };
});

ipcMain.handle('get-current-url', (_event, { tabId }) => {
  const view = browserViews.get(tabId);
  return view ? view.webContents.getURL() : '';
});

// Debug logs IPC
ipcMain.handle('get-debug-logs', () => {
  console.log('[get-debug-logs] Returning', debugLogs.length, 'logs');
  return debugLogs;
});

ipcMain.handle('run-diagnostics', async (_event, { type, tests }) => {
  const results = [];
  for (const testId of tests) {
    let status = 'ok';
    let message = 'Проверка пройдена';
    try {
      switch (testId) {
        case 'browserView':
          const view = browserViews.get(activeTabId);
          if (!view) { status = 'error'; message = 'Нет активного BrowserView'; }
          else if (view.webContents.isDestroyed()) { status = 'error'; message = 'BrowserView уничтожен'; }
          else message = `Загружена: ${view.webContents.getURL() || 'URL не определён'}`;
          break;
        case 'network': message = 'Сетевое подключение активно'; break;
        case 'proxy': message = 'Прокси: direct:// (прямое соединение)'; break;
        case 'downloads': message = `Активных загрузок: ${downloads.size}`; break;
        case 'ai': message = 'Проверьте статус AI на главной странице'; break;
        case 'memory':
          const memUsage = process.memoryUsage();
          message = `Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`;
          break;
      }
    } catch (e) { status = 'error'; message = e.message; }
    results.push({ id: testId, status, message });
  }
  return { success: true, results };
});

// Диалог выбора файла
ipcMain.handle('show-open-dialog', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// Window controls
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

ipcMain.on('open-external', (_event, url) => shell.openExternal(url));

ipcMain.handle('go-home', (_event, { tabId }) => {
  browserViews.forEach((v) => {
    try { mainWindow.removeBrowserView(v); } catch (_) {}
  });
  activeTabId = tabId;
  return { success: true };
});

ipcMain.handle('sidebar-panel-toggled', (_event, { open }) => {
  sidebarPanelOpen = open;
  if (activeTabId && browserViews.has(activeTabId)) {
    resizeBrowserView(browserViews.get(activeTabId));
  }
  return { success: true };
});

// ─── AI IPC (llama-server subprocess + HTTP streaming) ───────────────────────

ipcMain.handle('ai-get-status', () => ({
  loaded: llamaServerProc !== null,
  modelName: aiCurrentModelName || null,
  contextSize: llamaContextSize,
  generating: aiGenerating,
}));

ipcMain.handle('ai-set-params', (_event, { temperature, topP }) => {
  if (temperature != null) aiTemperature = Number(temperature);
  if (topP        != null) aiTopP        = Number(topP);
  return { success: true };
});

ipcMain.handle('ai-load-model', async (_event, { modelPath, serverPath, contextSize, gpuLayers }) => {
  await unloadAiModel();
  const mdlPath = path.normalize(modelPath);
  // Use serverPath only if it's a non-empty string pointing to an existing file
  const srvPath = serverPath ? path.normalize(serverPath) : '';
  console.log('[AI] Загрузка модели:', mdlPath);

  // Fallback to bundled binary — try several locations in priority order
  const srvCandidates = [
    // 1. Packaged app: extraResources lands in process.resourcesPath
    path.join(process.resourcesPath || '', 'llama server', 'llama-server.exe'),
    // 2. Packaged app alternative: resources/ next to the exe
    path.join(path.dirname(app.getPath('exe')), 'resources', 'llama server', 'llama-server.exe'),
    // 3. Dev / unpacked: next to main.js (__dirname)
    path.join(__dirname, 'llama server', 'llama-server.exe'),
  ];
  const bundledSrv = srvCandidates.find(p => fs.existsSync(p)) || srvCandidates[0];
  console.log('[AI] isDev:', isDev, '| resourcesPath:', process.resourcesPath);
  console.log('[AI] llama-server search paths:', srvCandidates);
  console.log('[AI] resolved bundledSrv:', bundledSrv, '| exists:', fs.existsSync(bundledSrv));

  const isValidSrv = srvPath && srvPath !== '.' && srvPath !== mdlPath
    && !srvPath.toLowerCase().endsWith('.gguf') && fs.existsSync(srvPath);
  const resolvedSrv = isValidSrv ? srvPath
    : fs.existsSync(bundledSrv) ? bundledSrv
    : '';

  if (!fs.existsSync(mdlPath))
    return { success: false, error: `Файл модели не найден:\n${mdlPath}` };
  if (!fs.existsSync(resolvedSrv))
    return { success: false, error: `llama-server не найден.\nПроверенные пути:\n${srvCandidates.join('\n')}` };

  const port = await getFreePort();
  console.log('[AI] Запуск llama-server на порту', port);

  return new Promise((resolve) => {
    let resolved = false;

    console.log('[AI] Бинарник:', resolvedSrv);
    let proc;
    try {
      const srvDir = path.dirname(resolvedSrv);
      proc = spawn(
        resolvedSrv,
        ['-m', mdlPath, '--port', String(port), '-c', String(contextSize || 4096),
         '--n-gpu-layers', String(gpuLayers != null ? gpuLayers : 0)],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
          cwd: srvDir,
          // Prepend llama server dir to PATH so Windows finds all ggml-cpu-*.dll
          // via dynamic LoadLibrary calls (not just import-table DLL lookup)
          env: { ...process.env, PATH: srvDir + path.delimiter + (process.env.PATH || '') }
        }
      );
    } catch (err) {
      console.error('[AI] spawn ошибка:', err.message);
      resolve({ success: false, error: `Не удалось запустить llama-server: ${err.message}` });
      return;
    }
    llamaServerProc = proc;

    const onReady = () => {
      if (resolved) return;
      resolved = true;
      llamaServerPort = port;
      llamaContextSize = contextSize || 4096;
      aiCurrentModelName = path.basename(mdlPath);
      console.log('[AI] Сервер готов:', aiCurrentModelName);
      resolve({ success: true });
    };

    const handleOutput = (data) => {
      const text = data.toString();
      process.stdout.write('[llama-server] ' + text);
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('ai-server-log', text);
      if (!resolved && (
        text.includes('HTTP server listening') ||
        text.includes('server is listening') ||
        text.includes('all slots are idle') ||
        text.includes('model loaded')
      )) onReady();
    };

    proc.stdout.on('data', handleOutput);
    proc.stderr.on('data', handleOutput);

    proc.on('error', (err) => {
      console.error('[AI] ошибка процесса:', err.message);
      if (!resolved) { resolved = true; llamaServerProc = null; resolve({ success: false, error: `Не удалось запустить llama-server: ${err.message}` }); }
    });

    proc.on('exit', (code) => {
      if (!resolved) { resolved = true; llamaServerProc = null; llamaServerPort = null; resolve({ success: false, error: `llama-server завершился (код ${code})` }); }
      else { llamaServerProc = null; llamaServerPort = null; }
    });

    // Fallback: poll /health endpoint
    const pollHealth = () => {
      if (resolved || !llamaServerProc) return;
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) onReady();
        else setTimeout(pollHealth, 800);
        res.resume();
      });
      req.on('error', () => setTimeout(pollHealth, 800));
      req.end();
    };
    setTimeout(pollHealth, 3000);

    setTimeout(() => {
      if (!resolved) { resolved = true; resolve({ success: false, error: 'Таймаут запуска llama-server (120с)' }); }
    }, 120000);
  });
});

ipcMain.handle('ai-chat', async (_event, { message }) => {
  if (!llamaServerPort) return { success: false, error: 'Модель не загружена' };

  if (aiAbortCtrl) { try { aiAbortCtrl.abort(); } catch (_) {} }
  aiAbortCtrl = new AbortController();
  const ctrl = aiAbortCtrl; // capture before any async context switch

  aiHistory.push({ role: 'user', content: message });

  // Trim history to prevent context overflow (~4 chars per token heuristic)
  const maxHistoryChars = (llamaContextSize || 4096) * 3; // ~75% of context for history
  let totalChars = aiHistory.reduce((s, m) => s + m.content.length, 0);
  while (aiHistory.length > 2 && totalChars > maxHistoryChars) {
    const removed = aiHistory.splice(0, 2); // remove oldest user+assistant pair
    totalChars -= removed.reduce((s, m) => s + m.content.length, 0);
  }

  const body = JSON.stringify({ messages: aiHistory, stream: true, max_tokens: 1024, temperature: aiTemperature, top_p: aiTopP });

  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port: llamaServerPort,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };

    let assistantText = '';
    let settled = false;

    const finish = (success, errMsg) => {
      if (settled) return;
      settled = true;
      aiGenerating = false;
      if (assistantText) aiHistory.push({ role: 'assistant', content: assistantText });
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send(success ? 'ai-done' : 'ai-error', success ? undefined : errMsg);
      resolve({ success });
    };

    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', chunk => { errBody += chunk.toString(); });
        res.on('end', () => {
          let errMsg = `Сервер вернул HTTP ${res.statusCode}`;
          try {
            const parsed = JSON.parse(errBody);
            if (parsed.error?.message) errMsg = parsed.error.message;
            else if (typeof parsed.error === 'string') errMsg = parsed.error;
          } catch (_) {}
          finish(false, errMsg);
        });
        return;
      }
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { finish(true); return; }
          try {
            const token = JSON.parse(raw).choices?.[0]?.delta?.content;
            if (token) {
              assistantText += token;
              if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-token', token);
            }
          } catch (_) {}
        }
      });
      res.on('end', () => finish(assistantText.length > 0, assistantText.length === 0 ? 'Модель не сгенерировала ответ' : undefined));
      res.on('error', (e) => finish(false, e.message));
    });

    req.on('error', (e) => {
      if (settled) return;
      settled = true;
      aiGenerating = false;
      const aborted = ctrl.signal.aborted; // use captured ctrl, not stale global
      if (assistantText) aiHistory.push({ role: 'assistant', content: assistantText });
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send(aborted ? 'ai-done' : 'ai-error', aborted ? undefined : e.message);
      resolve({ success: aborted });
    });

    ctrl.signal.addEventListener('abort', () => { try { req.destroy(); } catch (_) {} });

    req.write(body);
    req.end();
  });
});

// One-shot page analysis — does NOT touch aiHistory
ipcMain.handle('ai-analyze-page', async (_event, { prompt }) => {
  if (!llamaServerPort) return { success: false, error: 'Модель не загружена' };

  if (aiAbortCtrl) { try { aiAbortCtrl.abort(); } catch (_) {} }
  aiAbortCtrl = new AbortController();
  const ctrl = aiAbortCtrl; // capture before any async context switch

  const messages = [
    { role: 'system', content: 'You are a helpful assistant. Answer concisely.' },
    { role: 'user', content: prompt },
  ];
  const body = JSON.stringify({ messages, stream: true, max_tokens: 512, temperature: aiTemperature, top_p: aiTopP });

  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1', port: llamaServerPort, path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    let settled = false;
    const finish = (success, errMsg) => {
      if (settled) return;
      settled = true;
      aiGenerating = false;
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send(success ? 'ai-done' : 'ai-error', success ? undefined : errMsg);
      resolve({ success });
    };
    const req = http.request(options, (res) => {
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk.toString();
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { finish(true); return; }
          try {
            const token = JSON.parse(raw).choices?.[0]?.delta?.content;
            if (token && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-token', token);
          } catch (_) {}
        }
      });
      res.on('end', () => finish(true));
      res.on('error', (e) => finish(false, e.message));
    });
    req.on('error', (e) => {
      if (settled) return;
      settled = true;
      aiGenerating = false;
      const aborted = ctrl.signal.aborted; // use captured ctrl, not stale global
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send(aborted ? 'ai-done' : 'ai-error', aborted ? undefined : e.message);
      resolve({ success: aborted });
    });
    ctrl.signal.addEventListener('abort', () => { try { req.destroy(); } catch (_) {} });
    req.write(body);
    req.end();
  });
});

ipcMain.on('ai-abort', () => {
  if (aiAbortCtrl) { try { aiAbortCtrl.abort(); } catch (_) {} }
});

ipcMain.handle('ai-clear-history', () => {
  aiHistory = [];
  return { success: true };
});

ipcMain.handle('ai-get-history', () => {
  return { success: true, history: aiHistory };
});

ipcMain.handle('ai-unload-model', async () => {
  await unloadAiModel();
  return { success: true };
});

// One-shot: строит план (Глубокое мышление) — токены идут по каналу ai-think-token
ipcMain.handle('ai-think-response', async (_event, { prompt }) => {
  if (!llamaServerPort) return { success: false, collected: '', error: 'Модель не загружена' };

  if (aiAbortCtrl) { try { aiAbortCtrl.abort(); } catch (_) {} }
  aiAbortCtrl = new AbortController();
  const ctrl = aiAbortCtrl;

  const messages = [
    { role: 'system', content: 'Ты аналитик. Составь краткий пронумерованный план ответа на вопрос. Только план, без лишних слов. Отвечай на русском языке.' },
    { role: 'user', content: prompt },
  ];
  const body = JSON.stringify({ messages, stream: true, max_tokens: 300, temperature: aiTemperature, top_p: aiTopP });

  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1', port: llamaServerPort, path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    let collected = '';
    let settled = false;

    const finish = (ok) => {
      if (settled) return; settled = true;
      resolve({ success: ok, collected });
    };

    const req = http.request(options, (res) => {
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk.toString();
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { finish(true); return; }
          try {
            const token = JSON.parse(raw).choices?.[0]?.delta?.content;
            if (token) {
              collected += token;
              if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-think-token', token);
            }
          } catch (_) {}
        }
      });
      res.on('end', () => finish(true));
      res.on('error', () => finish(false));
    });
    req.on('error', () => { if (!settled) { settled = true; resolve({ success: ctrl.signal.aborted, collected }); } });
    ctrl.signal.addEventListener('abort', () => { try { req.destroy(); } catch (_) {} });
    req.write(body);
    req.end();
  });
});

// Анализ выделенного текста (one-shot, как ai-analyze-page)
ipcMain.handle('ai-analyze-selection', async (_event, { text, prompt }) => {
  if (!llamaServerPort) return { success: false, error: 'Модель не загружена' };

  if (aiAbortCtrl) { try { aiAbortCtrl.abort(); } catch (_) {} }
  aiAbortCtrl = new AbortController();
  const ctrl = aiAbortCtrl;

  const fullPrompt = `${prompt}\n\nВыделенный текст:\n${text.slice(0, 3000)}\n\nОтвет:`;
  const messages = [
    { role: 'system', content: 'Ты полезный ассистент. Отвечай кратко и по существу на русском языке.' },
    { role: 'user', content: fullPrompt },
  ];
  const body = JSON.stringify({ messages, stream: true, max_tokens: 512, temperature: aiTemperature, top_p: aiTopP });

  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1', port: llamaServerPort, path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    let settled = false;
    const finish = (success, errMsg) => {
      if (settled) return; settled = true;
      aiGenerating = false;
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send(success ? 'ai-done' : 'ai-error', success ? undefined : errMsg);
      resolve({ success });
    };
    const req = http.request(options, (res) => {
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk.toString();
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { finish(true); return; }
          try {
            const token = JSON.parse(raw).choices?.[0]?.delta?.content;
            if (token && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-token', token);
          } catch (_) {}
        }
      });
      res.on('end', () => finish(true));
      res.on('error', (e) => finish(false, e.message));
    });
    req.on('error', (e) => {
      if (settled) return; settled = true;
      aiGenerating = false;
      const aborted = ctrl.signal.aborted;
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send(aborted ? 'ai-done' : 'ai-error', aborted ? undefined : e.message);
      resolve({ success: aborted });
    });
    ctrl.signal.addEventListener('abort', () => { try { req.destroy(); } catch (_) {} });
    req.write(body);
    req.end();
  });
});

// Веб-поиск для режима "Поиск" в AI чате
ipcMain.handle('ai-web-search', async (_event, { query }) => {
  return new Promise((resolve) => {

    function decodeEntities(s) {
      return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ');
    }

    function parseHtml(html) {
      const results = [];
      const urls = [];
      const strip = s => decodeEntities(s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')).trim();

      function extractDdgUrl(href) {
        if (!href) return '';
        try {
          const full = href.startsWith('//') ? 'https:' + href : href;
          const u = new URL(full);
          if (u.hostname.includes('duckduckgo.com')) {
            const uddg = u.searchParams.get('uddg');
            if (uddg) return decodeURIComponent(uddg);
          }
          return u.toString();
        } catch { return href; }
      }

      // Extract URLs from result__a anchors
      const anchorRe = /<a([^>]*class="result__a"[^>]*)>/gi;
      let am;
      while ((am = anchorRe.exec(html)) !== null && urls.length < 5) {
        const hrefMatch = /href="([^"]*)"/.exec(am[1]);
        if (hrefMatch) {
          const u = extractDdgUrl(hrefMatch[1]);
          if (u.startsWith('http')) urls.push(u);
        }
      }

      // html.duckduckgo.com: <a class="result__a">Title</a> + <a class="result__snippet">Snippet</a>
      const titleRe = /<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/gi;
      const snipRe  = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      const titles = [], snips = [];
      let m;

      while ((m = titleRe.exec(html)) !== null && titles.length < 5)
        titles.push(strip(m[1]));
      while ((m = snipRe.exec(html)) !== null && snips.length < 5)
        snips.push(strip(m[1]));

      // Fallback: try <div class="result__snippet"> (older layout)
      if (snips.length === 0) {
        const snipRe2 = /<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/gi;
        while ((m = snipRe2.exec(html)) !== null && snips.length < 5)
          snips.push(strip(m[1]));
      }

      // Fallback: DDG Lite classes (result-link / result-snippet)
      if (titles.length === 0) {
        const ltRe = /<a[^>]+class="result-link"[^>]*>([\s\S]*?)<\/a>/gi;
        const lsRe = /<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
        while ((m = ltRe.exec(html)) !== null && titles.length < 5) titles.push(strip(m[1]));
        while ((m = lsRe.exec(html)) !== null && snips.length < 5) snips.push(strip(m[1]));
      }

      for (let i = 0; i < Math.min(Math.max(titles.length, snips.length), 5); i++) {
        const t = titles[i] || '';
        const s = snips[i] || '';
        if (t || s) results.push(`${i + 1}. ${t}${s ? '\n' + s : ''}`.trim());
      }
      return { results, urls };
    }

    function doFetch(hostname, path, method, body, redirects) {
      if (redirects > 4) { resolve({ success: false, error: 'Слишком много редиректов' }); return; }

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
      };
      if (body) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = https.request({ hostname, path, method, headers, timeout: 10000 }, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          try {
            const loc = res.headers.location;
            const u = loc.startsWith('http') ? new URL(loc) : new URL(`https://${hostname}${loc}`);
            doFetch(u.hostname, u.pathname + u.search, 'GET', null, redirects + 1);
          } catch { resolve({ success: false, error: 'Ошибка редиректа' }); }
          return;
        }

        let data = '';
        res.on('data', chunk => {
          data += chunk.toString();
          if (data.length > 600000) req.destroy(); // safety limit
        });
        res.on('end', () => {
          const { results, urls } = parseHtml(data);
          if (results.length > 0) {
            resolve({ success: true, results: results.join('\n\n'), urls });
          } else {
            resolve({ success: false, error: 'Результаты не найдены. Возможно, поисковик заблокировал запрос.' });
          }
        });
        res.on('error', e => resolve({ success: false, error: e.message }));
      });

      req.on('error', e => resolve({ success: false, error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Таймаут поиска' }); });

      if (body) req.write(body);
      req.end();
    }

    // html.duckduckgo.com — POST запрос (надёжнее GET для этого эндпоинта)
    const postBody = `q=${encodeURIComponent(query)}&kl=ru-ru&df=`;
    
    // Try multiple search engines as fallback
    function trySearch(engine, path, method, body) {
      doFetch(engine, path, method, body, 0);
    }
    
    // Try DuckDuckGo first, then fallback to Bing
    trySearch('html.duckduckgo.com', '/html/', 'POST', postBody);
  });
});

// Fallback search using Bing
ipcMain.handle('ai-web-search-bing', async (_event, { query }) => {
  return new Promise((resolve) => {
    const https = require('https');
    
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=ru`;
    
    const req = https.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8',
      },
      timeout: 15000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; if (data.length > 500000) req.destroy(); });
      res.on('end', () => {
        // Parse Bing results
        const titles = [];
        const urls = [];
        const snippets = [];
        
        // Bing: <li class="b_algo"> -> <h2> -> <a href="...">
        const titleRe = /<li[^>]*class="b_algo"[^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([^<]*)</gi;
        let m;
        while ((m = titleRe.exec(data)) !== null && urls.length < 5) {
          urls.push(m[1]);
          titles.push(m[2].replace(/<[^>]+>/g, '').trim());
        }
        
        // Snippets
        const snipRe = /<p[^>]*class="b_lineclamp[^"]*"[^>]*>([^<]*)</gi;
        while ((m = snipRe.exec(data)) !== null && snippets.length < 5) {
          snippets.push(m[1].trim());
        }
        
        if (urls.length > 0) {
          const results = titles.map((t, i) => `${i + 1}. ${t}\n${snippets[i] || ''}`).join('\n\n');
          resolve({ success: true, results, urls });
        } else {
          resolve({ success: false, error: 'Результаты не найдены' });
        }
      });
      res.on('error', e => resolve({ success: false, error: e.message }));
    });
    req.on('error', e => resolve({ success: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Таймаут поиска' }); });
  });
});

// Fetch an arbitrary URL and return its extracted text content (for search page reading)
ipcMain.handle('ai-fetch-url', async (_event, { url }) => {
  return new Promise((resolve) => {
    function doFetch(fetchUrl, redirects) {
      if (redirects > 4) { resolve({ success: false, error: 'Слишком много редиректов' }); return; }
      let u;
      try { u = new URL(fetchUrl); } catch { resolve({ success: false, error: 'Некорректный URL' }); return; }
      const lib = u.protocol === 'https:' ? https : http;
      const options = {
        hostname: u.hostname, port: u.port || undefined,
        path: (u.pathname || '/') + (u.search || ''),
        method: 'GET', timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8',
          'Accept-Encoding': 'identity',
        }
      };
      const req = lib.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const loc = res.headers.location;
          doFetch(loc.startsWith('http') ? loc : `${u.protocol}//${u.hostname}${loc}`, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) { res.resume(); resolve({ success: false, error: `HTTP ${res.statusCode}` }); return; }
        let data = '';
        res.on('data', chunk => { data += chunk.toString(); if (data.length > 300000) req.destroy(); });
        res.on('end', () => {
          // Strip scripts, styles, then all tags, decode entities
          let text = data
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim()
            .slice(0, 8000);
          resolve({ success: true, content: text, url: fetchUrl });
        });
        res.on('error', e => resolve({ success: false, error: e.message }));
      });
      req.on('error', e => resolve({ success: false, error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Таймаут загрузки страницы' }); });
      req.end();
    }
    doFetch(url, 0);
  });
});

// Scan a folder for .gguf model files
ipcMain.handle('ai-scan-models-folder', async (_event, { folderPath }) => {
  try {
    const files = fs.readdirSync(folderPath);
    const models = files
      .filter(f => f.toLowerCase().endsWith('.gguf'))
      .map(f => ({ name: f, path: path.join(folderPath, f) }));
    return { success: true, models };
  } catch (e) {
    return { success: false, error: e.message, models: [] };
  }
});

// Multi-model ensemble: run each model sequentially, collect responses, synthesize
ipcMain.handle('ai-ensemble-chat', async (_event, { message, modelPaths, serverPath, contextSize, gpuLayers }) => {
  if (!modelPaths || modelPaths.length === 0) return { success: false, error: 'Нет моделей' };

  // Resolve llama-server binary
  const srvCandidates = [
    path.join(process.resourcesPath || '', 'llama server', 'llama-server.exe'),
    path.join(path.dirname(app.getPath('exe')), 'resources', 'llama server', 'llama-server.exe'),
    path.join(__dirname, 'llama server', 'llama-server.exe'),
  ];
  const bundledSrv = srvCandidates.find(p => fs.existsSync(p)) || srvCandidates[0];
  const srvPath = serverPath ? path.normalize(serverPath) : '';
  const isValidSrv = srvPath && srvPath !== '.' && !srvPath.toLowerCase().endsWith('.gguf') && fs.existsSync(srvPath);
  const resolvedSrv = isValidSrv ? srvPath : (fs.existsSync(bundledSrv) ? bundledSrv : '');
  if (!resolvedSrv || !fs.existsSync(resolvedSrv)) return { success: false, error: `llama-server не найден. Пути: ${srvCandidates.join(', ')}` };

  const sendProgress = (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-ensemble-progress', data);
  };

  const modelResponses = [];
  const modelErrors = [];

  // ── Run each model ────────────────────────────────────────────────────────
  for (let i = 0; i < modelPaths.length; i++) {
    const mPath = modelPaths[i];
    if (!fs.existsSync(mPath)) {
      modelErrors.push(`${path.basename(mPath)}: файл не найден`);
      continue;
    }
    const mName = path.basename(mPath);
    sendProgress({ phase: 'model', modelName: mName, step: i + 1, total: modelPaths.length });

    const messages = [
      { role: 'system', content: 'Ты опытный эксперт. Дай развёрнутый, точный ответ на вопрос пользователя. Отвечай на русском языке.' },
      { role: 'user', content: message }
    ];
    const result = await runModelOnce(mPath, resolvedSrv, messages, contextSize, gpuLayers, () => {
      sendProgress({ phase: 'model_ready', modelName: mName, step: i + 1, total: modelPaths.length });
    });
    if (result.success && result.text.trim()) {
      modelResponses.push({ modelName: mName, response: result.text });
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('ai-ensemble-model-done', { modelName: mName, response: result.text });
    } else {
      modelErrors.push(`${mName}: ${result.error || 'пустой ответ'}`);
      sendProgress({ phase: 'model_error', modelName: mName, step: i + 1, total: modelPaths.length, error: result.error });
    }
  }

  if (modelResponses.length === 0) {
    return { success: false, error: `Ни одна модель не дала ответ. ${modelErrors.join(' | ')}` };
  }

  // ── Synthesize ────────────────────────────────────────────────────────────
  sendProgress({ phase: 'synthesize', step: modelPaths.length, total: modelPaths.length });

  const responseSummary = modelResponses
    .map((r, i) => `[Модель ${i + 1}: ${r.modelName}]\n${r.response}`)
    .join('\n\n---\n\n');

  const synthesisPrompt = `Ты редактор и синтезатор. Перед тобой ответы нескольких нейросетей на один вопрос. Твоя задача — создать единый, чёткий и полный ответ: убери дубликаты, устрани противоречия, сохрани лучшее из каждого ответа, добавь структуру.\n\nВопрос: ${message}\n\nОтветы нейросетей:\n${responseSummary}\n\nСинтезированный итоговый ответ (на русском языке):`;

  // Use the currently loaded global model if available, otherwise use first ensemble model
  if (llamaServerPort) {
    const body = JSON.stringify({
      messages: [
        { role: 'system', content: 'Ты синтезатор ответов нейросетей.' },
        { role: 'user', content: synthesisPrompt }
      ],
      stream: true, max_tokens: 2000, temperature: aiTemperature, top_p: aiTopP
    });
    return new Promise((resolve) => {
      const options = {
        hostname: '127.0.0.1', port: llamaServerPort, path: '/v1/chat/completions', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      };
      let settled = false;
      const finish = (ok, err) => {
        if (settled) return; settled = true;
        if (mainWindow && !mainWindow.isDestroyed())
          mainWindow.webContents.send(ok ? 'ai-done' : 'ai-error', ok ? undefined : err);
        resolve({ success: ok });
      };
      const req = http.request(options, (res) => {
        let buf = '';
        res.on('data', chunk => {
          buf += chunk.toString();
          const lines = buf.split('\n'); buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') { finish(true); return; }
            try {
              const token = JSON.parse(raw).choices?.[0]?.delta?.content;
              if (token && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-token', token);
            } catch (_) {}
          }
        });
        res.on('end', () => finish(true));
        res.on('error', e => finish(false, e.message));
      });
      req.on('error', () => { if (!settled) { settled = true; resolve({ success: false }); } });
      req.write(body);
      req.end();
    });
  } else {
    // Use first ensemble model for synthesis
    const synthMessages = [
      { role: 'system', content: 'Ты синтезатор ответов нейросетей.' },
      { role: 'user', content: synthesisPrompt }
    ];
    const synthResult = await runModelOnce(modelPaths[0], resolvedSrv, synthMessages, contextSize, gpuLayers);
    if (synthResult.success && synthResult.text) {
      // Pseudo-stream the synthesis result
      const chunkSize = 40;
      for (let i = 0; i < synthResult.text.length; i += chunkSize) {
        if (mainWindow && !mainWindow.isDestroyed())
          mainWindow.webContents.send('ai-token', synthResult.text.slice(i, i + chunkSize));
        await new Promise(r => setTimeout(r, 20));
      }
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-done');
      return { success: true };
    }
    return { success: false, error: synthResult.error || 'Ошибка синтеза' };
  }
});

ipcMain.handle('ai-get-page-content', async () => {
  if (!activeTabId) return { success: false, error: 'Нет активной вкладки' };
  const view = browserViews.get(activeTabId);
  if (!view) return { success: false, error: 'Нет открытой веб-страницы' };
  
  // Check if page is loading
  if (view.webContents.isLoading()) {
    return { success: false, error: 'Страница загружается, подождите...' };
  }
  
  try {
    // Try multiple methods to get content
    let content = '';
    
    // Method 1: executeJavaScript with fallback
    try {
      content = await view.webContents.executeJavaScript(`
        (function() {
          try {
            const selectors = [
              'article', 'main', '[role="main"]', '.content', '#content', 
              '.post', '.article', '#mw-content-text', '.mw-parser-output',
              '.vector-sticky-pinned-container', '.entry-content', '.article-body',
              '#main-content', '.post-content', '.article-content', '.story-body'
            ];
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el && el.innerText && el.innerText.length > 100) {
                return (el.innerText || '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 15000);
              }
            }
            // Fallback to body
            const el = document.body;
            return el ? (el.innerText || '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 15000) : '';
          } catch(e) {
            return document.body ? document.body.innerText.slice(0, 15000) : '';
          }
        })()
      `);
      } catch (jsErr) {
      // Method 2: Get HTML and parse as fallback
      try {
        const html = await view.webContents.executeJavaScript('document.documentElement.outerHTML');
        // Simple HTML to text conversion
        content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 15000);
      } catch (htmlErr) {
        console.error('[ai-get-page-content] Both methods failed:', jsErr.message, htmlErr.message);
        return { success: false, error: 'Страница недоступна для анализа (возможно заблокирована или защищена)' };
      }
    }
    
    if (!content || content.length < 10) {
      return { success: false, error: 'Не удалось извлечь текст со страницы' };
    }
    
    return { success: true, content, url: view.webContents.getURL(), title: view.webContents.getTitle() };
  } catch (err) {
    console.error('[ai-get-page-content] Error:', err.message);
    return { success: false, error: 'Ошибка при чтении страницы: ' + err.message };
  }
});

// ─── External AI Provider IPC Handlers ────────────────────────────────────────
ipcMain.handle('ai-get-providers', () => {
  console.log('[AI Providers] ai-get-providers called, activeProvider:', aiProviderConfig.activeProvider);
  const providers = Object.entries(AI_PROVIDERS).map(([id, p]) => ({
    id, name: p.name, models: p.models,
    hasApiKey: !!aiProviderConfig.apiKeys[id]
  }));
  console.log('[AI Providers] Returning providers:', providers.map(p => p.id).join(', '));
  return {
    providers,
    activeProvider: aiProviderConfig.activeProvider,
    activeModel: aiProviderConfig.activeModel,
    enabled: aiProviderConfig.enabled
  };
});

ipcMain.handle('ai-set-provider', (_event, { provider }) => {
  if (!AI_PROVIDERS[provider]) return { success: false, error: 'Unknown provider' };
  aiProviderConfig.activeProvider = provider;
  aiProviderConfig.activeModel = AI_PROVIDERS[provider].models[0];
  aiProviderConfig.enabled = true;
  saveAiProviderConfig();
  return { success: true };
});

ipcMain.handle('ai-set-api-key', (_event, { provider, apiKey }) => {
  const key = apiKey.trim();
  let detectedProvider = provider;
  
  // Auto-detect provider if not specified
  if (!detectedProvider) {
    detectedProvider = detectProvider(key);
    if (!detectedProvider) {
      return { success: false, error: 'Не удалось определить провайдер по ключу. Укажите провайдера вручную.' };
    }
  }
  
  if (!AI_PROVIDERS[detectedProvider]) return { success: false, error: 'Unknown provider' };
  
  aiProviderConfig.apiKeys[detectedProvider] = key;
  aiProviderConfig.activeProvider = detectedProvider;
  aiProviderConfig.activeModel = AI_PROVIDERS[detectedProvider].models[0];
  aiProviderConfig.enabled = true;
  saveAiProviderConfig();
  
  return { success: true, provider: detectedProvider, name: AI_PROVIDERS[detectedProvider].name };
});

ipcMain.handle('ai-get-provider-status', (_event, { provider }) => {
  const p = AI_PROVIDERS[provider];
  if (!p) return { success: false, error: 'Unknown provider' };
  return {
    success: true,
    hasApiKey: !!aiProviderConfig.apiKeys[provider],
    activeProvider: aiProviderConfig.activeProvider === provider,
    activeModel: aiProviderConfig.activeModel
  };
});

ipcMain.handle('ai-set-model', (_event, { model }) => {
  if (!model) return { success: false, error: 'Model not specified' };
  aiProviderConfig.activeModel = model;
  saveAiProviderConfig();
  return { success: true };
});

// Check clipboard for image data - helps detect multimodal capability
ipcMain.handle('ai-check-clipboard', async () => {
  try {
    const formats = clipboard.availableFormats();
    const hasImage = formats.some(f => f.startsWith('image/'));
    return { success: true, hasImage, formats };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Fetch available models from OpenRouter
ipcMain.handle('ai-get-openrouter-models', async () => {
  console.log('[OpenRouter] ai-get-openrouter-models called');
  const apiKey = aiProviderConfig.apiKeys['openrouter'];
  if (!apiKey) {
    console.log('[OpenRouter] No API key found');
    return { success: false, error: 'API ключ OpenRouter не найден' };
  }
  console.log('[OpenRouter] API key found, making request...');
  
  return new Promise((resolve) => {
    const req = https.get('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'intra-browser',
        'X-Title': 'Intra Browser'
      }
    }, (res) => {
      console.log('[OpenRouter] Response status:', res.statusCode);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('[OpenRouter] Got data, models count:', json.data?.length);
          if (json.data && Array.isArray(json.data)) {
            // Sort by price (cheapest first) and take top 30
            const models = json.data
              .map(m => ({
                id: m.id,
                name: m.name || m.id,
                context: m.context_length,
                pricing: m.pricing
              }))
              .sort((a, b) => {
                const aPrice = parseFloat(a.pricing?.prompt || '0') + parseFloat(a.pricing?.completion || '0');
                const bPrice = parseFloat(b.pricing?.prompt || '0') + parseFloat(b.pricing?.completion || '0');
                return aPrice - bPrice;
              })
              .slice(0, 30);
            
            console.log('[OpenRouter] Returning', models.length, 'models');
            resolve({ success: true, models });
          } else {
            console.log('[OpenRouter] Invalid format');
            resolve({ success: false, error: 'Неверный формат ответа' });
          }
        } catch (e) {
          console.log('[OpenRouter] Parse error:', e.message);
          resolve({ success: false, error: 'Ошибка парсинга: ' + e.message });
        }
      });
    });
    
    req.on('error', (err) => {
      console.log('[OpenRouter] Request error:', err.message);
      resolve({ success: false, error: err.message });
    });
    
    req.end();
  });
});

let providerAbortCtrl = null;
let providerHistory = [];

ipcMain.handle('ai-chat-with-provider', async (_event, { message, model, options = {} }) => {
  const provider = aiProviderConfig.activeProvider;
  const apiKey = aiProviderConfig.apiKeys[provider];
  
  if (!provider || !apiKey) {
    return { success: false, error: 'Провайдер не настроен. Добавьте API ключ в настройках.' };
  }

  if (providerAbortCtrl) { try { providerAbortCtrl.abort(); } catch (_) {} }
  providerAbortCtrl = new AbortController();
  
  providerHistory.push({ role: 'user', content: message });
  
  const maxMessages = 20;
  while (providerHistory.length > maxMessages) {
    providerHistory = providerHistory.slice(2);
  }

  try {
    if (provider === 'openai') {
      return await callOpenAI(apiKey, model || aiProviderConfig.activeModel, providerHistory, options, providerAbortCtrl);
    } else if (provider === 'anthropic') {
      return await callAnthropic(apiKey, model || aiProviderConfig.activeModel, providerHistory, options, providerAbortCtrl);
    } else if (provider === 'google') {
      return await callGoogleGemini(apiKey, model || aiProviderConfig.activeModel, message, providerHistory, options, providerAbortCtrl);
    } else if (provider === 'openrouter') {
      return await callOpenRouter(apiKey, model || aiProviderConfig.activeModel, providerHistory, options, providerAbortCtrl);
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
  return { success: false, error: 'Unknown provider' };
});

async function callOpenAI(apiKey, model, messages, options, ctrl) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role === 'bot' ? 'assistant' : m.role, content: m.content })),
      stream: true,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7
    });

    const req = https.request(AI_PROVIDERS.openai.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
        const lines = data.split('\n');
        data = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const json = line.slice(6);
            if (json === '[DONE]') {
              providerHistory.push({ role: 'bot', content: '' });
              if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-done');
              resolve({ success: true });
              return;
            }
            try {
              const obj = JSON.parse(json);
              const content = obj.choices?.[0]?.delta?.content || '';
              if (content) {
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-token', content);
                const last = providerHistory[providerHistory.length - 1];
                if (last && last.role === 'bot') last.content += content;
              }
            } catch (_) {}
          }
        }
      });
      res.on('end', () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-done');
        resolve({ success: true });
      });
    });

    req.on('error', (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-error', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(body);
    req.end();
  });
}

async function callAnthropic(apiKey, model, messages, options, ctrl) {
  return new Promise((resolve) => {
    const systemMsg = messages.find(m => m.role === 'system');
    const userMsgs = messages.filter(m => m.role !== 'system');
    
    const body = JSON.stringify({
      model,
      max_tokens: options.maxTokens || 4096,
      messages: userMsgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
      system: systemMsg?.content,
      stream: true
    });

    const req = https.request(AI_PROVIDERS.anthropic.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
        const lines = data.split('\n');
        data = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const json = line.slice(6);
            if (json === '[DONE]') {
              providerHistory.push({ role: 'bot', content: '' });
              if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-done');
              resolve({ success: true });
              return;
            }
            try {
              const obj = JSON.parse(json);
              const content = obj.delta?.text || '';
              if (content) {
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-token', content);
                const last = providerHistory[providerHistory.length - 1];
                if (last && last.role === 'bot') last.content += content;
              }
            } catch (_) {}
          }
        }
      });
      res.on('end', () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-done');
        resolve({ success: true });
      });
    });

    req.on('error', (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-error', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(body);
    req.end();
  });
}

async function callGoogleGemini(apiKey, model, message, history, options, ctrl) {
  return new Promise((resolve) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    
    const contents = [];
    for (const m of history) {
      contents.push({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] });
    }

    const body = JSON.stringify({
      contents,
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxTokens || 4096
      }
    });

    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
        const lines = data.split('\n');
        data = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              const content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (content) {
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-token', content);
                const last = providerHistory[providerHistory.length - 1];
                if (last && last.role === 'bot') last.content += content;
              }
            } catch (_) {}
          }
        }
      });
      res.on('end', () => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-done');
        resolve({ success: true });
      });
    });

    req.on('error', (err) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-error', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(body);
    req.end();
  });
}

async function callOpenRouter(apiKey, model, messages, options, ctrl) {
  console.log('[OpenRouter] Calling with model:', model);
  
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role === 'bot' ? 'assistant' : m.role, content: m.content })),
      stream: true,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7
    });

    console.log('[OpenRouter] URL:', AI_PROVIDERS.openrouter.apiUrl);
    console.log('[OpenRouter] Body model:', model);

    const req = https.request(AI_PROVIDERS.openrouter.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'intra-browser',
        'X-Title': 'Intra Browser'
      }
    }, (res) => {
      console.log('[OpenRouter] Response status:', res.statusCode);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
        const lines = data.split('\n');
        data = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const json = line.slice(6);
            if (json === '[DONE]') {
              providerHistory.push({ role: 'bot', content: '' });
              if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-done');
              resolve({ success: true });
              return;
            }
            try {
              const obj = JSON.parse(json);
              console.log('[OpenRouter] Token received, content length:', obj.choices?.[0]?.delta?.content?.length);
              const content = obj.choices?.[0]?.delta?.content || '';
              if (content) {
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-token', content);
                const last = providerHistory[providerHistory.length - 1];
                if (last && last.role === 'bot') last.content += content;
              }
            } catch (_) {}
          }
        }
      });
      res.on('end', () => {
        console.log('[OpenRouter] Response ended');
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-done');
        resolve({ success: true });
      });
    });

    req.on('error', (err) => {
      console.error('[OpenRouter] Error:', err.message);
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-provider-error', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(body);
    req.end();
  });
}

ipcMain.on('ai-abort-provider', () => {
  if (providerAbortCtrl) { try { providerAbortCtrl.abort(); } catch (_) {} providerAbortCtrl = null; }
});

ipcMain.handle('open-devtools', () => {
  if (!activeTabId) return;
  const view = browserViews.get(activeTabId);
  if (view) view.webContents.openDevTools({ mode: 'detach' });
});

// Forward web-page notifications from any BrowserView to the main window UI
ipcMain.on('browser-notification', (_event, data) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('browser-notification', {
      title: data.title || '',
      body: data.body || '',
      icon: data.icon || null,
      timestamp: Date.now(),
    });
  }
});

// ─── Контекстное меню — обработка действий ────────────────────────────────
ipcMain.on('ctx-select', (_e, { action, payload }) => {
  if (contextMenuWin && !contextMenuWin.isDestroyed()) { contextMenuWin.destroy(); contextMenuWin = null; }
  const view = activeTabId ? browserViews.get(activeTabId) : null;
  switch (action) {
    case 'go-back':          view?.webContents.goBack(); break;
    case 'go-forward':       view?.webContents.goForward(); break;
    case 'reload':           view?.webContents.reload(); break;
    case 'open-new-tab':     mainWindow?.webContents.send('open-new-tab',     { url: payload?.url }); break;
    case 'open-private-tab': mainWindow?.webContents.send('open-private-tab', { url: payload?.url }); break;
    case 'copy-link':        clipboard.writeText(payload?.url || ''); break;
    case 'copy-url':         clipboard.writeText(view?.webContents.getURL() || ''); break;
    case 'copy':             view?.webContents.copy(); break;
    case 'cut':              view?.webContents.cut(); break;
    case 'paste':            view?.webContents.paste(); break;
    case 'search-text':      mainWindow?.webContents.send('open-new-tab', { url: `https://yandex.ru/search/?text=${encodeURIComponent(payload?.text || '')}` }); break;
    case 'save-image':
      if (DOWNLOAD_DEBUG) console.log('[Download-DBG] save-image: activeTabId:', activeTabId, 'view exists:', !!view);
      if (view) {
        const imageUrl = payload?.url || '';
        const defaultName = imageUrl.split('/').pop().split('?')[0] || 'image.png';
        dialog.showSaveDialog(mainWindow, {
          defaultPath: path.join(app.getPath('downloads'), defaultName),
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
        }).then(result => {
          if (!result.canceled && result.filePath) {
            // Проверяем что view всё ещё тот же самый и жив
            const currentView = activeTabId ? browserViews.get(activeTabId) : null;
            if (!currentView || currentView.webContents.isDestroyed()) {
              if (DOWNLOAD_DEBUG) console.log('[Download-DBG] save-image: view destroyed or changed');
              return;
            }
            pendingSavePath = result.filePath;
            if (DOWNLOAD_DEBUG) console.log('[Download-DBG] save-image: pendingSavePath set to:', pendingSavePath, 'calling downloadURL');
            currentView.webContents.downloadURL(imageUrl);
          }
        }).catch(err => {
          if (DOWNLOAD_DEBUG) console.log('[Download-DBG] save-image: dialog error:', err);
        });
      } else {
        if (DOWNLOAD_DEBUG) console.log('[Download-DBG] save-image: NO VIEW for activeTabId:', activeTabId);
      }
      break;
    case 'devtools':         view?.webContents.openDevTools({ mode: 'detach' }); break;
    case 'open-debug-modal': openDebugModal(); break;
    case 'new-tab':          mainWindow?.webContents.send('open-new-tab',     { url: null }); break;
    case 'new-private-tab':  mainWindow?.webContents.send('open-private-tab', { url: null }); break;
    case 'ai-summarize-selection':
      mainWindow?.webContents.send('ai-selection-request', {
        text: payload?.text || '', promptType: 'summarize',
        label: 'Резюмировать выделенное', prompt: 'На основе предоставленного текста сделай краткое резюме на русском языке.'
      }); break;
    case 'ai-theses-selection':
      mainWindow?.webContents.send('ai-selection-request', {
        text: payload?.text || '', promptType: 'theses',
        label: 'Ключевые тезисы', prompt: 'На основе предоставленного текста выдели ключевые тезисы и факты в виде маркированного списка.'
      }); break;
    case 'ai-explain-selection':
      mainWindow?.webContents.send('ai-selection-request', {
        text: payload?.text || '', promptType: 'explain',
        label: 'Объяснить текст', prompt: 'На основе предоставленного текста объясни простыми словами, что он означает.'
      }); break;
    case 'ai-translate-selection':
      mainWindow?.webContents.send('ai-selection-request', {
        text: payload?.text || '', promptType: 'translate',
        label: 'Перевести', prompt: 'На основе предоставленного текста переведи его на русский язык.'
      }); break;
    case 'ai-search-selection':
      mainWindow?.webContents.send('ai-selection-request', {
        text: payload?.text || '', promptType: 'search',
        label: 'Найти информацию', prompt: 'На основе предоставленного текста найди дополнительную информацию по теме и дай краткое объяснение.'
      }); break;
    case 'ai-improve-selection':
      mainWindow?.webContents.send('ai-selection-request', {
        text: payload?.text || '', promptType: 'improve',
        label: 'Улучшить стиль', prompt: 'На основе предоставленного текста перепиши его, улучшив стиль и грамматику, сохранив смысл.'
      }); break;
    case 'ai-shorten-selection':
      mainWindow?.webContents.send('ai-selection-request', {
        text: payload?.text || '', promptType: 'shorten',
        label: 'Сократить', prompt: 'На основе предоставленного текста сократи его, сохранив ключевой смысл и информацию.'
      }); break;
    case 'ai-expand-selection':
      mainWindow?.webContents.send('ai-selection-request', {
        text: payload?.text || '', promptType: 'expand',
        label: 'Расширить', prompt: 'На основе предоставленного текста расширь его, добавив больше деталей и контекста.'
      }); break;
    case 'ai-code-selection':
      mainWindow?.webContents.send('ai-selection-request', {
        text: payload?.text || '', promptType: 'code',
        label: 'Объяснить код', prompt: 'На основе предоставленного кода объясни как он работает и что делает.'
      }); break;
    case 'ai-extract-selection':
      mainWindow?.webContents.send('ai-selection-request', {
        text: payload?.text || '', promptType: 'extract',
        label: 'Извлечь данные', prompt: 'На основе предоставленного текста извлеки структурированные данные (имена, даты, места, факты) в виде списка.'
      }); break;
  }
});

ipcMain.on('ctx-close', () => {
  if (contextMenuWin && !contextMenuWin.isDestroyed()) { contextMenuWin.destroy(); contextMenuWin = null; }
});

// Debug modal window
function openDebugModal() {
  if (debugModalWin && !debugModalWin.isDestroyed()) {
    debugModalWin.focus();
    return;
  }
  
  const [winW, winH] = mainWindow.getContentSize();
  const modalW = 900;
  const modalH = 650;
  
  debugModalWin = new BrowserWindow({
    width: modalW,
    height: modalH,
    x: Math.round((winW - modalW) / 2),
    y: Math.round((winH - modalH) / 2),
    frame: false,
    resizable: true,
    minimizable: true,
    maximizable: false,
    parent: mainWindow,
    modal: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'debug-modal-preload.js')
    }
  });
  
  debugModalWin.loadFile(path.join(__dirname, 'debug-modal.html'));
  debugModalWin.once('ready-to-show', () => {
    debugModalWin.show();
    // Send logo path to renderer
    debugModalWin.webContents.send('debug-modal-init', {
      logoPath: path.join(__dirname, 'intrabrowser-logo.png')
    });
  });
  
  debugModalWin.on('closed', () => {
    debugModalWin = null;
  });
  
  debugModalWin.on('blur', () => {
    // Don't auto-close on blur - let user control it
  });
}

ipcMain.on('debug-modal-close', () => {
  if (debugModalWin && !debugModalWin.isDestroyed()) {
    debugModalWin.close();
  }
});

// ─── Меню "⋯" — overlay окно поверх всего ────────────────────────────────
function openOverlayMenu(items, rightEdge, bottomEdge) {
  if (contextMenuWin && !contextMenuWin.isDestroyed()) contextMenuWin.destroy();

  const ITEM_H = 34, SEP_H = 9, PAD = 10, SHADOW = 16;
  const contentH = items.reduce((h, it) => h + (it.type === 'separator' ? SEP_H : ITEM_H), PAD);
  const winH = contentH + SHADOW;
  const winW = 290;

  const [wx, wy] = mainWindow.getPosition();
  let mx = wx + rightEdge - winW;
  let my = wy + bottomEdge + 4;

  const disp = screen.getDisplayNearestPoint({ x: mx + winW / 2, y: my });
  const wa = disp.workArea;
  if (mx < wa.x) mx = wa.x;
  if (mx + winW > wa.x + wa.width) mx = wa.x + wa.width - winW;
  if (my + winH > wa.y + wa.height) my = wy + bottomEdge - winH - 4;
  if (my < wa.y) my = wa.y;

  contextMenuWin = new BrowserWindow({
    width: winW, height: winH,
    x: Math.round(mx), y: Math.round(my),
    frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: true,
    resizable: false, movable: false, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'context-menu-preload.js') }
  });
  contextMenuWin.loadFile(path.join(__dirname, 'context-menu.html'));
  contextMenuWin.once('ready-to-show', () => { contextMenuWin.show(); contextMenuWin.webContents.send('ctx-show', items); });
  contextMenuWin.on('blur', () => { if (contextMenuWin && !contextMenuWin.isDestroyed()) { contextMenuWin.destroy(); contextMenuWin = null; } });
}

ipcMain.handle('open-browser-menu', (_e, { right, bottom }) => {
  openOverlayMenu([
    { type: 'item', label: 'Новая вкладка',           action: 'new-tab',         shortcut: 'Ctrl+T',         enabled: true },
    { type: 'item', label: 'Приватная вкладка',        action: 'new-private-tab', shortcut: 'Ctrl+Shift+N',   enabled: true },
    { type: 'separator' },
    { type: 'item', label: 'Инструменты разработчика', action: 'devtools',        shortcut: 'F12',            enabled: true },
  ], right, bottom);
});

app.on('before-quit', async () => {
  await unloadAiModel();
});

// Downloads IPC
ipcMain.handle('get-downloads', () => {
  const result = { success: true, downloads: Array.from(downloads.values()) };
  console.log('[MAIN-DBG] get-downloads called, returning:', result.downloads.length, 'downloads');
  return result;
});

ipcMain.handle('clear-downloads', () => {
  downloads.clear();
  saveDownloadsToFile();
  return { success: true };
});

ipcMain.handle('show-in-folder', (_event, { downloadId }) => {
  const dl = downloads.get(downloadId);
  if (dl?.savePath) {
    shell.showItemInFolder(dl.savePath);
    return { success: true };
  }
  return { success: false, error: 'Путь к файлу неизвестен' };
});

ipcMain.handle('remove-download', (_event, { downloadId }) => {
  downloads.delete(downloadId);
  saveDownloadsToFile();
  return { success: true };
});

// ─── AI Chat History IPC ─────────────────────────────────────────────────────
let currentChatSessionId = null;

ipcMain.handle('ai-history-list', () => listChatSessions());

ipcMain.handle('ai-history-load', (_event, { sessionId }) => {
  const result = loadChatSession(sessionId);
  if (result.success) {
    currentChatSessionId = sessionId;
    // Restore history for local model
    aiHistory = (result.session.messages || [])
      .filter(m => m.role === 'user' || m.role === 'bot')
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text || '' }));
    // Restore history for provider
    providerHistory = (result.session.messages || [])
      .filter(m => m.role === 'user' || m.role === 'bot')
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text || '' }));
  }
  return result;
});

ipcMain.handle('ai-history-save', (_event, { sessionId, messages, title, provider, model }) => {
  // Auto-generate title from first message if not provided
  let autoTitle = title;
  if (!autoTitle && messages.length > 0) {
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg) {
      autoTitle = firstUserMsg.text.slice(0, 40) + (firstUserMsg.text.length > 40 ? '...' : '');
    }
  }
  const result = saveChatSession(sessionId, messages, autoTitle, provider, model);
  if (result.success) {
    currentChatSessionId = sessionId;
  }
  return result;
});

ipcMain.handle('ai-history-delete', (_event, { sessionId }) => {
  if (currentChatSessionId === sessionId) {
    currentChatSessionId = null;
  }
  return deleteChatSession(sessionId);
});

ipcMain.handle('ai-history-rename', (_event, { sessionId, title }) => {
  return renameChatSession(sessionId, title);
});

ipcMain.handle('ai-history-get-current', () => currentChatSessionId);

ipcMain.handle('ai-history-new-session', () => {
  currentChatSessionId = null;
  aiHistory = [];
  providerHistory = [];
  return { sessionId: `chat-${Date.now()}` };
});

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  console.log('[MAIN] App ready, loading downloads...');
  loadDownloadsFromFile();
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
