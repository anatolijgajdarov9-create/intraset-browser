const { app, BrowserWindow, BrowserView, ipcMain, shell, dialog, Menu, clipboard, screen } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let mainWindow;
let browserViews = new Map(); // tabId -> BrowserView
let privateTabs = new Set();  // tabIds that are private (use ephemeral partition)
let activeTabId = null;
let sidebarPanelOpen = false;
let contextMenuWin = null;    // custom context menu overlay window

// ─── AI state (llama-server subprocess + HTTP streaming) ─────────────────────
const fs             = require('fs');
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
}

// ─── Helper: run one model for a single non-streaming inference ──────────────
// Spawns llama-server, waits for ready, sends one /v1/chat/completions request
// (stream:false), collects the full response, kills the server, returns text.
async function runModelOnce(modelPath, resolvedSrv, messages, contextSize, gpuLayers) {
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
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, 'intrabrowser-logo.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
  });

  if (isDev) {
    mainWindow.webContents.session.clearCache().then(() => {
      mainWindow.loadURL('http://localhost:3000');
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    browserViews.clear();
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
      { type: 'item', label: 'Просмотр кода страницы',    action: 'devtools' }
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

  browserViews.set(tabId, view);
  setupBrowserViewEvents(view, tabId);

  if (url && url !== 'intra://home') {
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
    doFetch('html.duckduckgo.com', '/html/', 'POST', postBody, 0);
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
  const isValidSrv = srvPath && !srvPath.toLowerCase().endsWith('.gguf') && fs.existsSync(srvPath);
  const resolvedSrv = isValidSrv ? srvPath : (fs.existsSync(bundledSrv) ? bundledSrv : '');
  if (!resolvedSrv) return { success: false, error: 'llama-server не найден' };

  const sendProgress = (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-ensemble-progress', data);
  };

  const modelResponses = [];

  // ── Run each model ────────────────────────────────────────────────────────
  for (let i = 0; i < modelPaths.length; i++) {
    const mPath = modelPaths[i];
    if (!fs.existsSync(mPath)) continue;
    const mName = path.basename(mPath);
    sendProgress({ phase: 'model', modelName: mName, step: i + 1, total: modelPaths.length });

    const messages = [
      { role: 'system', content: 'Ты опытный эксперт. Дай развёрнутый, точный ответ на вопрос пользователя. Отвечай на русском языке.' },
      { role: 'user', content: message }
    ];
    const result = await runModelOnce(mPath, resolvedSrv, messages, contextSize, gpuLayers);
    if (result.success && result.text) {
      modelResponses.push({ modelName: mName, response: result.text });
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send('ai-ensemble-model-done', { modelName: mName, response: result.text });
    }
  }

  if (modelResponses.length === 0) return { success: false, error: 'Ни одна модель не дала ответ' };

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
  try {
    const content = await view.webContents.executeJavaScript(`
      (function() {
        const article = document.querySelector('article, main, [role="main"], .content, #content, .post, .article');
        const el = article || document.body;
        return (el.innerText || '').replace(/[ \\t]{2,}/g, ' ').replace(/\\n{3,}/g, '\\n\\n').trim().slice(0, 15000);
      })()
    `);
    return { success: true, content, url: view.webContents.getURL(), title: view.webContents.getTitle() };
  } catch (err) {
    return { success: false, error: err.message };
  }
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
    case 'save-image':       view?.webContents.downloadURL(payload?.url || ''); break;
    case 'devtools':         view?.webContents.openDevTools({ mode: 'detach' }); break;
    case 'new-tab':          mainWindow?.webContents.send('open-new-tab',     { url: null }); break;
    case 'new-private-tab':  mainWindow?.webContents.send('open-private-tab', { url: null }); break;
    case 'ai-summarize-selection':
      mainWindow?.webContents.send('ai-selection-request', {
        text: payload?.text || '', promptType: 'summarize',
        label: 'Резюмировать выделенное', prompt: 'Сделай краткое резюме следующего текста на русском языке.'
      }); break;
    case 'ai-theses-selection':
      mainWindow?.webContents.send('ai-selection-request', {
        text: payload?.text || '', promptType: 'theses',
        label: 'Ключевые тезисы', prompt: 'Выдели ключевые тезисы и факты следующего текста в виде маркированного списка.'
      }); break;
    case 'ai-explain-selection':
      mainWindow?.webContents.send('ai-selection-request', {
        text: payload?.text || '', promptType: 'explain',
        label: 'Объяснить текст', prompt: 'Объясни простыми словами, что означает следующий текст.'
      }); break;
  }
});

ipcMain.on('ctx-close', () => {
  if (contextMenuWin && !contextMenuWin.isDestroyed()) { contextMenuWin.destroy(); contextMenuWin = null; }
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

// ─────────────────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
