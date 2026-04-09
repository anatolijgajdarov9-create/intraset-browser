import React, { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import HomePage from './components/HomePage';
import BlockedPage from './components/BlockedPage';
import AiChatPage from './components/AiChatPage';
import { isIntranetUrl } from './config/intranet';

const isElectron = typeof window.electronAPI !== 'undefined';

let tabIdCounter = 1;
const newTabId = () => `tab-${tabIdCounter++}`;

const createTab = (url = 'intra://home', title = 'Новая вкладка', isPrivate = false, isBlank = false) => ({
  id: newTabId(), url, title,
  favicon: null, loading: false,
  canGoBack: false, canGoForward: false,
  isHome: url === 'intra://home',
  isAiChat: url === 'intra://ai-chat',
  isBlocked: false, blockedUrl: null,
  isPrivate, isBlank
});

// Проверка: URL пригоден для отслеживания?
function isTrackableUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname;
    // Фильтруем: пустой хост, очень короткие, localhost, внутренние
    if (!host || host.length < 3) return false;
    if (host === 'localhost' || /^127\./.test(host) || /^192\.168\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

// Обновить метаданные посещений в localStorage
// Ключ — origin (домен), хранится полный URL для навигации
function trackVisit(url, title, favicon) {
  if (!isTrackableUrl(url)) return;
  try {
    const parsed = new URL(url);
    const key = parsed.origin; // https://example.com
    const visits = JSON.parse(localStorage.getItem('intra-visits') || '{}');
    const prev = visits[key] || { count: 0, title: '', favicon: null, url: '' };
    // Не обновляем title пустой строкой — сохраняем предыдущий
    const newTitle = title || prev.title || parsed.hostname;
    visits[key] = {
      count: prev.count + 1,
      title: newTitle,
      favicon: favicon || prev.favicon,
      url, // полный URL для навигации
      lastVisit: Date.now()
    };
    localStorage.setItem('intra-visits', JSON.stringify(visits));
    trackHistory(url, newTitle, visits[key].favicon);
  } catch {}
}

function trackHistory(url, title, favicon) {
  if (!isTrackableUrl(url)) return;
  // Не сохраняем страницы без смыслового заголовка (только URL)
  try {
    const history = JSON.parse(localStorage.getItem('intra-history') || '[]');
    // Убираем дублирующую запись для того же URL
    const filtered = history.filter(h => h.url !== url);
    filtered.unshift({ url, title: title || new URL(url).hostname, favicon: favicon || null, timestamp: Date.now() });
    if (filtered.length > 200) filtered.splice(200);
    localStorage.setItem('intra-history', JSON.stringify(filtered));
  } catch {}
}

function updateVisitMeta(url, meta) {
  if (!url || url.startsWith('intra://')) return;
  try {
    let key;
    try { key = new URL(url).origin; } catch { return; }
    const visits = JSON.parse(localStorage.getItem('intra-visits') || '{}');
    if (visits[key]) {
      visits[key] = { ...visits[key], ...meta };
      localStorage.setItem('intra-visits', JSON.stringify(visits));
    }
    if (meta.title || meta.favicon) {
      const history = JSON.parse(localStorage.getItem('intra-history') || '[]');
      const idx = history.findIndex(h => h.url === url);
      if (idx !== -1) {
        history[idx] = { ...history[idx], ...meta };
        localStorage.setItem('intra-history', JSON.stringify(history));
      }
    }
  } catch {}
}

// ─── Таб-бар ──────────────────────────────────────────────────────────────────
function AppTabBar({ tabs, activeTabId, onSwitchTab, onCloseTab, onNewTab }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 38,
      background: 'white', borderBottom: '1px solid #e2e8f0',
      WebkitAppRegion: 'drag', flexShrink: 0, padding: '0 4px', gap: 2
    }}>
      {tabs.map(tab => (
        <div key={tab.id} onClick={() => onSwitchTab(tab.id)} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          height: 28, padding: '0 8px', borderRadius: 6, cursor: 'pointer',
          maxWidth: 200, minWidth: 80, flexShrink: 0, WebkitAppRegion: 'no-drag',
          background: tab.id === activeTabId
            ? (tab.isPrivate ? '#f3e8ff' : '#f1f5f9')
            : 'transparent',
          border: `1px solid ${tab.id === activeTabId ? (tab.isPrivate ? '#d8b4fe' : '#e2e8f0') : 'transparent'}`,
          transition: 'all 0.15s'
        }}>
          {tab.isPrivate && (
            <svg width="10" height="10" fill="none" stroke="#7c3aed" viewBox="0 0 24 24" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          )}
          {!tab.isPrivate && (tab.favicon
            ? <img src={tab.favicon} width={11} height={11} style={{ borderRadius: 2, flexShrink: 0 }}/>
            : <div style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                background: tab.loading ? '#3b82f6' : '#cbd5e1',
                animation: tab.loading ? 'tabSpin 1s linear infinite' : 'none' }}/>
          )}
          <span style={{
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontSize: 11,
            color: tab.id === activeTabId ? (tab.isPrivate ? '#7c3aed' : '#1e293b') : '#64748b',
            fontWeight: tab.id === activeTabId ? 500 : 400
          }}>{tab.title || 'Новая вкладка'}</span>
          <button onClick={e => { e.stopPropagation(); onCloseTab(tab.id); }} style={{
            width: 15, height: 15, borderRadius: 3, border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#94a3b8', flexShrink: 0
          }}
            onMouseEnter={e => { e.currentTarget.style.background='#fee2e2'; e.currentTarget.style.color='#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#94a3b8'; }}
          ><svg width="8" height="8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
      ))}
      <button onClick={onNewTab} style={{
        width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#94a3b8', fontSize: 16, flexShrink: 0, WebkitAppRegion: 'no-drag'
      }}
        onMouseEnter={e => { e.currentTarget.style.background='#f1f5f9'; e.currentTarget.style.color='#2563eb'; }}
        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#94a3b8'; }}
      >+</button>
      <div style={{ flex: 1, WebkitAppRegion: 'drag' }}/>
      {isElectron && ['─','□','✕'].map((lbl, i) => (
        <button key={i} style={{
          width: 32, height: 28, border: 'none', background: 'transparent', borderRadius: 4,
          cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 13, WebkitAppRegion: 'no-drag', transition: 'all 0.15s'
        }}
          onMouseEnter={e => { e.currentTarget.style.background = i===2?'#fee2e2':'#f1f5f9'; if(i===2) e.currentTarget.style.color='#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#94a3b8'; }}
          onClick={() => [window.electronAPI.minimize, window.electronAPI.maximize, window.electronAPI.close][i]?.()}
        >{lbl}</button>
      ))}
    </div>
  );
}

