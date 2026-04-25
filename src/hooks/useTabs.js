import { useState, useCallback, useEffect, useRef } from 'react';

let tabIdCounter = 1;
const newTabId = () => `tab-${tabIdCounter++}`;

export function createTab(url = 'intra://home', title = 'Новая вкладка', isPrivate = false, isBlank = false, isPinned = false) {
  return {
    id: newTabId(), url, title,
    favicon: null, loading: false,
    canGoBack: false, canGoForward: false,
    isHome: url === 'intra://home',
    isAiChat: url === 'intra://ai-chat',
    isHistory: url === 'intra://history',
    isSettings: url === 'intra://settings',
    isBlocked: false, blockedUrl: null,
    isPrivate, isBlank, isPinned,
    isExternalInSmart: false,
  };
}

function isTrackableUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname;
    if (!host || host.length < 2) return false;
    if (host === 'localhost' || /^127\./.test(host)) return false;
    return true;
  } catch { return false; }
}

function trackHistory(url, title, favicon) {
  if (!isTrackableUrl(url)) return;
  try {
    const history = JSON.parse(localStorage.getItem('intra-history') || '[]');
    const filtered = history.filter(h => h.url !== url);
    filtered.unshift({ url, title: title || new URL(url).hostname, favicon: favicon || null, timestamp: Date.now() });
    if (filtered.length > 200) filtered.splice(200);
    localStorage.setItem('intra-history', JSON.stringify(filtered));
  } catch {}
}

export function trackVisit(url, title, favicon) {
  if (!isTrackableUrl(url)) return;
  try {
    const parsed = new URL(url);
    const key = parsed.origin;
    const visits = JSON.parse(localStorage.getItem('intra-visits') || '{}');
    const prev = visits[key] || { count: 0, title: '', favicon: null, url: '' };
    const newTitle = title || prev.title || parsed.hostname;
    visits[key] = { count: prev.count + 1, title: newTitle, favicon: favicon || prev.favicon, url, lastVisit: Date.now() };
    localStorage.setItem('intra-visits', JSON.stringify(visits));
    trackHistory(url, newTitle, visits[key].favicon);
  } catch {}
}

export function updateVisitMeta(url, meta) {
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

function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem('intra-session') || 'null');
    if (!saved || !Array.isArray(saved.tabs) || !saved.tabs.length) return null;
    const tabs = saved.tabs.map(t => createTab(t.url, t.title, false, false));
    const activeId = (saved.activeUrl
      ? tabs.find(t => t.url === saved.activeUrl)?.id
      : null) ?? tabs[0].id;
    return { tabs, activeId };
  } catch { return null; }
}

function saveSession(tabs, activeTabId) {
  try {
    const items = tabs
      .filter(t => !t.isPrivate && !t.isHome && t.url && t.url !== 'intra://home')
      .map(t => ({ url: t.url, title: t.title }));
    const activeUrl = tabs.find(t => t.id === activeTabId)?.url ?? null;
    localStorage.setItem('intra-session', JSON.stringify({ tabs: items, activeUrl }));
  } catch {}
}

const _initialSession = loadSession();
const _initialTabs = _initialSession?.tabs ?? [createTab()];
const _initialActiveId = _initialSession?.activeId ?? _initialTabs[0].id;