export default function App() {
  const [tabs, setTabs] = useState(() => [createTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [addressBarValue, setAddressBarValue] = useState('');
  const [intranetOnly, setIntranetOnly] = useState(false);
  const [searchEngine, setSearchEngineState] = useState(() => localStorage.getItem('intra-search-engine') || 'yandex');
  const [copyUrlFeedback, setCopyUrlFeedback] = useState(false);
  const [pendingSelectionReq, setPendingSelectionReq] = useState(null);
  const [sidebarSelectionReq, setSidebarSelectionReq] = useState(null);
  const [forceSidebarAiPanel, setForceSidebarAiPanel] = useState(false);
  const menuBtnRef = React.useRef(null);
  const addressBarRef = React.useRef(null);

  // Find in page state
  const [findBarOpen, setFindBarOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findResult, setFindResult] = useState(null); // { activeMatchOrdinal, matches }
  const findInputRef = React.useRef(null);

  // Zoom state per-tab
  const [tabZoom, setTabZoom] = useState({}); // tabId -> zoomLevel

  // Tab mute state
  const [tabMuted, setTabMuted] = useState({}); // tabId -> boolean

  const setSearchEngine = (engine) => {
    setSearchEngineState(engine);
    localStorage.setItem('intra-search-engine', engine);
  };

  // Закладки — общее состояние с localStorage
  const [bookmarks, setBookmarksState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('intra-bookmarks') || '[]'); } catch { return []; }
  });

  // Уведомления от веб-страниц (перехваченные из BrowserView)
  const [browserNotifications, setBrowserNotifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem('intra-browser-notifications') || '[]'); } catch { return []; }
  });

  const clearBrowserNotifications = useCallback(() => {
    setBrowserNotifications([]);
    localStorage.removeItem('intra-browser-notifications');
  }, []);

  const setBookmarks = useCallback((updater) => {
    setBookmarksState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem('intra-bookmarks', JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const firstTab = tabs[0];
    if (isElectron) window.electronAPI.createTab(firstTab.id, firstTab.url);
  }, []); // eslint-disable-line

  // Find in page result listener
  useEffect(() => {
    if (!isElectron) return;
    const off = window.electronAPI.onFindResult?.((data) => {
      if (data.tabId === activeTabId) {
        setFindResult({ active: data.activeMatchOrdinal, total: data.matches });
      }
    }) ?? (() => {});
    return off;
  }, [activeTabId]); // eslint-disable-line

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.includes('Mac');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) {
        if (e.key === 'F5') { e.preventDefault(); handleReload(); }
        if (e.key === 'F3' && findBarOpen) { e.preventDefault(); handleFindNext(true); }
        if (e.key === 'Escape' && findBarOpen) { closeFindBar(); }
        return;
      }
      switch (e.key.toLowerCase()) {
        case 't': e.preventDefault(); handleNewTab(); break;
        case 'w': e.preventDefault(); handleCloseTab(activeTabId); break;
        case 'r': e.preventDefault(); handleReload(); break;
        case 'f': {
          const tab = tabs.find(t => t.id === activeTabId);
          if (tab && !tab.isHome && !tab.isAiChat && !tab.isBlocked) {
            e.preventDefault();
            setFindBarOpen(v => !v);
            if (!findBarOpen) setTimeout(() => findInputRef.current?.focus(), 50);
          }
          break;
        }
        case 'l': e.preventDefault(); addressBarRef.current?.focus(); addressBarRef.current?.select(); break;
        case '=': case '+': { e.preventDefault(); handleZoomIn(); break; }
        case '-': e.preventDefault(); handleZoomOut(); break;
        case '0': e.preventDefault(); handleZoomReset(); break;
        case 'tab': {
          e.preventDefault();
          const idx = tabs.findIndex(t => t.id === activeTabId);
          const next = e.shiftKey
            ? tabs[(idx - 1 + tabs.length) % tabs.length]
            : tabs[(idx + 1) % tabs.length];
          handleSwitchTab(next.id);
          break;
        }
      }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); handleGoBack(); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); handleGoForward(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs, findBarOpen]); // eslint-disable-line

  useEffect(() => {
    const root = document.getElementById('root');
    const loader = document.getElementById('loader');
    if (root) root.classList.add('app-ready');
    if (loader) loader.classList.add('hidden');
  }, []);

  useEffect(() => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) setAddressBarValue(tab.isHome || tab.isBlocked ? '' : tab.url);
  }, [activeTabId, tabs]);

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.onTabNavigated(({ tabId, url }) => {
      setTabs(prev => {
        const tab = prev.find(t => t.id === tabId);
        if (!tab?.isPrivate) trackVisit(url, tab?.title, tab?.favicon);
        return prev.map(t => t.id === tabId ? { ...t, url, isHome: false, isBlocked: false } : t);
      });
      if (tabId === activeTabId) setAddressBarValue(url);
    });
    window.electronAPI.onTabTitleUpdated(({ tabId, title }) => {
      setTabs(prev => {
        const tab = prev.find(t => t.id === tabId);
        if (tab?.url && !tab?.isPrivate) updateVisitMeta(tab.url, { title });
        return prev.map(t => t.id === tabId ? { ...t, title } : t);
      });
    });
    window.electronAPI.onTabFaviconUpdated(({ tabId, favicon }) => {
      setTabs(prev => {
        const tab = prev.find(t => t.id === tabId);
        if (tab?.url && !tab?.isPrivate) updateVisitMeta(tab.url, { favicon });
        return prev.map(t => t.id === tabId ? { ...t, favicon } : t);
      });
    });
    window.electronAPI.onTabLoading(({ tabId, loading }) =>
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, loading } : t)));
    window.electronAPI.onTabNavState(({ tabId, canGoBack, canGoForward }) =>
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, canGoBack, canGoForward } : t)));
    window.electronAPI.onOpenNewTab(({ url }) => handleNewTab(url));

    const offPrivateTab = window.electronAPI.onOpenPrivateTab?.((data) => handleNewPrivateTab(data.url)) ?? (() => {});

    const offSelectionReq = window.electronAPI.onAiSelectionRequest?.((data) => {
      setSidebarSelectionReq(data);
      setForceSidebarAiPanel(true);
    }) ?? (() => {});

    const offBrowserNotif = window.electronAPI.onBrowserNotification?.((data) => {
      setBrowserNotifications(prev => {
        const next = [data, ...prev].slice(0, 50);
        localStorage.setItem('intra-browser-notifications', JSON.stringify(next));
        return next;
      });
    }) ?? (() => {});

    return () => {
      ['tab-navigated','tab-title-updated','tab-favicon-updated',
       'tab-loading','tab-can-go-back','open-new-tab'].forEach(ch =>
        window.electronAPI.removeAllListeners(ch));
      offPrivateTab();
      offSelectionReq();
      offBrowserNotif();
    };
  }, [activeTabId]); // eslint-disable-line

  const handleNewTab = useCallback(async (url = null) => {
    const blankMode = !url && localStorage.getItem('intra-newtab') === 'blank';
    const tabUrl = url || 'intra://home';
    const isBlank = blankMode && !url;
    const tab = createTab(tabUrl, 'Новая вкладка', false, isBlank);
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    if (isElectron) {
      await window.electronAPI.createTab(tab.id, tabUrl);
      await window.electronAPI.switchTab(tab.id);
    }
  }, []);

  const handleNewPrivateTab = useCallback(async (url = 'intra://home') => {
    const tab = createTab(url, url === 'intra://home' ? 'Приватная вкладка' : url, true);
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    if (isElectron) {
      await window.electronAPI.createPrivateTab(tab.id, url);
      await window.electronAPI.switchTab(tab.id);
    }
  }, []);

  const handleSwitchTab = useCallback(async (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    // Force synchronous React DOM update BEFORE adding the BrowserView,
    // so the AiChatPage/HomePage is removed from the DOM before the
    // BrowserView appears at y=84 — preventing the "ghost" header overlap.
    flushSync(() => { setActiveTabId(tabId); });
    if (isElectron) {
      await window.electronAPI.switchTab(tabId, (tab?.isHome || tab?.isAiChat) ?? true);
    }
  }, [tabs]);

  const handleCloseTab = useCallback(async (tabId) => {
    if (tabs.length === 1) {
      // Заменяем последнюю вкладку новой домашней, а не добавляем ещё одну
      const newTab = createTab();
      setTabs([newTab]);
      setActiveTabId(newTab.id);
      if (isElectron) {
        await window.electronAPI.closeTab(tabId);
        await window.electronAPI.createTab(newTab.id, 'intra://home');
        await window.electronAPI.switchTab(newTab.id);
      }
      return;
    }
    const idx = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      const nextTab = newTabs[Math.max(0, idx - 1)];
      setActiveTabId(nextTab.id);
      if (isElectron) await window.electronAPI.switchTab(nextTab.id);
    }
    if (isElectron) await window.electronAPI.closeTab(tabId);
  }, [tabs, activeTabId]);

  const goHome = useCallback(async (tabId) => {
    const tid = tabId || activeTabId;
    setTabs(prev => prev.map(t => t.id === tid
      ? { ...t, url: 'intra://home', title: 'Новая вкладка', isHome: true, isBlocked: false, loading: false }
      : t));
    setAddressBarValue('');
    if (isElectron) await window.electronAPI.goHome(tid);
  }, [activeTabId]);

  const searchEngineUrls = {
    yandex: q => `https://yandex.ru/search/?text=${encodeURIComponent(q)}`,
    google: q => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    duckduckgo: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    bing: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  };

  const handleNavigate = useCallback(async (url) => {
    if (!url || url === 'intra://home') return goHome(activeTabId);

    // Обработка intra:// протокола (Интрасеть)
    if (url.startsWith('intra://')) {
      const intraPath = url.replace('intra://', '');
      
      // intra://nodes, intra://chat, intra://files, intra://settings, intra://my
      const validIntraUrls = ['nodes', 'chat', 'files', 'settings', 'my', 'ai-chat'];
      if (validIntraUrls.includes(intraPath) || intraPath.startsWith('chat/')) {
        if (intraPath === 'ai-chat') {
          return handleOpenAiChat();
        }
        // Для других intra:// страниц - показать в HomePage через специальный URL
        setAddressBarValue(url);
        flushSync(() => {
          setTabs(prev => prev.map(t => t.id === activeTabId
            ? { ...t, url: url, loading: false, isHome: false, isAiChat: false, isBlocked: false }
            : t));
        });
        return;
      }
      // Неизвестный intra:// адрес - на главную
      return goHome(activeTabId);
    }

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('file://')) {
      const isUrl = /^[\w.-]+\.[a-z]{2,}(\/.*)?$/.test(finalUrl) || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(finalUrl);
      const searchFn = searchEngineUrls[searchEngine] || searchEngineUrls.yandex;
      finalUrl = isUrl ? `http://${finalUrl}` : searchFn(finalUrl);
    }

    if (intranetOnly && !isIntranetUrl(finalUrl)) {
      setTabs(prev => prev.map(t => t.id === activeTabId
        ? { ...t, isHome: false, isBlocked: true, blockedUrl: finalUrl, loading: false }
        : t));
      setAddressBarValue('');
      if (isElectron) await window.electronAPI.goHome(activeTabId);
      return;
    }

    setAddressBarValue(finalUrl);
    flushSync(() => {
      setTabs(prev => prev.map(t => t.id === activeTabId
        ? { ...t, url: finalUrl, loading: true, isHome: false, isAiChat: false, isBlocked: false }
        : t));
    });
    if (isElectron) await window.electronAPI.navigate(activeTabId, finalUrl);
  }, [activeTabId, intranetOnly, goHome, searchEngine]); // eslint-disable-line

  const handleGoBack = useCallback(async () => {
    if (isElectron) await window.electronAPI.goBack(activeTabId);
  }, [activeTabId]);

  const handleGoForward = useCallback(async () => {
    if (isElectron) await window.electronAPI.goForward(activeTabId);
  }, [activeTabId]);

  const handleReload = useCallback(async () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab?.isHome || tab?.isBlocked) return;
    if (tab?.loading) {
      if (isElectron) await window.electronAPI.stopLoading(activeTabId);
    } else {
      if (isElectron) await window.electronAPI.reload(activeTabId);
    }
  }, [activeTabId, tabs]);


  const handleOpenDevTools = useCallback(() => {
    if (isElectron) window.electronAPI.openDevTools?.();
  }, []);

  // ── Find in page ────────────────────────────────────────────────────────────
  const handleFindNext = useCallback((forward = true) => {
    if (!isElectron || !findQuery.trim()) return;
    window.electronAPI.findInPage(activeTabId, findQuery, { forward, findNext: true });
  }, [activeTabId, findQuery]);

  const closeFindBar = useCallback(() => {
    setFindBarOpen(false);
    setFindQuery('');
    setFindResult(null);
    if (isElectron) window.electronAPI.stopFind(activeTabId, 'clearSelection');
  }, [activeTabId]);

  const handleFindChange = useCallback((text) => {
    setFindQuery(text);
    setFindResult(null);
    if (!isElectron) return;
    if (text.trim()) {
      window.electronAPI.findInPage(activeTabId, text, { forward: true, findNext: false });
    } else {
      window.electronAPI.stopFind(activeTabId, 'clearSelection');
    }
  }, [activeTabId]);

  // ── Zoom ────────────────────────────────────────────────────────────────────
  const handleZoomIn = useCallback(async () => {
    if (!isElectron) return;
    const res = await window.electronAPI.zoomIn(activeTabId);
    if (res) setTabZoom(prev => ({ ...prev, [activeTabId]: res.zoomLevel }));
  }, [activeTabId]);

  const handleZoomOut = useCallback(async () => {
    if (!isElectron) return;
    const res = await window.electronAPI.zoomOut(activeTabId);
    if (res) setTabZoom(prev => ({ ...prev, [activeTabId]: res.zoomLevel }));
  }, [activeTabId]);

  const handleZoomReset = useCallback(async () => {
    if (!isElectron) return;
    await window.electronAPI.zoomReset(activeTabId);
    setTabZoom(prev => ({ ...prev, [activeTabId]: 0 }));
  }, [activeTabId]);

  // ── Tab mute ────────────────────────────────────────────────────────────────
  const handleToggleMute = useCallback(async () => {
    if (!isElectron) return;
    const muted = !tabMuted[activeTabId];
    await window.electronAPI.setTabMuted(activeTabId, muted);
    setTabMuted(prev => ({ ...prev, [activeTabId]: muted }));
  }, [activeTabId, tabMuted]);

  const handleOpenAiChat = useCallback(async () => {
    const existing = tabs.find(t => t.isAiChat);
    if (existing) {
      setActiveTabId(existing.id);
      if (isElectron) await window.electronAPI.switchTab(existing.id, true);
      return;
    }
    const tab = createTab('intra://ai-chat', 'AI Чат');
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    if (isElectron) {
      await window.electronAPI.createTab(tab.id, 'intra://home');
      await window.electronAPI.switchTab(tab.id, true);
    }
  }, [tabs]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const handleCopyUrl = useCallback(() => {
    const url = activeTab?.url;
    if (url && !activeTab?.isHome && !activeTab?.isBlocked) {
      navigator.clipboard.writeText(url).catch(() => {});
      setCopyUrlFeedback(true);
      setTimeout(() => setCopyUrlFeedback(false), 1400);
    }
  }, [activeTab]);

  if (activeTab?.isHome && !activeTab?.isBlocked) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <AppTabBar
          tabs={tabs} activeTabId={activeTabId}
          onSwitchTab={handleSwitchTab} onCloseTab={handleCloseTab} onNewTab={() => handleNewTab()}
        />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeTab?.isBlank ? (
            <BlankTab onNavigate={(url) => {
              setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isBlank: false } : t));
              handleNavigate(url);
            }} />
          ) : <HomePage
            onNavigate={handleNavigate}
            tabs={tabs} activeTabId={activeTabId}
            onNewTab={() => handleNewTab()}
            onNewPrivateTab={handleNewPrivateTab}
            onSwitchTab={handleSwitchTab}
            onCloseTab={handleCloseTab}
            intranetOnly={intranetOnly}
            onToggleIntranetOnly={() => setIntranetOnly(v => !v)}
            bookmarks={bookmarks}
            onBookmarksChange={setBookmarks}
            onOpenAiChat={handleOpenAiChat}
            browserNotifications={browserNotifications}
            onClearBrowserNotifications={clearBrowserNotifications}
            searchEngine={searchEngine}
            onSearchEngineChange={setSearchEngine}
          />}
        </div>
      </div>
    );
  }

  const networkModes = [
    { id: 'internet', label: 'Интернет' },
    { id: 'smart',    label: 'Smart' },
    { id: 'intranet', label: 'Интрасеть' },
  ];
  const currentNetMode = intranetOnly ? 'intranet' : 'internet';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'white' }}>
      <BrowserSidebar
        onNavigate={handleNavigate}
        onGoHome={() => goHome(activeTabId)}
        onPanelChange={() => {}}
        bookmarks={bookmarks}
        onBookmarksChange={setBookmarks}
        activeTab={activeTab}
        onOpenAiChat={handleOpenAiChat}
        searchEngine={searchEngine}
        onSearchEngineChange={setSearchEngine}
        selectionRequest={sidebarSelectionReq}
        onSelectionHandled={() => setSidebarSelectionReq(null)}
        forceOpenAiPanel={forceSidebarAiPanel}
        onPanelOpened={() => setForceSidebarAiPanel(false)}
        isAiChatTabActive={activeTab?.isAiChat}
      />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <AppTabBar
          tabs={tabs} activeTabId={activeTabId}
          onSwitchTab={handleSwitchTab} onCloseTab={handleCloseTab} onNewTab={() => handleNewTab()}
        />

        {activeTab?.isAiChat && (
          <AiChatPage
            activeTab={activeTab}
            selectionRequest={pendingSelectionReq}
            onSelectionHandled={() => setPendingSelectionReq(null)}
          />
        )}

        {!activeTab?.isAiChat && <div style={{
          display: 'flex', alignItems: 'center', gap: 6, height: 46, padding: '0 10px',
          background: 'white', borderBottom: '1px solid #e2e8f0', flexShrink: 0
        }}>
          {[
            { onClick: handleGoBack, disabled: !activeTab?.canGoBack, icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg> },
            { onClick: handleGoForward, disabled: !activeTab?.canGoForward, icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg> },
            { onClick: handleReload, icon: activeTab?.loading
              ? <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              : <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            },
            { onClick: () => goHome(activeTabId), icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg> },
          ].map((btn, i) => (
            <NavBtn key={i} onClick={btn.onClick} disabled={btn.disabled}>{btn.icon}</NavBtn>
          ))}

          <AddressBar
            value={addressBarValue}
            onChange={setAddressBarValue}
            onNavigate={handleNavigate}
            activeTab={activeTab}
          />

          {activeTab && !activeTab.isHome && !activeTab.isBlocked && (
            <NavBtn onClick={handleCopyUrl} title="Копировать URL">
              {copyUrlFeedback
                ? <svg width="14" height="14" fill="none" stroke="#22c55e" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                : <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              }
            </NavBtn>
          )}

          {/* Zoom controls — visible only on web pages */}
          {activeTab && !activeTab.isHome && !activeTab.isBlocked && !activeTab.isAiChat && (() => {
            const zoom = tabZoom[activeTabId] || 0;
            const pct = Math.round(100 * Math.pow(1.2, zoom));
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 1, background: '#f8fafc', borderRadius: 7, border: '1px solid #e2e8f0', padding: '0 2px', flexShrink: 0 }}>
                <NavBtn onClick={handleZoomOut} title="Уменьшить (Ctrl+-)">
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M5 12h14"/></svg>
                </NavBtn>
                <button onClick={handleZoomReset} title="Сбросить масштаб (Ctrl+0)"
                  style={{ fontSize: 10, fontWeight: 700, color: zoom !== 0 ? '#2563eb' : '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', minWidth: 32, textAlign: 'center' }}
                >{pct}%</button>
                <NavBtn onClick={handleZoomIn} title="Увеличить (Ctrl+=)">
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                </NavBtn>
              </div>
            );
          })()}

          {/* Mute button */}
          {activeTab && !activeTab.isHome && !activeTab.isBlocked && !activeTab.isAiChat && (
            <NavBtn onClick={handleToggleMute} title={tabMuted[activeTabId] ? 'Включить звук' : 'Выключить звук'}>
              {tabMuted[activeTabId]
                ? <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd"/><path d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>
                : <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536A5 5 0 005.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5z"/></svg>
              }
            </NavBtn>
          )}

          {/* Find in page button */}
          {activeTab && !activeTab.isHome && !activeTab.isBlocked && !activeTab.isAiChat && (
            <NavBtn onClick={() => { setFindBarOpen(v => !v); if (!findBarOpen) setTimeout(() => findInputRef.current?.focus(), 50); }}
              active={findBarOpen} title="Найти на странице (Ctrl+F)">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </NavBtn>
          )}

          <div style={{ display: 'flex', gap: 1, background: '#f1f5f9', borderRadius: 7, padding: 2, border: '1px solid #e2e8f0', flexShrink: 0 }}>
            {networkModes.map(m => (
              <button key={m.id} onClick={() => { if (m.id === 'intranet') setIntranetOnly(true); else if (m.id === 'internet') setIntranetOnly(false); }} style={{
                padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
                background: currentNetMode === m.id ? '#2563eb' : 'transparent',
                color: currentNetMode === m.id ? 'white' : '#64748b',
                boxShadow: currentNetMode === m.id ? '0 1px 6px rgba(37,99,235,0.3)' : 'none'
              }}>{m.label}</button>
            ))}
          </div>

          {/* Меню браузера "⋯" — overlay окно поверх BrowserView */}
          <div ref={menuBtnRef}>
            <NavBtn
              onClick={() => {
                if (isElectron && menuBtnRef.current) {
                  const r = menuBtnRef.current.getBoundingClientRect();
                  window.electronAPI.openBrowserMenu({ right: Math.round(r.right), bottom: Math.round(r.bottom) });
                }
              }}
              title="Меню"
            >
              <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </NavBtn>
          </div>

          {/* Закладка — добавить/убрать текущую страницу */}
          {activeTab && !activeTab.isHome && !activeTab.isBlocked && (() => {
            const isBookmarked = bookmarks.some(b => b.url === activeTab.url);
            return (
              <NavBtn
                onClick={() => {
                  const url = activeTab.url;
                  const title = activeTab.title || url;
                  if (isBookmarked) {
                    setBookmarks(prev => prev.filter(b => b.url !== url));
                  } else {
                    setBookmarks(prev => [...prev, { url, title, favicon: activeTab.favicon || null }]);
                  }
                }}
                active={isBookmarked}
                title={isBookmarked ? 'Убрать из закладок' : 'Добавить в закладки'}
              >
                <svg width="15" height="15" fill={isBookmarked ? '#2563eb' : 'none'} stroke={isBookmarked ? '#2563eb' : 'currentColor'} viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                </svg>
              </NavBtn>
            );
          })()}

        </div>}

        {/* Find in page bar */}
        {findBarOpen && activeTab && !activeTab.isHome && !activeTab.isBlocked && !activeTab.isAiChat && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 10px',
            background: 'white', borderBottom: '1px solid #e2e8f0', flexShrink: 0
          }}>
            <input
              ref={findInputRef}
              value={findQuery}
              onChange={e => handleFindChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleFindNext(!e.shiftKey);
                if (e.key === 'Escape') closeFindBar();
              }}
              placeholder="Найти на странице..."
              style={{
                flex: 1, maxWidth: 260, height: 26, padding: '0 8px', fontSize: 13,
                border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none',
                background: '#f8fafc', color: '#1e293b'
              }}
            />
            {findResult && (
              <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                {findResult.active}/{findResult.total}
              </span>
            )}
            <NavBtn onClick={() => handleFindNext(false)} title="Предыдущее (Shift+Enter)">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M18 15l-6-6-6 6"/></svg>
            </NavBtn>
            <NavBtn onClick={() => handleFindNext(true)} title="Следующее (Enter)">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </NavBtn>
            <NavBtn onClick={closeFindBar} title="Закрыть (Esc)">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </NavBtn>
          </div>
        )}

        {!activeTab?.isAiChat && activeTab?.isBlocked && (
          <BlockedPage
            url={activeTab.blockedUrl}
            onGoHome={() => goHome(activeTabId)}
            onDisableBlock={() => setIntranetOnly(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Blank new tab ────────────────────────────────────────────────────────────
function BlankTab({ onNavigate }) {
  const [q, setQ] = React.useState('');
  const ref = React.useRef(null);
  React.useEffect(() => { setTimeout(() => ref.current?.focus(), 80); }, []);
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', background:'white', gap:16 }}>
      <div style={{ fontSize:28, fontWeight:800, color:'#1e293b', letterSpacing:'-0.03em' }}>Intraset</div>
      <div style={{
        display:'flex', alignItems:'center', gap:8, width:440, height:44,
        background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:12,
        padding:'0 14px', boxShadow:'0 2px 12px rgba(0,0,0,0.05)'
      }}>
        <svg width="15" height="15" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2" style={{ flexShrink:0 }}>
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input ref={ref} value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && q.trim()) onNavigate(q.trim()); }}
          placeholder="Введите адрес или поисковый запрос..."
          style={{ flex:1, border:'none', background:'none', outline:'none', fontSize:14, color:'#1e293b' }}
        />
        {q && (
          <button onClick={() => onNavigate(q.trim())} style={{
            padding:'4px 12px', borderRadius:7, border:'none', background:'#2563eb',
            color:'white', fontSize:12, fontWeight:600, cursor:'pointer'
          }}>Перейти</button>
        )}
      </div>
    </div>
  );
}

// ─── UI preferences helper (animations / compact) ────────────────────────────
function applyUiPrefs({ animations, compact }) {
  let el = document.getElementById('intra-ui-style');
  if (!el) { el = document.createElement('style'); el.id = 'intra-ui-style'; document.head.appendChild(el); }
  el.textContent = !animations
    ? '*, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }'
    : '';
  document.body.classList.toggle('intra-compact', Boolean(compact));
}

// ─── BrowserSidebar ────────────────────────────────────────────────────────────
function BrowserSidebar({ onNavigate, onGoHome, onPanelChange, bookmarks, onBookmarksChange, activeTab, onOpenAiChat, searchEngine, onSearchEngineChange, selectionRequest, onSelectionHandled, forceOpenAiPanel, onPanelOpened, isAiChatTabActive }) {
  const [panel, setPanel] = React.useState(null);
  const [newBm, setNewBm] = React.useState({ title: '', url: '' });
  const [showAddBm, setShowAddBm] = React.useState(false);
  const [histItems, setHistItems] = React.useState([]);
  const [hovAiChat, setHovAiChat] = React.useState(false);
  const [newTabMode, setNewTabMode] = React.useState(() => localStorage.getItem('intra-newtab') || 'home');
  const [uiSettings, setUiSettings] = React.useState(() => ({
    animations: localStorage.getItem('intra-ui-animations') !== 'false',
    compact: localStorage.getItem('intra-ui-compact') !== 'false',
  }));
  React.useEffect(() => { applyUiPrefs(uiSettings); }, []); // eslint-disable-line
  const toggleUiSetting = (key) => {
    setUiSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(`intra-ui-${key}`, String(next[key]));
      applyUiPrefs(next);
      return next;
    });
  };

  // AI GGUF — node-llama-cpp (нативный, главный процесс, без ограничений по размеру)
  const [aiModel, setAiModel] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('intra-ai-model') || 'null'); } catch { return null; }
  });
  const [aiLoaded, setAiLoaded] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiChat, setAiChat] = React.useState([]);
  const [aiInput, setAiInput] = React.useState('');
  const [aiChatHistory, setAiChatHistory] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('intra-ai-chat-history') || '[]'); } catch { return []; }
  });
  const [aiShowHistory, setAiShowHistory] = React.useState(false);
  const [aiCurrentConversationId, setAiCurrentConversationId] = React.useState(null);
  const [aiContextSize, setAiContextSize] = React.useState(() => Number(localStorage.getItem('intra-ai-context')) || 4096);
  const [aiServerContextSize, setAiServerContextSize] = React.useState(4096);
  const [aiLoadProgress, setAiLoadProgress] = React.useState(null); // null=idle, 0-100=loading
  const aiLoadTimerRef = React.useRef(null);
  const [aiStreamedTokens, setAiStreamedTokens] = React.useState(0);
  const aiChatEndRef = React.useRef(null);

  // External AI Providers (for page analysis without GGUF model)
  const [aiProviders, setAiProviders] = React.useState([]);
  const [activeProvider, setActiveProvider] = React.useState(null);
  const [providerEnabled, setProviderEnabled] = React.useState(false);
  const [selectedModel, setSelectedModel] = React.useState('');
  const [openRouterModels, setOpenRouterModels] = React.useState([]);
  const [aiProcessingStatus, setAiProcessingStatus] = React.useState('');

  // Downloads - используем polling вместо событий
  const [downloads, setDownloads] = React.useState([]);

  React.useEffect(() => {
    if (!isElectron) {
      console.log('[Downloads-DBG] Not in Electron, skipping');
      return;
    }
    console.log('[Downloads-DBG] Starting download polling...');

    // Опрос загрузок каждую секунду
    const pollInterval = setInterval(async () => {
      try {
        const res = await window.electronAPI.getDownloads();
        console.log('[Downloads-DBG] Poll result:', res);
        if (res?.success) {
          console.log('[Downloads-DBG] Poll downloads count:', res.downloads?.length);
          console.log('[Downloads-DBG] Poll downloads array:', res.downloads);
          setDownloads(res.downloads || []);
          console.log('[Downloads-DBG] setDownloads called with:', res.downloads?.length, 'items');
        }
      } catch (e) {
        console.error('[Downloads-DBG] Poll error:', e);
      }
    }, 1000);

    // Также слушаем события для мгновенного обновления
    const offStarted = window.electronAPI.onDownloadStarted((data) => {
      console.log('[Downloads-DBG] onDownloadStarted:', data);
    });
    const offUpdated = window.electronAPI.onDownloadUpdated((data) => {
      console.log('[Downloads-DBG] onDownloadUpdated:', data);
    });

    return () => {
      clearInterval(pollInterval);
      offStarted();
      offUpdated();
    };
  }, []);

  // Автоскролл к последнему сообщению
  React.useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiChat]);

  // Ref to track whether AI chat tab is active (avoids stale closure in event handlers)
  const isAiChatTabActiveRef = React.useRef(isAiChatTabActive);
  React.useEffect(() => { isAiChatTabActiveRef.current = isAiChatTabActive; }, [isAiChatTabActive]);

  // Синхронизация состояния с главным процессом + потоковые события
  React.useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.aiGetStatus().then(status => {
      if (status.loaded && status.modelName) {
        setAiLoaded(true);
        setAiModel(prev => prev || { name: status.modelName });
        if (status.contextSize) setAiServerContextSize(status.contextSize);
      }
    }).catch(() => {});

    const offToken = window.electronAPI.onAiToken((text) => {
      if (isAiChatTabActiveRef.current) return; // AiChatPage handles this
      setAiStreamedTokens(n => n + 1);
      setAiChat(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [...prev.slice(0, -1), { role: 'bot', text: (last.text || '') + text, streaming: true }];
        }
        return [...prev, { role: 'bot', text, streaming: true }];
      });
    });
    const offDone = window.electronAPI.onAiDone(() => {
      if (isAiChatTabActiveRef.current) return;
      setAiLoading(false);
      setAiStreamedTokens(0);
      setAiChat(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, streaming: false } : m));
    });
    const offError = window.electronAPI.onAiError((msg) => {
      if (isAiChatTabActiveRef.current) return;
      setAiLoading(false);
      setAiStreamedTokens(0);
      setAiChat(prev => [...prev, { role: 'bot', text: `❌ Ошибка: ${msg}` }]);
    });
    const offLog = window.electronAPI.onAiServerLog?.((text) => {
      // Показываем вывод сервера только пока идёт загрузка (последнее сообщение — serverLog)
      setAiChat(prev => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        if (last?.isServerLog) {
          const lines = (last.text + text).split('\n').slice(-6).join('\n');
          return [...prev.slice(0, -1), { ...last, text: lines }];
        }
        return prev;
      });
    }) ?? (() => {});
    return () => { offToken(); offDone(); offError(); offLog(); };
  }, []);

  // Initialize external AI providers
  React.useEffect(() => {
    if (!isElectron) return;
    window.electronAPI.aiGetProviders().then(data => {
      setAiProviders(data.providers || []);
      setActiveProvider(data.activeProvider);
      setProviderEnabled(data.enabled);
      setSelectedModel(data.activeModel || '');

      // Fetch OpenRouter models if that provider is enabled
      if (data.activeProvider === 'openrouter' && data.enabled) {
        setAiProcessingStatus('Загрузка списка моделей...');
        window.electronAPI.aiGetOpenRouterModels().then(res => {
          setAiProcessingStatus('');
          if (res.success && res.models) {
            setOpenRouterModels(res.models);
            if (!data.activeModel || !res.models.find(m => m.id === data.activeModel)) {
              setSelectedModel(res.models[0]?.id || '');
            }
          }
        }).catch(() => { setAiProcessingStatus(''); });
      }
    }).catch(() => {});
  }, []);

  // Listen for external AI provider events for sidebar panel
  React.useEffect(() => {
    if (!isElectron) return;
    const offProviderToken = window.electronAPI.onAiProviderToken((text) => {
      if (isAiChatTabActiveRef.current) return;
      setAiStreamedTokens(n => n + 1);
      setAiChat(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [...prev.slice(0, -1), { role: 'bot', text: (last.text || '') + text, streaming: true }];
        }
        return [...prev, { role: 'bot', text, streaming: true }];
      });
    });
    const offProviderDone = window.electronAPI.onAiProviderDone(() => {
      if (isAiChatTabActiveRef.current) return;
      setAiLoading(false);
      setAiStreamedTokens(0);
      setAiChat(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, streaming: false } : m));
    });
    const offProviderError = window.electronAPI.onAiProviderError((msg) => {
      if (isAiChatTabActiveRef.current) return;
      setAiLoading(false);
      setAiStreamedTokens(0);
      setAiChat(prev => [...prev, { role: 'bot', text: `❌ Ошибка: ${msg}` }]);
    });
    return () => { offProviderToken(); offProviderDone(); offProviderError(); };
  }, []);

  const handleLoadModel = async () => {
    if (!isElectron) return;

    const result = await window.electronAPI.showOpenDialog({
      title: 'Выберите GGUF модель',
      filters: [{ name: 'GGUF Models', extensions: ['gguf'] }, { name: 'All Files', extensions: ['*'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths?.length) return;

    const modelPath = result.filePaths[0];
    const modelName = modelPath.replace(/\\/g, '/').split('/').pop();
    setAiLoading(true);
    setAiLoaded(false);
    setAiLoadProgress(0);
    setAiChat([{ role: 'bot', text: `Запуск llama-server с моделью ${modelName}...\nЭто может занять несколько минут.`, isServerLog: true }]);

    // Fake progress animation: slow approach to 88%
    let prog = 0;
    aiLoadTimerRef.current = setInterval(() => {
      prog = Math.min(88, prog + (88 - prog) * 0.04 + 0.5);
      setAiLoadProgress(Math.floor(prog));
    }, 400);

    const serverPath = localStorage.getItem('intra-llama-server') || null;
    let res;
    try {
      res = await window.electronAPI.aiLoadModel(modelPath, serverPath, aiContextSize);
    } catch (err) {
      res = { success: false, error: err.message };
    }

    clearInterval(aiLoadTimerRef.current);
    aiLoadTimerRef.current = null;

    if (res.success) {
      setAiLoadProgress(100);
      setTimeout(() => setAiLoadProgress(null), 900);
      const model = { name: modelName, path: modelPath };
      setAiModel(model);
      setAiLoaded(true);
      localStorage.setItem('intra-ai-model', JSON.stringify(model));
      setAiChat([{ role: 'bot', text: `Модель "${modelName}" загружена. Задайте вопрос!` }]);
    } else {
      setAiLoadProgress(null);
      setAiLoaded(false);
      setAiChat(prev => [...prev, { role: 'bot', text: `❌ Ошибка: ${res.error}` }]);
    }
    setAiLoading(false);
  };

  const closePanel = async () => {
    if (isElectron) await window.electronAPI.sidebarPanelToggled(false);
    setPanel(null);
    onPanelChange?.(false);
  };

  // Закрывать панель при смене вкладки
  React.useEffect(() => {
    if (panel !== null) {
      closePanel();
    }
  }, [activeTab?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePanel = async (id) => {
    const next = panel === id ? null : id;
    const open = next !== null;
    // Сначала изменяем BrowserView bounds, потом показываем панель
    if (isElectron) await window.electronAPI.sidebarPanelToggled(open);
    onPanelChange?.(open);
    if (next === 'history') {
      try { setHistItems(JSON.parse(localStorage.getItem('intra-history') || '[]').slice(0, 100)); } catch { setHistItems([]); }
    }
    setPanel(next);
  };

  const sendAiMessage = () => {
    if (!aiInput.trim() || (!aiLoaded && !providerEnabled) || aiLoading) return;
    const text = aiInput.trim();
    setAiInput('');
    setAiStreamedTokens(0);
    setAiChat(prev => [...prev, { role: 'user', text }]);
    setAiLoading(true);

    // Use provider API if GGUF not loaded but provider is enabled
    if (!aiLoaded && providerEnabled) {
      setAiProcessingStatus('Обработка запроса...');
      window.electronAPI.aiChatWithProvider(text, selectedModel)
        .then(result => {
          setAiLoading(false);
          setAiProcessingStatus('');
          if (!result?.success && result?.error) {
            setAiChat(prev => [...prev, { role: 'bot', text: `❌ ${result.error}` }]);
          }
        })
        .catch(() => { setAiLoading(false); setAiProcessingStatus(''); });
      return;
    }

    // Ответ приходит через события ai-token / ai-done / ai-error
    window.electronAPI.aiChat(text).then(result => {
      setAiLoading(false);
      if (!result?.success && result?.error) {
        setAiChat(prev => [...prev, { role: 'bot', text: `❌ ${result.error}` }]);
      }
    }).catch(() => { setAiLoading(false); });
  };

  const analyzePageWith = async (label, prompt) => {
    if ((!aiLoaded && !providerEnabled) || aiLoading || !isElectron) return;
    setAiProcessingStatus('Чтение страницы...');
    const res = await window.electronAPI.aiGetPageContent();
    if (!res.success) {
      setAiProcessingStatus('');
      setAiChat(prev => [...prev, { role: 'bot', text: `❌ Не удалось получить содержимое: ${res.error}` }]);
      return;
    }
    // Жёсткий лимит ~500 токенов для контента: на CPU длинный промпт → модель не генерирует ничего.
    // При необходимости пользователь может задать вопрос вручную в чате.
    const contentLimit = 1500;
    const content = res.content.slice(0, contentLimit);
    // "Ответ:" в конце принуждает модель в Content-only формате к генерации ответа
    const fullPrompt = `${prompt}\n\nСтраница: "${res.title}"\n\nФрагмент текста:\n${content}\n\nОтвет:`;
    setAiChat(prev => [...prev, { role: 'user', text: label }]);
    setAiLoading(true);

    // Use provider API if GGUF not loaded but provider is enabled
    if (!aiLoaded && providerEnabled) {
      setAiProcessingStatus('Анализ страницы ИИ...');
      window.electronAPI.aiChatWithProvider(fullPrompt, selectedModel)
        .then(result => {
          setAiLoading(false);
          setAiProcessingStatus('');
          if (!result?.success) {
            setAiChat(prev => [...prev, { role: 'bot', text: `❌ ${result?.error || 'Модель не вернула ответ'}` }]);
          }
        })
        .catch(() => {
          setAiLoading(false);
          setAiProcessingStatus('');
          setAiChat(prev => [...prev, { role: 'bot', text: '❌ Ошибка запроса к API' }]);
        });
      return;
    }

    // Изолированный запрос — не записывается в историю диалога
    window.electronAPI.aiAnalyzePage(fullPrompt)
      .then(result => {
        setAiLoading(false);
        if (!result?.success) {
          setAiChat(prev => [...prev, { role: 'bot', text: `❌ ${result?.error || 'Модель не вернула ответ'}` }]);
        }
      })
      .catch(() => {
        setAiLoading(false);
        setAiChat(prev => [...prev, { role: 'bot', text: '❌ Ошибка запроса к модели' }]);
      });
  };

  const analyzeSelectionWith = async (text, label, prompt, promptType) => {
    if ((!aiLoaded && !providerEnabled) || aiLoading || !isElectron) return;
    setAiChat(prev => [...prev, { role: 'user', text: `${label}:\n"${text.slice(0, 200)}${text.length > 200 ? '…' : ''}"` }]);
    setAiLoading(true);

    // Use provider API if GGUF not loaded but provider is enabled
    if (!aiLoaded && providerEnabled) {
      // Special case: web search + AI analysis
      if (promptType === 'search') {
        try {
          setAiProcessingStatus('Поиск в интернете...');
          let searchResult = await window.electronAPI.aiWebSearch(text);
          if (!searchResult.success) {
            searchResult = await window.electronAPI.aiWebSearchBing(text);
          }
          if (!searchResult.success) {
            setAiLoading(false);
            setAiProcessingStatus('');
            setAiChat(prev => [...prev, { role: 'bot', text: `❌ ${searchResult.error || 'Ошибка поиска'}` }]);
            return;
          }
          setAiProcessingStatus('Обработка результатов ИИ...');
          const searchPrompt = `На основе результатов веб-поиска по запросу "${text}", ответь на вопрос и укажи источники.\n\nРезультаты поиска:\n${searchResult.results}\n\nИсточники: ${(searchResult.urls || []).join(', ')}`;
          window.electronAPI.aiChatWithProvider(searchPrompt, selectedModel)
            .then(result => {
              setAiLoading(false);
              setAiProcessingStatus('');
              if (!result?.success) {
                setAiChat(prev => [...prev, { role: 'bot', text: result?.error || 'Нет ответа от API' }]);
              }
            })
            .catch(() => {
              setAiLoading(false);
              setAiProcessingStatus('');
              setAiChat(prev => [...prev, { role: 'bot', text: '❌ Ошибка запроса к API' }]);
            });
          return;
        } catch (e) {
          setAiLoading(false);
          setAiProcessingStatus('');
          setAiChat(prev => [...prev, { role: 'bot', text: '❌ Ошибка поиска' }]);
          return;
        }
      }

      // Regular analysis
      setAiProcessingStatus('Анализ текста...');
      const fullPrompt = `${prompt}\n\nТекст для анализа:\n"${text.slice(0, 3000)}${text.length > 3000 ? '...' : ''}"`;
      window.electronAPI.aiChatWithProvider(fullPrompt, selectedModel)
        .then(result => {
          setAiLoading(false);
          setAiProcessingStatus('');
          if (!result?.success) {
            setAiChat(prev => [...prev, { role: 'bot', text: result?.error || 'Нет ответа от API' }]);
          }
        })
        .catch(() => {
          setAiLoading(false);
          setAiProcessingStatus('');
          setAiChat(prev => [...prev, { role: 'bot', text: '❌ Ошибка запроса к API' }]);
        });
      return;
    }

    window.electronAPI.aiAnalyzeSelection(text, prompt)
      .then(result => {
        setAiLoading(false);
        if (!result?.success) {
          setAiChat(prev => [...prev, { role: 'bot', text: result?.error || 'Нет ответа от модели' }]);
        }
      })
      .catch(() => {
        setAiLoading(false);
        setAiChat(prev => [...prev, { role: 'bot', text: '❌ Ошибка запроса к модели' }]);
      });
  };

  // Force-open AI panel when triggered from selection request
  React.useEffect(() => {
    if (forceOpenAiPanel && panel !== 'ai') {
      togglePanel('ai');
      onPanelOpened?.();
    } else if (forceOpenAiPanel) {
      onPanelOpened?.();
    }
  }, [forceOpenAiPanel]); // eslint-disable-line

  // Handle incoming selection request in the sidebar AI panel
  React.useEffect(() => {
    if (!selectionRequest || (!aiLoaded && !providerEnabled) || aiLoading) return;
    const { text, label, prompt, promptType } = selectionRequest;
    onSelectionHandled?.();
    analyzeSelectionWith(text, label, prompt, promptType);
  }, [selectionRequest, aiLoaded, providerEnabled]); // eslint-disable-line

  // AI context usage estimation (for sidebar panel)
  const aiEstimatedTokens = aiChat
    .filter(m => !m.isServerLog)
    .reduce((s, m) => s + Math.ceil((m.text || '').length / 4), 0);
  const aiContextUsedPct = aiLoaded && aiContextSize > 0
    ? Math.min(100, Math.round(aiEstimatedTokens / aiContextSize * 100))
    : 0;
  const aiLastBotMsg = [...aiChat].reverse().find(m => m.role === 'bot' && !m.isServerLog && !m.streaming);

  const GlobeIcon = () => (
    <svg width="24" height="24" viewBox="0 0 100 100" fill="none" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="sgc" cx="35%" cy="35%" r="65%"><stop offset="0%" stopColor="#60c8ff"/><stop offset="100%" stopColor="#1565c0"/></radialGradient>
        <radialGradient id="sgn" cx="30%" cy="30%" r="70%"><stop offset="0%" stopColor="#80d4ff"/><stop offset="100%" stopColor="#1976d2"/></radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" stroke="url(#sgc)" strokeWidth="3" fill="none"/>
      <ellipse cx="50" cy="50" rx="28" ry="46" stroke="url(#sgc)" strokeWidth="2" fill="none"/>
      <ellipse cx="50" cy="50" rx="46" ry="22" stroke="url(#sgc)" strokeWidth="2" fill="none"/>
      <line x1="50" y1="4" x2="50" y2="96" stroke="url(#sgc)" strokeWidth="2"/>
      <line x1="4" y1="50" x2="96" y2="50" stroke="url(#sgc)" strokeWidth="2"/>
      {[[50,4],[50,96],[4,50],[96,50],[50,27],[50,73],[22,28],[78,28],[22,72],[78,72],[50,50]].map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r={i===10?5:3} fill="url(#sgn)"/>
      ))}
    </svg>
  );

  const SBtn = ({ id, title, icon }) => {
    const [hov, setHov] = React.useState(false);
    const isActive = panel === id;
    return (
      <button onClick={() => togglePanel(id)} title={title}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{
          width: '100%', height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 9, border: 'none', cursor: 'pointer',
          background: isActive ? '#eff6ff' : hov ? '#f8fafc' : 'transparent',
          color: isActive ? '#2563eb' : hov ? '#2563eb' : '#64748b',
          borderLeft: `3px solid ${isActive ? '#2563eb' : 'transparent'}`,
          transition: 'all 0.15s'
        }}>{icon}</button>
    );
  };

  const panelMeta = {
    bookmarks: { title: 'Закладки',   icon: <svg width="14" height="14" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg> },
    history:   { title: 'История',    icon: <svg width="14" height="14" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
    downloads: { title: 'Загрузки',   icon: <svg width="14" height="14" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> },
    ai:        { title: 'AI Модель',  icon: <svg width="14" height="14" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg> },
    settings:  { title: 'Настройки', icon: <svg width="14" height="14" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
  };

  return (
    <>
      <div style={{
        width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '12px 5px', background: 'rgba(255,255,255,0.95)',
        borderRight: '1px solid #e2e8f0', flexShrink: 0, zIndex: 200, height: '100%',
        position: 'relative'
      }}>
        <div style={{
          marginBottom: 16, padding: 6, borderRadius: 10, background: 'white',
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.12)',
          border: '1px solid #e2e8f0', transition: 'transform 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
          onMouseEnter={e => e.currentTarget.style.transform='scale(1.07)'}
          onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
          onClick={onGoHome}
        ><GlobeIcon/></div>

        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SBtn id="bookmarks" title="Закладки" icon={<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>}/>
          <SBtn id="history" title="История" icon={<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}/>
          <SBtn id="downloads" title="Загрузки" icon={<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>}/>
          <div style={{ height: 1, background: '#e2e8f0', margin: '4px 6px' }}/>
          <SBtn id="ai" title="AI Модель" icon={<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}/>
          <div style={{ position: 'relative', width: '100%' }}>
            <button
              onClick={onOpenAiChat}
              onMouseEnter={() => setHovAiChat(true)}
              onMouseLeave={() => setHovAiChat(false)}
              title="AI Чат"
              style={{
                width: '100%', height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 9, border: 'none', cursor: 'pointer',
                background: hovAiChat ? '#f0fdf4' : 'transparent',
                color: hovAiChat ? '#16a34a' : '#64748b',
                borderLeft: '3px solid transparent',
                transition: 'all 0.15s'
              }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
            </button>
            {hovAiChat && (
              <div style={{
                position: 'absolute', left: '110%', top: '50%', transform: 'translateY(-50%)',
                background: '#0f172a', color: 'white', fontSize: 11, fontWeight: 500,
                padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 1000,
                pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}>AI Чат</div>
            )}
          </div>
        </div>

        <div style={{ width: '100%' }}>
          <SBtn id="settings" title="Настройки" icon={<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}/>
        </div>
      </div>

      {/* Panel overlay — поверх BrowserView за счёт resizeBrowserView */}
      {panel && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 56, bottom: 0, right: 0, zIndex: 300, background: 'rgba(0,0,0,0.12)' }} onClick={closePanel}/>
          <div style={{
            position: 'fixed', top: 0, left: 56, bottom: 0, width: 320,
            background: 'white', boxShadow: '4px 0 20px rgba(0,0,0,0.1)',
            zIndex: 301, display: 'flex', flexDirection: 'column',
            animation: 'sideSlide 0.2s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {panelMeta[panel]?.icon}
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{panelMeta[panel]?.title}</span>
              </div>
              <button onClick={closePanel} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={e => { e.currentTarget.style.background='#f1f5f9'; e.currentTarget.style.color='#1e293b'; }}
                onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#94a3b8'; }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

              {panel === 'bookmarks' && (
                <div>
                  <button onClick={() => setShowAddBm(v => !v)} style={{ width: '100%', padding: '7px 0', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>+ Добавить закладку</button>
                  {showAddBm && (
                    <div style={{ background: '#f8fafc', borderRadius: 9, padding: 10, marginBottom: 10, border: '1px solid #e2e8f0' }}>
                      <input value={newBm.title} onChange={e=>setNewBm(v=>({...v,title:e.target.value}))} placeholder="Название" style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', marginBottom: 5, boxSizing: 'border-box' }}/>
                      <input value={newBm.url} onChange={e=>setNewBm(v=>({...v,url:e.target.value}))} placeholder="URL (https://...)"
                        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', marginBottom: 7, boxSizing: 'border-box' }}/>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => {
                          const rawUrl = newBm.url.trim();
                          if (rawUrl) {
                            const finalUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
                            const title = newBm.title.trim() || finalUrl;
                            onBookmarksChange(prev => [...prev, { title, url: finalUrl }]);
                            setNewBm({ title: '', url: '' });
                            setShowAddBm(false);
                          }
                        }} style={{ flex:1, padding:'5px 0', background:'#2563eb', color:'white', border:'none', borderRadius:7, fontSize:11, fontWeight:700, cursor:'pointer' }}>Сохранить</button>
                        <button onClick={()=>setShowAddBm(false)} style={{ flex:1, padding:'5px 0', background:'#f1f5f9', color:'#64748b', border:'none', borderRadius:7, fontSize:11, cursor:'pointer' }}>Отмена</button>
                      </div>
                    </div>
                  )}
                  {bookmarks.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'30px 0', color:'#94a3b8' }}>
                      <svg width="32" height="32" fill="none" stroke="#93c5fd" viewBox="0 0 24 24" strokeWidth="1.5" style={{ marginBottom:8 }}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                      <div style={{ fontSize:12 }}>Нет закладок. Добавьте первую!</div>
                    </div>
                  ) : bookmarks.map((bm,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:9, cursor:'pointer', marginBottom:3, transition:'background 0.15s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    >
                      <div style={{ width:26,height:26,borderRadius:6,background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                        {bm.favicon ? <img src={bm.favicon} width={14} height={14} onError={e=>e.target.style.display='none'}/> : <svg width="12" height="12" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>}
                      </div>
                      <div onClick={()=>{onNavigate(bm.url);closePanel();}} style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{bm.title}</div>
                        <div style={{ fontSize:11, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{bm.url}</div>
                      </div>
                      <button onClick={()=>onBookmarksChange(prev=>prev.filter((_,j)=>j!==i))} style={{ border:'none', background:'#fee2e2', borderRadius:6, width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#ef4444', flexShrink:0 }}><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                    </div>
                  ))}
                </div>
              )}

              {panel === 'history' && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <p style={{ fontSize:12, color:'#94a3b8', margin:0 }}>{histItems.length} записей</p>
                    {histItems.length > 0 && (
                      <button onClick={() => { localStorage.removeItem('intra-history'); localStorage.removeItem('intra-visits'); setHistItems([]); }}
                        style={{ fontSize:11, color:'#ef4444', background:'none', border:'none', cursor:'pointer' }}>Очистить</button>
                    )}
                  </div>
                  {histItems.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'30px 0', color:'#94a3b8' }}>
                      <svg width="32" height="32" fill="none" stroke="#93c5fd" viewBox="0 0 24 24" strokeWidth="1.5" style={{ marginBottom:8 }}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <div style={{ fontSize:12 }}>История пуста</div>
                    </div>
                  ) : histItems.map((item, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 10px', borderRadius:9, cursor:'pointer', marginBottom:3, transition:'background 0.15s' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                      onClick={() => { onNavigate(item.url); closePanel(); }}
                    >
                      <div style={{ width:24, height:24, borderRadius:6, background:'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {item.favicon ? <img src={item.favicon} width={12} height={12} onError={e=>e.target.style.display='none'}/> : <svg width="10" height="10" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:500, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.title || item.url}</div>
                        <div style={{ fontSize:10, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {item.timestamp ? new Date(item.timestamp).toLocaleString('ru',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : ''} · {item.url}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {panel === 'downloads' && (
                <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'auto' }}>
                  {downloads.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'40px 0', color:'#94a3b8' }}>
                      <svg width="36" height="36" fill="none" stroke="#93c5fd" viewBox="0 0 24 24" strokeWidth="1.5" style={{ marginBottom:10 }}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      <div style={{ fontSize:13, fontWeight:500, color:'#64748b' }}>Нет загрузок</div>
                      <div style={{ fontSize:12, marginTop:4 }}>Скачанные файлы появятся здесь</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderBottom:'1px solid #f1f5f9' }}>
                        <span style={{ fontSize:11, fontWeight:600, color:'#64748b' }}>Загрузки ({downloads.length})</span>
                        {downloads.length > 0 && (
                          <button onClick={() => { setDownloads([]); window.electronAPI?.clearDownloads(); }}
                            style={{ fontSize:10, color:'#94a3b8', background:'none', border:'none', cursor:'pointer' }}>Очистить</button>
                        )}
                      </div>
                      {downloads.map(dl => {
                        const pct = dl.totalBytes > 0 ? Math.round(dl.receivedBytes / dl.totalBytes * 100) : 0;
                        const isDone = dl.state === 'completed';
                        const isError = dl.state === 'interrupted' || dl.state === 'cancelled';
                        return (
                          <div key={dl.id} style={{ padding:'10px 12px', borderBottom:'1px solid #f1f5f9' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                              <svg width="16" height="16" fill="none" stroke={isDone ? '#22c55e' : isError ? '#ef4444' : '#2563eb'} viewBox="0 0 24 24" strokeWidth="1.5">
                                {isDone ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/> :
                                  isError ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/> :
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>}
                              </svg>
                              <span style={{ flex:1, fontSize:11, fontWeight:500, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {dl.filename}
                              </span>
                              {isDone && <span style={{ fontSize:10, color:'#22c55e' }}>Готово</span>}
                              {isError && <span style={{ fontSize:10, color:'#ef4444' }}>{dl.state === 'cancelled' ? 'Отменено' : 'Ошибка'}</span>}
                            </div>
                            {!isDone && !isError && (
                              <div style={{ height:4, background:'#e2e8f0', borderRadius:2, overflow:'hidden' }}>
                                <div style={{ height:'100%', width:`${pct}%`, background:'#2563eb', transition:'width 0.2s' }}/>
                              </div>
                            )}
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
                              <span style={{ fontSize:10, color:'#94a3b8' }}>
                                {dl.totalBytes > 0 ? `${(dl.receivedBytes/1024/1024).toFixed(1)} / ${(dl.totalBytes/1024/1024).toFixed(1)} МБ` : 'Загрузка...'}
                              </span>
                              <div style={{ display:'flex', gap:4 }}>
                                {isDone && (
                                  <button onClick={() => window.electronAPI?.showInFolder(dl.id)} title="Открыть папку"
                                    style={{ padding:'2px 6px', fontSize:10, color:'#64748b', background:'#f1f5f9', border:'none', borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                    <svg width="12" height="12" fill="none" stroke="#64748b" viewBox="0 0 24 24" strokeWidth="2">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                                    </svg>
                                  </button>
                                )}
                                <button onClick={() => { setDownloads(prev => prev.filter(d => d.id !== dl.id)); window.electronAPI?.removeDownload(dl.id); }} title="Удалить"
                                  style={{ padding:'2px 6px', fontSize:10, color:'#64748b', background:'#f1f5f9', border:'none', borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                  <svg width="12" height="12" fill="none" stroke="#64748b" viewBox="0 0 24 24" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              {panel === 'ai' && (
                <div style={{ display:'flex', flexDirection:'column', height:'100%', gap:10 }}>
                  {/* Provider info when no GGUF model loaded */}
                  {providerEnabled && !aiLoaded && activeProvider === 'openrouter' && openRouterModels.length > 0 && (
                    <div style={{ padding:'12px', borderRadius:10, background:'#f0f9ff', border:'1px solid #bae6fd'}}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#0369a1', marginBottom:4 }}>
                        OpenRouter
                      </div>
                      <select value={selectedModel} onChange={e => { setSelectedModel(e.target.value); window.electronAPI.aiSetModel(e.target.value); }}
                        style={{ width:'100%', fontSize:11, padding:'5px 8px', borderRadius:6, border:'1px solid #7dd3fc', background:'white', cursor:'pointer', marginBottom:4 }}>
                        {openRouterModels.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <div style={{ fontSize:10, color:'#22c55e'}}>✓ Подключено через API</div>
                    </div>
                  )}
                  {providerEnabled && !aiLoaded && activeProvider !== 'openrouter' && (
                    <div style={{ padding:'12px', borderRadius:10, background:'#f0f9ff', border:'1px solid #bae6fd'}}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#0369a1', marginBottom:4 }}>
                        {activeProvider === 'openai' ? 'OpenAI' : activeProvider === 'anthropic' ? 'Anthropic' : activeProvider === 'google' ? 'Google Gemini' : 'AI Provider'}
                      </div>
                      <div style={{ fontSize:10, color:'#64748b', marginBottom:4 }}>
                        Модель: <span style={{color:'#0369a1', fontWeight:600}}>{selectedModel || 'Не выбрана'}</span>
                      </div>
                      <div style={{ fontSize:10, color:'#22c55e'}}>✓ Подключено через API</div>
                    </div>
                  )}
                  <div style={{ padding:'12px', borderRadius:10, background: aiLoaded ? '#f0fdf4' : '#f8fafc', border:`1px solid ${aiLoaded ? '#bbf7d0' : '#e2e8f0'}` }}>
                    <div style={{ fontSize:12, fontWeight:700, color: aiLoaded ? '#166534' : '#64748b', marginBottom:4 }}>
                      {aiLoaded ? aiModel?.name : aiLoading ? 'Загрузка...' : 'Модель не выбрана'}
                    </div>
                    <div style={{ fontSize:10, color:'#94a3b8', marginBottom:8, lineHeight:1.5 }}>
                      Нужен <b>llama-server.exe</b> из релизов <a href="#" onClick={e=>{e.preventDefault();window.electronAPI?.openExternal('https://github.com/ggml-org/llama.cpp/releases')}} style={{color:'#2563eb'}}>llama.cpp</a>.
                      Модели любого размера в формате <b>.gguf</b>.
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                      <label style={{ fontSize:10, color:'#94a3b8', whiteSpace:'nowrap' }}>Контекст:</label>
                      <select value={aiContextSize} onChange={e => { const v = Number(e.target.value); setAiContextSize(v); localStorage.setItem('intra-ai-context', String(v)); }}
                        style={{ flex:1, fontSize:10, padding:'3px 6px', borderRadius:5, border:'1px solid #e2e8f0', background:'white', cursor:'pointer' }}>
                        <option value={2048}>2 048 токенов</option>
                        <option value={4096}>4 096 (по умолч.)</option>
                        <option value={8192}>8 192 токенов</option>
                        <option value={16384}>16 384 токенов</option>
                        <option value={32768}>32 768 токенов</option>
                      </select>
                    </div>
                    <button onClick={handleLoadModel} disabled={aiLoading} style={{ width:'100%', padding:'7px 0', background: aiLoading ? '#e2e8f0' : '#2563eb', color: aiLoading ? '#94a3b8' : 'white', border:'none', borderRadius:7, fontSize:12, fontWeight:700, cursor: aiLoading ? 'not-allowed' : 'pointer' }}>
                      {aiLoading ? 'Загрузка модели...' : aiModel ? 'Сменить модель (.gguf)' : 'Выбрать модель (.gguf)'}
                    </button>
                    {localStorage.getItem('intra-llama-server') && !aiLoading && (
                      <button onClick={() => { localStorage.removeItem('intra-llama-server'); }}
                        style={{ marginTop:3, width:'100%', padding:'4px 0', background:'none', color:'#94a3b8', border:'none', fontSize:10, cursor:'pointer' }}>
                        Сбросить путь к llama-server
                      </button>
                    )}
                  </div>

                  {/* Progress bar: loading or context usage */}
                  {aiLoading && !aiLoaded && aiLoadProgress !== null ? (
                    <div style={{ borderRadius:8, padding:'10px 12px', background:'#eff6ff', border:'1px solid #dbeafe' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                        <span style={{ fontSize:11, color:'#2563eb', fontWeight:600 }}>Загрузка модели...</span>
                        <span style={{ fontSize:11, color:'#2563eb', fontWeight:700 }}>{aiLoadProgress}%</span>
                      </div>
                      <div style={{ height:6, borderRadius:3, background:'#dbeafe', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${aiLoadProgress}%`, background:'#2563eb', borderRadius:3, transition:'width 0.4s ease' }}/>
                      </div>
                    </div>
                  ) : aiLoaded ? (
                    <div style={{ borderRadius:8, padding:'10px 12px', background:'#f8fafc', border:'1px solid #e2e8f0' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                        <span style={{ fontSize:11, color:'#64748b' }}>Использование контекста</span>
                        <span style={{ fontSize:11, fontWeight:600, color: aiContextUsedPct>85 ? '#ef4444' : aiContextUsedPct>60 ? '#f59e0b' : '#64748b' }}>{aiContextUsedPct}%</span>
                      </div>
                      <div style={{ height:6, borderRadius:3, background:'#e2e8f0', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${aiContextUsedPct}%`, background: aiContextUsedPct>85 ? '#ef4444' : aiContextUsedPct>60 ? '#f59e0b' : '#22c55e', borderRadius:3, transition:'width 0.3s' }}/>
                      </div>
                      {aiContextUsedPct>85 && <div style={{ fontSize:10, color:'#ef4444', marginTop:4 }}>Контекст почти заполнен — очистите чат или выгрузите модель.</div>}
                    </div>
                  ) : null}

                  {(aiLoaded || providerEnabled) && activeTab && !activeTab.isHome && (
                    <div style={{ marginBottom:8 }}>
                      <div style={{ fontSize:10, color:'#94a3b8', marginBottom:4 }}>Действия со страницей:</div>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {[
                          ['Резюмировать', 'Сделай краткое резюме этой страницы на русском языке.'],
                          ['Тезисы', 'Выдели ключевые тезисы и факты этой страницы в виде списка.'],
                          ['Объяснить', 'Объясни простыми словами, о чём эта страница.'],
                          ['Перевести', 'Переведи содержимое страницы на русский язык.'],
                          ['Сократить', 'Сократи и сделай краткое изложение основных мыслей страницы.'],
                          ['Расширить', 'Добавь больше деталей и контекста к содержанию страницы.'],
                        ].map(([label, prompt]) => (
                          <button key={label} onClick={() => analyzePageWith(label, prompt)} disabled={aiLoading}
                            style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #bfdbfe', background:'#eff6ff',
                              color:'#2563eb', fontSize:10, fontWeight:600, cursor: aiLoading ? 'not-allowed' : 'pointer',
                              opacity: aiLoading ? 0.5 : 1 }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0 }}>
                    {/* History toggle */}
                    <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                      <button onClick={() => setAiShowHistory(false)} 
                        style={{ flex:1, padding:'4px 8px', borderRadius:6, border:'none', fontSize:10, fontWeight:600,
                          background: !aiShowHistory ? '#2563eb' : '#e2e8f0', color: !aiShowHistory ? 'white' : '#64748b', cursor:'pointer' }}>
                        Текущий чат
                      </button>
                      <button onClick={() => setAiShowHistory(true)}
                        style={{ flex:1, padding:'4px 8px', borderRadius:6, border:'none', fontSize:10, fontWeight:600,
                          background: aiShowHistory ? '#2563eb' : '#e2e8f0', color: aiShowHistory ? 'white' : '#64748b', cursor:'pointer',
                          display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                        История {aiChatHistory.length > 0 && `(${aiChatHistory.length})`}
                      </button>
                    </div>
                    <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:6, marginBottom:8, minHeight:80 }}>
                      {aiShowHistory ? (
                        aiChatHistory.length === 0 ? (
                          <div style={{ textAlign:'center', padding:'20px 0', color:'#94a3b8', fontSize:12 }}>
                            История чатов пуста
                          </div>
                        ) : (
                          aiChatHistory.map((conv) => (
                            <div key={conv.id} onClick={() => { setAiChat(conv.messages); setAiShowHistory(false); }}
                              style={{ padding:'8px 10px', borderRadius:9, fontSize:11, cursor:'pointer', background:'#f8fafc',
                                border:'1px solid #e2e8f0', marginBottom:4 }}>
                              <div style={{ color:'#64748b', marginBottom:4, fontSize:10 }}>
                                {new Date(conv.timestamp).toLocaleString('ru-RU')}
                              </div>
                              <div style={{ color:'#374151' }}>
                                {conv.messages[0]?.text?.slice(0, 100)}{conv.messages[0]?.text?.length > 100 ? '...' : ''}
                              </div>
                              <div style={{ color:'#94a3b8', marginTop:4, fontSize:10 }}>
                                {conv.messages.length} сообщений
                              </div>
                            </div>
                          ))
                        )
                      ) : (
                        <>
                          {aiChat.length === 0 && (
                            <div style={{ textAlign:'center', padding:'20px 0', color:'#94a3b8', fontSize:12 }}>
                              {(aiModel || providerEnabled) ? 'Задайте вопрос модели...' : 'Выберите файл .gguf для чата'}
                            </div>
                          )}
                          {aiChat.map((msg,i) => (
                            <div key={i} style={{ padding:'8px 10px', borderRadius:9, fontSize:12, lineHeight:1.5, whiteSpace:'pre-wrap',
                              background: msg.role==='user' ? '#eff6ff' : '#f8fafc',
                              color: msg.role==='user' ? '#1e40af' : '#374151',
                              alignSelf: msg.role==='user' ? 'flex-end' : 'flex-start', maxWidth:'90%'
                            }}>{msg.text}</div>
                          ))}
                          {aiLoading && <div style={{ fontSize:11, color:'#94a3b8', fontStyle:'italic', padding:'4px 10px' }}>Генерация...</div>}
                        </>
                      )}
                      <div ref={aiChatEndRef} />
                    </div>
                    {/* Response status bar */}
                    {(aiLoading && (aiLoaded || providerEnabled)) && (
                      <div style={{ borderRadius:7, padding:'7px 10px', background:'#f8fafc', border:'1px solid #e2e8f0' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                          <span style={{ fontSize:11, color:'#64748b' }}>
                            {aiStreamedTokens === 0 ? (aiProcessingStatus || 'Ожидание ответа...') : `Генерация... ${aiStreamedTokens} токенов`}
                          </span>
                          {aiStreamedTokens > 0 && <span style={{ fontSize:11, color:'#2563eb', fontWeight:600 }}>{Math.min(Math.round(aiStreamedTokens / 10.24), 95)}%</span>}
                        </div>
                        <div style={{ height:4, borderRadius:2, background:'#e2e8f0', overflow:'hidden', position:'relative' }}>
                          {aiStreamedTokens === 0
                            ? <div className="ai-indeterminate" style={{ position:'absolute', top:0, height:'100%', width:'30%', borderRadius:2, background:'#2563eb' }}/>
                            : <div style={{ height:'100%', width:`${Math.min(aiStreamedTokens / 10.24, 95)}%`, background:'#2563eb', borderRadius:2, transition:'width 0.15s' }}/>
                          }
                        </div>
                      </div>
                    )}
                    <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                      <input value={aiInput} onChange={e=>setAiInput(e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey) sendAiMessage(); }}
                        placeholder={(aiLoaded || providerEnabled) ? 'Введите сообщение...' : 'Загрузите модель...'}
                        disabled={(!aiLoaded && !providerEnabled) || aiLoading}
                        style={{ flex:1, padding:'6px 9px', borderRadius:7, border:'1px solid #e2e8f0', fontSize:12, outline:'none' }}
                      />
                      <button onClick={sendAiMessage} disabled={(!aiLoaded && !providerEnabled) || !aiInput.trim() || aiLoading} title="Отправить"
                        style={{ width:32, height:32, borderRadius:7, border:'none', background: (aiLoaded || providerEnabled) && aiInput.trim() && !aiLoading ? '#2563eb' : '#e2e8f0', display:'flex', alignItems:'center', justifyContent:'center', cursor: (aiLoaded || providerEnabled) && aiInput.trim() && !aiLoading ? 'pointer' : 'not-allowed', flexShrink:0 }}>
                        <svg width="12" height="12" fill="none" stroke={aiLoaded&&aiInput.trim()&&!aiLoading ? 'white' : '#94a3b8'} viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                      </button>
                      {aiLastBotMsg && (
                        <button title="Скопировать ответ" onClick={() => navigator.clipboard.writeText(aiLastBotMsg.text)}
                          style={{ width:32, height:32, borderRadius:7, border:'none', background:'#f1f5f9', color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        </button>
                      )}
                      {aiChat.length > 0 && (
                        <button title="Новый чат (сохранить текущий)" onClick={() => {
                          // Save current conversation before clearing
                          const userMessages = aiChat.filter(m => m.role === 'user');
                          if (userMessages.length > 0) {
                            const conversation = {
                              id: Date.now(),
                              timestamp: new Date().toISOString(),
                              messages: aiChat.filter(m => !m.isServerLog && !m.role === 'status'),
                              source: 'sidebar'
                            };
                            setAiChatHistory(hist => {
                              const newHist = [conversation, ...hist].slice(0, 50);
                              localStorage.setItem('intra-ai-chat-history', JSON.stringify(newHist));
                              return newHist;
                            });
                          }
                          setAiChat([]);
                          window.electronAPI?.aiClearHistory?.();
                        }}
                          style={{ width:32, height:32, borderRadius:7, border:'none', background:'#f1f5f9', color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        </button>
                      )}
                      {aiChatHistory.length > 0 && (
                        <button title="Очистить историю" onClick={() => { if (confirm('Удалить всю историю чатов?')) { setAiChatHistory([]); localStorage.removeItem('intra-ai-chat-history'); } }}
                          style={{ width:32, height:32, borderRadius:7, border:'none', background:'#fef3c7', color:'#d97706', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 2v20M2 12h20"/><path d="M4 4l16 16M20 4L4 20"/></svg>
                        </button>
                      )}
                      {aiLoaded && (
                        <button title="Выгрузить модель" onClick={async () => { await window.electronAPI.aiUnloadModel(); setAiModel(null); setAiLoaded(false); setAiChat([]); setAiLoadProgress(null); localStorage.removeItem('intra-ai-model'); }}
                          style={{ width:32, height:32, borderRadius:7, border:'none', background:'#fff0f0', color:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {panel === 'settings' && (
                <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

                  {/* ── Поиск ── */}
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Поисковая система</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                      {[
                        { id:'yandex',    label:'Яндекс',    abbr:'Я' },
                        { id:'google',    label:'Google',    abbr:'G' },
                        { id:'duckduckgo',label:'DuckDuckGo',abbr:'D' },
                        { id:'bing',      label:'Bing',      abbr:'B' },
                      ].map(e => (
                        <button key={e.id} onClick={() => onSearchEngineChange(e.id)} style={{
                          display:'flex', alignItems:'center', gap:7, padding:'8px 10px',
                          borderRadius:8, border:`1.5px solid ${searchEngine===e.id ? '#2563eb' : '#e2e8f0'}`,
                          background: searchEngine===e.id ? '#eff6ff' : 'white',
                          cursor:'pointer', fontSize:12, fontWeight: searchEngine===e.id ? 700 : 500,
                          color: searchEngine===e.id ? '#2563eb' : '#475569', transition:'all 0.15s'
                        }}>
                          <span style={{ width:18, height:18, borderRadius:5, background: searchEngine===e.id ? '#2563eb' : '#e2e8f0', color: searchEngine===e.id ? 'white' : '#64748b', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0 }}>{e.abbr}</span>{e.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Вкладки ── */}
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Новая вкладка</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {[
                        { id:'home', label:'Домашняя страница', desc:'Открывать Dashboard' },
                        { id:'blank', label:'Пустая страница', desc:'Минималистичный старт' },
                      ].map(opt => (
                        <button key={opt.id} onClick={() => { localStorage.setItem('intra-newtab', opt.id); setNewTabMode(opt.id); }} style={{
                          display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                          borderRadius:8, border:`1.5px solid ${newTabMode===opt.id ? '#2563eb' : '#e2e8f0'}`,
                          background: newTabMode===opt.id ? '#eff6ff' : 'white', cursor:'pointer', textAlign:'left', transition:'all 0.15s'
                        }}>
                          <div style={{
                            width:16, height:16, borderRadius:'50%', flexShrink:0, border:`2px solid ${newTabMode===opt.id ? '#2563eb' : '#cbd5e1'}`,
                            background: newTabMode===opt.id ? '#2563eb' : 'white', display:'flex', alignItems:'center', justifyContent:'center'
                          }}>
                            {newTabMode===opt.id && <div style={{ width:6, height:6, borderRadius:'50%', background:'white' }}/>}
                          </div>
                          <div>
                            <div style={{ fontSize:12, fontWeight:600, color: newTabMode===opt.id ? '#2563eb' : '#1e293b' }}>{opt.label}</div>
                            <div style={{ fontSize:10, color:'#94a3b8', marginTop:1 }}>{opt.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Приватность ── */}
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Приватность и данные</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <button onClick={() => { localStorage.removeItem('intra-history'); localStorage.removeItem('intra-visits'); }} style={{
                        display:'flex', alignItems:'center', gap:9, padding:'9px 12px', borderRadius:8,
                        border:'1px solid #fecaca', background:'#fff5f5', cursor:'pointer', color:'#dc2626', fontSize:12, fontWeight:600, transition:'all 0.15s'
                      }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        Очистить историю посещений
                      </button>
                      <button onClick={() => { onBookmarksChange([]); }} style={{
                        display:'flex', alignItems:'center', gap:9, padding:'9px 12px', borderRadius:8,
                        border:'1px solid #fecaca', background:'#fff5f5', cursor:'pointer', color:'#dc2626', fontSize:12, fontWeight:600, transition:'all 0.15s'
                      }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                        Очистить все закладки
                      </button>
                      <button onClick={() => {
                        const keys = Object.keys(localStorage).filter(k => k.startsWith('intra-'));
                        keys.forEach(k => localStorage.removeItem(k));
                        onBookmarksChange([]);
                        onSearchEngineChange?.('yandex');
                        setUiSettings({ animations: true, compact: false });
                        applyUiPrefs({ animations: true, compact: false });
                      }} style={{
                        display:'flex', alignItems:'center', gap:9, padding:'9px 12px', borderRadius:8,
                        border:'1px solid #fecaca', background:'#fff5f5', cursor:'pointer', color:'#b91c1c', fontSize:12, fontWeight:700, transition:'all 0.15s'
                      }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        Сбросить все данные браузера
                      </button>
                    </div>
                  </div>

                  {/* ── Интерфейс ── */}
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Интерфейс</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {[
                        { key:'animations', label:'Анимации интерфейса', desc:'Плавные переходы и эффекты' },
                        { key:'compact', label:'Компактный режим', desc:'Уменьшить отступы в панелях' },
                      ].map(opt => {
                        const val = uiSettings[opt.key];
                        return (
                          <div key={opt.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', borderRadius:8, border:'1px solid #e2e8f0', background:'white' }}>
                            <div>
                              <div style={{ fontSize:12, fontWeight:600, color:'#1e293b' }}>{opt.label}</div>
                              <div style={{ fontSize:10, color:'#94a3b8', marginTop:1 }}>{opt.desc}</div>
                            </div>
                            <button onClick={() => toggleUiSetting(opt.key)} style={{
                              width:38, height:22, borderRadius:11, border:'none', cursor:'pointer', flexShrink:0, position:'relative',
                              background: val ? '#2563eb' : '#e2e8f0', transition:'background 0.2s'
                            }}>
                              <div style={{
                                position:'absolute', top:3, left: val?18:3, width:16, height:16,
                                borderRadius:'50%', background:'white', boxShadow:'0 1px 3px rgba(0,0,0,0.2)', transition:'left 0.2s'
                              }}/>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── О браузере ── */}
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>О браузере</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {[['Версия','1.0.0'],['Движок','Intra Browser'],['Сборка','Vite 5'],['Автор','Krasoft Labs']].map(([k,v]) => (
                        <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 12px', borderRadius:7, background:'#f8fafc' }}>
                          <span style={{ fontSize:12, color:'#64748b' }}>{k}</span>
                          <span style={{ fontSize:12, color:'#1e293b', fontFamily:'monospace', fontWeight:600 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>
        </>
      )}
    </>
  );
}

function NavBtn({ onClick, disabled, active, title, children }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      width: 30, height: 30, borderRadius: 6, flexShrink: 0,
      border: active ? '1px solid #dbeafe' : '1px solid transparent',
      background: active ? '#eff6ff' : hov ? '#f8fafc' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'default' : 'pointer',
      color: active ? '#2563eb' : disabled ? '#cbd5e1' : hov ? '#1e293b' : '#64748b',
      transition: 'all 0.15s'
    }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >{children}</button>
  );
}

function BrowserMenuDropdown({ onNewTab, onNewPrivateTab, onDevTools }) {
  const items = [
    {
      label: 'Новая вкладка', shortcut: 'Ctrl+T',
      icon: <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/></svg>,
      onClick: onNewTab
    },
    {
      label: 'Приватная вкладка', shortcut: 'Ctrl+Shift+N',
      icon: <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>,
      onClick: onNewPrivateTab
    },
    null,
    {
      label: 'Инструменты разработчика', shortcut: 'F12',
      icon: <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>,
      onClick: onDevTools
    },
  ];

  return (
    <div onMouseDown={e => e.stopPropagation()} style={{
      position: 'absolute', top: 'calc(100% + 6px)', right: 0,
      background: 'white', border: '1px solid #e2e8f0',
      borderRadius: 10, padding: '5px 0',
      boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
      minWidth: 230, zIndex: 999,
      animation: 'fadeIn 0.12s ease'
    }}>
      {items.map((item, i) => item === null
        ? <div key={i} style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
        : <button key={i} onClick={item.onClick} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '8px 14px', border: 'none', background: 'transparent',
            cursor: 'pointer', textAlign: 'left', borderRadius: 0,
            color: '#1e293b', fontSize: 12, fontFamily: 'inherit',
            transition: 'background 0.1s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ color: '#64748b', flexShrink: 0 }}>{item.icon}</span>
          <span style={{ flex: 1, fontWeight: 500 }}>{item.label}</span>
          <span style={{ color: '#94a3b8', fontSize: 11, flexShrink: 0 }}>{item.shortcut}</span>
        </button>
      )}
    </div>
  );
}

function AddressBar({ value, onChange, onNavigate, activeTab }) {
  const [focused, setFocused] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState([]);
  const [selIdx, setSelIdx] = React.useState(-1);
  const ref = React.useRef(null);
  const isSecure = activeTab?.url?.startsWith('https://');

  React.useEffect(() => {
    if (!focused || !value.trim()) { setSuggestions([]); setSelIdx(-1); return; }
    const q = value.trim().toLowerCase();
    const seen = new Set();
    const results = [];
    try {
      const history = JSON.parse(localStorage.getItem('intra-history') || '[]');
      for (const h of history) {
        if (results.length >= 8) break;
        if (!h.url || seen.has(h.url)) continue;
        if (h.url.toLowerCase().includes(q) || (h.title || '').toLowerCase().includes(q)) {
          seen.add(h.url);
          results.push({ url: h.url, title: h.title || h.url, favicon: h.favicon, type: 'history' });
        }
      }
    } catch {}
    try {
      const bookmarks = JSON.parse(localStorage.getItem('intra-bookmarks') || '[]');
      for (const b of bookmarks) {
        if (results.length >= 8) break;
        if (!b.url || seen.has(b.url)) continue;
        if (b.url.toLowerCase().includes(q) || (b.title || '').toLowerCase().includes(q)) {
          seen.add(b.url);
          results.push({ url: b.url, title: b.title || b.url, favicon: b.favicon, type: 'bookmark' });
        }
      }
    } catch {}
    setSuggestions(results);
    setSelIdx(-1);
  }, [value, focused]);

  const handleKeyDown = (e) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelIdx(i => Math.max(i - 1, -1)); return; }
      if (e.key === 'Escape') { setSuggestions([]); setSelIdx(-1); return; }
    }
    if (e.key === 'Enter') {
      const target = selIdx >= 0 && suggestions[selIdx] ? suggestions[selIdx].url : value;
      onNavigate(target);
      setSuggestions([]);
      setSelIdx(-1);
      ref.current?.blur();
    }
  };

  const showDropdown = focused && suggestions.length > 0;

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 34,
        padding: '0 10px', borderRadius: showDropdown ? '8px 8px 0 0' : 8, cursor: 'text',
        background: focused ? 'white' : '#f8fafc',
        border: '1px solid ' + (focused ? '#3b82f6' : '#e2e8f0'),
        borderBottom: showDropdown ? '1px solid #e2e8f0' : undefined,
        boxShadow: focused && !showDropdown ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
        transition: 'all 0.15s'
      }} onClick={() => ref.current?.focus()}>
        <div style={{ flexShrink: 0, opacity: focused ? 0 : 1, transition: 'opacity 0.15s', display: 'flex' }}>
          {isSecure
            ? <svg width="12" height="12" fill="#22c55e" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
            : <svg width="12" height="12" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
          }
        </div>
        <input ref={ref} value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { setFocused(true); setTimeout(() => ref.current?.select(), 0); }}
          onBlur={() => { setFocused(false); setTimeout(() => setSuggestions([]), 150); }}
          placeholder="Введите адрес или поисковый запрос..."
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#1e293b', fontSize: 13, fontFamily: focused ? 'monospace' : 'inherit' }}
        />
      </div>
      {showDropdown && (
        <div style={{
          position: 'absolute', top: 34, left: 0, right: 0, zIndex: 1000,
          background: 'white', border: '1px solid #3b82f6', borderTop: 'none',
          borderRadius: '0 0 8px 8px', boxShadow: '0 0 0 3px rgba(59,130,246,0.1)',
          overflow: 'hidden'
        }}>
          {suggestions.map((s, i) => (
            <div key={s.url}
              onMouseDown={() => { onNavigate(s.url); setSuggestions([]); }}
              onMouseEnter={() => setSelIdx(i)}
              onMouseLeave={() => setSelIdx(-1)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                cursor: 'pointer', background: i === selIdx ? '#eff6ff' : 'transparent',
                borderTop: i > 0 ? '1px solid #f1f5f9' : 'none'
              }}
            >
              {s.favicon
                ? <img src={s.favicon} width={14} height={14} style={{ borderRadius: 2, flexShrink: 0 }} />
                : <svg width="14" height="14" fill="none" stroke={s.type === 'bookmark' ? '#2563eb' : '#94a3b8'} viewBox="0 0 24 24" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                    {s.type === 'bookmark'
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                      : <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></>
                    }
                  </svg>
              }
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