export function useTabs(isElectron) {
  const [tabs, setTabs] = useState(_initialTabs);
  const [activeTabId, setActiveTabId] = useState(_initialActiveId);
  const [recentlyClosed, setRecentlyClosed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('intra-recently-closed') || '[]'); } catch { return []; }
  });

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Refs для стабильных обратных ссылок в IPC-слушателях
  const handleNewTabRef = useRef(null);
  const handleNewPrivateTabRef = useRef(null);
  const handleReopenClosedTabRef = useRef(null);

  // Сохранение сессии при изменении вкладок
  useEffect(() => {
    saveSession(tabs, activeTabId);
  }, [tabs, activeTabId]);

  // Инициализация всех вкладок из сессии
  useEffect(() => {
    if (!isElectron) return;
    (async () => {
      for (const tab of tabs) {
        await window.electronAPI.createTab(tab.id, tab.url);
      }
      const active = tabs.find(t => t.id === activeTabId) || tabs[0];
      if (active) {
        await window.electronAPI.switchTab(active.id, active.isHome || active.isAiChat || active.isHistory || active.isSettings);
      }
    })();
  }, []); // eslint-disable-line

  // IPC: события вкладок (без зависимости от handlers — только setTabs)
  useEffect(() => {
    if (!isElectron) return;
    const offNavigated = window.electronAPI.onTabNavigated?.(({ tabId, url }) => {
      setTabs(prev => {
        const tab = prev.find(t => t.id === tabId);
        if (!tab?.isPrivate) trackVisit(url, tab?.title, tab?.favicon);
        const isHome = url === 'intra://home';
        return prev.map(t => t.id === tabId ? { ...t, url, isHome, isBlocked: false } : t);
      });
    }) ?? (() => {});
    const offTitle = window.electronAPI.onTabTitleUpdated?.(({ tabId, title }) => {
      setTabs(prev => {
        const tab = prev.find(t => t.id === tabId);
        if (tab?.url && !tab?.isPrivate) updateVisitMeta(tab.url, { title });
        return prev.map(t => t.id === tabId ? { ...t, title } : t);
      });
    }) ?? (() => {});
    const offFavicon = window.electronAPI.onTabFaviconUpdated?.(({ tabId, favicon }) => {
      setTabs(prev => {
        const tab = prev.find(t => t.id === tabId);
        if (tab?.url && !tab?.isPrivate) updateVisitMeta(tab.url, { favicon });
        return prev.map(t => t.id === tabId ? { ...t, favicon } : t);
      });
    }) ?? (() => {});
    const offLoading = window.electronAPI.onTabLoading?.(({ tabId, loading }) =>
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, loading } : t))
    ) ?? (() => {});
    const offNavState = window.electronAPI.onTabNavState?.(({ tabId, canGoBack, canGoForward }) =>
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, canGoBack, canGoForward } : t))
    ) ?? (() => {});
    const offAudio = window.electronAPI.onTabAudioState?.(({ tabId, isPlaying }) =>
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, isPlaying } : t))
    ) ?? (() => {});
    return () => { offNavigated(); offTitle(); offFavicon(); offLoading(); offNavState(); offAudio(); };
  }, []); // eslint-disable-line

  // IPC: команды главного процесса (через ref для актуальных хендлеров)
  useEffect(() => {
    if (!isElectron) return;
    const offNewTab = window.electronAPI.onOpenNewTab?.(({ url }) => handleNewTabRef.current?.(url)) ?? (() => {});
    const offPrivate = window.electronAPI.onOpenPrivateTab?.((data) => handleNewPrivateTabRef.current?.(data.url)) ?? (() => {});
    const offReopen = window.electronAPI.onReopenClosedTab?.(() => handleReopenClosedTabRef.current?.()) ?? (() => {});
    return () => { offNewTab(); offPrivate(); offReopen(); };
  }, []); // eslint-disable-line

  const saveRecentlyClosed = useCallback((tabsToSave) => {
    const items = tabsToSave
      .filter(t => !t.isHome && !t.isAiChat)
      .map(t => ({ url: t.url, title: t.title, favicon: t.favicon, closedAt: Date.now() }));
    if (!items.length) return;
    setRecentlyClosed(prev => {
      const deduped = items.filter(c => !prev.find(p => p.url === c.url));
      const next = [...deduped, ...prev].slice(0, 10);
      localStorage.setItem('intra-recently-closed', JSON.stringify(next));
      return next;
    });
  }, []);

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
  }, [isElectron]);

  const handleNewPrivateTab = useCallback(async (url = 'intra://home') => {
    const tab = createTab(url, url === 'intra://home' ? 'Приватная вкладка' : url, true);
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    if (isElectron) {
      await window.electronAPI.createPrivateTab(tab.id, url);
      await window.electronAPI.switchTab(tab.id);
    }
  }, [isElectron]);

  const handleSwitchTab = useCallback(async (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    setActiveTabId(tabId);
    if (isElectron) {
      await window.electronAPI.switchTab(
        tabId,
        (tab?.isHome || tab?.isAiChat || tab?.isHistory || tab?.isSettings) ?? true
      );
    }
  }, [tabs, isElectron]);

  const handleCloseTab = useCallback(async (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) saveRecentlyClosed([tab]);

    if (tabs.length === 1) {
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
  }, [tabs, activeTabId, isElectron, saveRecentlyClosed]);

  const handleDuplicateTab = useCallback(async (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const newTab = createTab(tab.url, tab.title, tab.isPrivate);
    const idx = tabs.findIndex(t => t.id === tabId);
    setTabs(prev => { const next = [...prev]; next.splice(idx + 1, 0, newTab); return next; });
    setActiveTabId(newTab.id);
    if (isElectron) {
      const create = tab.isPrivate ? window.electronAPI.createPrivateTab : window.electronAPI.createTab;
      await create(newTab.id, tab.url);
      await window.electronAPI.switchTab(newTab.id);
    }
  }, [tabs, isElectron]);

  const handleCloseOtherTabs = useCallback(async (keepTabId) => {
    const toClose = tabs.filter(t => t.id !== keepTabId);
    if (!toClose.length) return;
    saveRecentlyClosed(toClose);
    setTabs(prev => prev.filter(t => t.id === keepTabId));
    setActiveTabId(keepTabId);
    if (isElectron) {
      await Promise.all(toClose.map(t => window.electronAPI.closeTab(t.id)));
      await window.electronAPI.switchTab(keepTabId);
    }
  }, [tabs, isElectron, saveRecentlyClosed]);

  const handleCloseTabsToRight = useCallback(async (tabId) => {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx < 0) return;
    const toClose = tabs.slice(idx + 1);
    if (!toClose.length) return;
    saveRecentlyClosed(toClose);
    const newTabs = tabs.slice(0, idx + 1);
    setTabs(newTabs);
    if (!newTabs.find(t => t.id === activeTabId)) {
      setActiveTabId(tabId);
      if (isElectron) await window.electronAPI.switchTab(tabId);
    }
    if (isElectron) await Promise.all(toClose.map(t => window.electronAPI.closeTab(t.id)));
  }, [tabs, activeTabId, isElectron, saveRecentlyClosed]);

  const handleReopenClosedTab = useCallback(async () => {
    if (!recentlyClosed.length) return;
    const last = recentlyClosed[0];
    setRecentlyClosed(prev => {
      const next = prev.slice(1);
      localStorage.setItem('intra-recently-closed', JSON.stringify(next));
      return next;
    });
    const tab = createTab(last.url, last.title || 'Восстановленная вкладка');
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    if (isElectron) {
      await window.electronAPI.createTab(tab.id, last.url);
      await window.electronAPI.switchTab(tab.id);
    }
  }, [recentlyClosed, isElectron]);

  const handlePinTab = useCallback((tabId) => {
    setTabs(prev => {
      const tab = prev.find(t => t.id === tabId);
      if (!tab) return prev;
      const newIsPinned = !tab.isPinned;
      const withoutTab = prev.filter(t => t.id !== tabId);
      const updated = { ...tab, isPinned: newIsPinned };
      if (newIsPinned) {
        const lastPinnedIdx = withoutTab.reduce((acc, t, i) => t.isPinned ? i : acc, -1);
        const insertAt = lastPinnedIdx + 1;
        return [...withoutTab.slice(0, insertAt), updated, ...withoutTab.slice(insertAt)];
      }
      const firstUnpinnedIdx = withoutTab.findIndex(t => !t.isPinned);
      const insertAt = firstUnpinnedIdx >= 0 ? firstUnpinnedIdx : withoutTab.length;
      return [...withoutTab.slice(0, insertAt), updated, ...withoutTab.slice(insertAt)];
    });
  }, []);

  // Синхронизация refs для IPC-слушателей
  useEffect(() => { handleNewTabRef.current = handleNewTab; }, [handleNewTab]);
  useEffect(() => { handleNewPrivateTabRef.current = handleNewPrivateTab; }, [handleNewPrivateTab]);
  useEffect(() => { handleReopenClosedTabRef.current = handleReopenClosedTab; }, [handleReopenClosedTab]);

  return {
    tabs, setTabs,
    activeTabId, setActiveTabId,
    activeTab, recentlyClosed,
    handleNewTab, handleNewPrivateTab, handleSwitchTab, handleCloseTab,
    handleDuplicateTab, handleCloseOtherTabs, handleCloseTabsToRight, handleReopenClosedTab,
    handlePinTab,
  };
}
