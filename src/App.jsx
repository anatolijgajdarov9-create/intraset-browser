import React, { useState, useEffect, useCallback, useRef } from 'react';

import HomePage from './components/HomePage';
import HistoryPage from './components/HistoryPage';
import SettingsPage from './components/SettingsPage';
import BlockedPage from './components/BlockedPage';
import AiChatPage from './components/AiChatPage';
import DownloadsPanel from './components/downloads/DownloadsPanel';

import TabBar from './components/TabBar';
import BrowserSidebar from './components/BrowserSidebar';
import AddressBar from './components/AddressBar';
import NavBtn from './components/NavBtn';
import PageLoadingBar from './components/PageLoadingBar';
import FindBar from './components/FindBar';
import BlankTab from './components/BlankTab';

import { useTabs, createTab } from './hooks/useTabs';
import { useBookmarks } from './hooks/useBookmarks';
import { useFindInPage } from './hooks/useFindInPage';
import { useFullscreen } from './hooks/useFullscreen';
import { isIntranetUrl } from './config/intranet';

const isElectron = typeof window.electronAPI !== 'undefined';

const SEARCH_ENGINES = {
  yandex:    q => `https://yandex.ru/search/?text=${encodeURIComponent(q)}`,
  google:    q => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  duckduckgo:q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  bing:      q => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
};

export default function App() {
  const {
    tabs, setTabs,
    activeTabId, setActiveTabId, activeTab,
    handleNewTab, handleNewPrivateTab, handleSwitchTab, handleCloseTab,
    handleDuplicateTab, handleCloseOtherTabs, handleCloseTabsToRight, handleReopenClosedTab,
    handlePinTab,
  } = useTabs(isElectron);

  const { bookmarks, setBookmarks } = useBookmarks();

  const {
    findBarOpen, setFindBarOpen, findQuery, findResult, findCaseSensitive,
    findInputRef, handleFindNext, closeFindBar, handleFindChange, toggleFindCaseSensitive,
  } = useFindInPage(isElectron, activeTabId);

  const { isFullScreen, headerVisible, handleMouseMove, handleToggleFullScreen } = useFullscreen(isElectron);

  const [addressBarValue, setAddressBarValue] = useState('');
  const [networkMode, setNetworkModeState] = useState(
    () => localStorage.getItem('intra-network-mode') || (localStorage.getItem('intra-intranet-only') === 'true' ? 'intranet' : 'internet')
  );
  const intranetOnly = networkMode === 'intranet';
  const [searchEngine, setSearchEngineState] = useState(
    () => localStorage.getItem('intra-search-engine') || 'yandex'
  );
  const [copyUrlFeedback, setCopyUrlFeedback] = useState(false);
  const [tabZoom, setTabZoom] = useState({});
  const [tabMuted, setTabMuted] = useState({});
  const [downloads, setDownloads] = useState([]);
  const [downloadsPanelOpen, setDownloadsPanelOpen] = useState(false);
  const [browserNotifications, setBrowserNotifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem('intra-browser-notifications') || '[]'); } catch { return []; }
  });
  const [sidebarSelectionReq, setSidebarSelectionReq] = useState(null);
  const [pendingSelectionReq, setPendingSelectionReq] = useState(null);
  const [forceSidebarAiPanel, setForceSidebarAiPanel] = useState(false);

  const addressBarRef = useRef(null);
  const menuBtnRef = useRef(null);

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (localStorage.getItem('intra-dark-mode') === 'true') {
      document.body.classList.add('intra-dark');
    }
    const root = document.getElementById('root');
    const loader = document.getElementById('loader');
    if (root) root.classList.add('app-ready');
    if (loader) loader.classList.add('hidden');
  }, []);

  const setNetworkMode = useCallback((mode) => {
    setNetworkModeState(mode);
    localStorage.setItem('intra-network-mode', mode);
    localStorage.setItem('intra-intranet-only', String(mode === 'intranet'));
  }, []);

  // Address bar value tracks active tab URL
  useEffect(() => {
    if (activeTab) setAddressBarValue(activeTab.isHome || activeTab.isBlocked ? '' : activeTab.url);
  }, [activeTabId, tabs]); // eslint-disable-line

  // IPC: keep address bar in sync when page navigates
  useEffect(() => {
    if (!isElectron) return;
    const off = window.electronAPI.onTabNavigated?.(({ tabId, url }) => {
      if (tabId === activeTabId) setAddressBarValue(url);
    }) ?? (() => {});
    return off;
  }, [activeTabId]);

  // IPC: sidebar AI selection + browser notifications
  useEffect(() => {
    if (!isElectron) return;
    const offSel = window.electronAPI.onAiSelectionRequest?.((data) => {
      setSidebarSelectionReq(data);
      setForceSidebarAiPanel(true);
    }) ?? (() => {});
    const offNotif = window.electronAPI.onBrowserNotification?.((data) => {
      setBrowserNotifications(prev => {
        const next = [data, ...prev].slice(0, 50);
        localStorage.setItem('intra-browser-notifications', JSON.stringify(next));
        return next;
      });
    }) ?? (() => {});
    return () => { offSel(); offNotif(); };
  }, []);

  // Downloads — event-driven, no polling
  useEffect(() => {
    if (!isElectron) return;
    const loadAll = async () => {
      try {
        const res = await window.electronAPI.getDownloads();
        if (res?.success) setDownloads(res.downloads || []);
      } catch {}
    };
    const upsert = (dl) => {
      if (!dl?.id) return;
      setDownloads(prev => {
        const idx = prev.findIndex(x => x.id === dl.id);
        if (idx >= 0) { const next = prev.slice(); next[idx] = { ...next[idx], ...dl }; return next; }
        return [dl, ...prev];
      });
    };
    loadAll();
    const offStarted = window.electronAPI.onDownloadStarted?.((d) => { if (d?.download) upsert(d.download); else loadAll(); }) ?? (() => {});
    const offUpdated = window.electronAPI.onDownloadUpdated?.((d) => { if (d?.download) upsert(d.download); else loadAll(); }) ?? (() => {});
    return () => { offStarted(); offUpdated(); };
  }, []);

  useEffect(() => {
    if (!isElectron || !downloadsPanelOpen) return;
    window.electronAPI.getDownloads()
      .then(res => { if (res?.success) setDownloads(res.downloads || []); })
      .catch(() => {});
  }, [downloadsPanelOpen]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const setSearchEngine = useCallback((engine) => {
    setSearchEngineState(engine);
    localStorage.setItem('intra-search-engine', engine);
  }, []);

  const goHome = useCallback(async (tabId) => {
    const tid = tabId || activeTabId;
    setTabs(prev => prev.map(t => t.id === tid
      ? { ...t, url: 'intra://home', title: 'Новая вкладка', isHome: true, isBlocked: false, loading: false }
      : t));
    setAddressBarValue('');
    if (isElectron) await window.electronAPI.goHome(tid);
  }, [activeTabId, setTabs]);

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
  }, [tabs, setTabs, setActiveTabId]);

  const handleNavigate = useCallback(async (url) => {
    if (!url || url === 'intra://home') return goHome(activeTabId);

    if (url.startsWith('intra://')) {
      const path = url.replace('intra://', '');
      if (path === 'ai-chat') return handleOpenAiChat();
      if (path === 'history') {
        setAddressBarValue(url);
        setTabs(prev => prev.map(t => t.id === activeTabId
          ? { ...t, url, loading: false, isHome: false, isAiChat: false, isHistory: true, isBlocked: false }
          : t));
        return;
      }
      if (path === 'settings') {
        setAddressBarValue(url);
        setTabs(prev => prev.map(t => t.id === activeTabId
          ? { ...t, url, loading: false, isHome: false, isAiChat: false, isHistory: false, isSettings: true, isBlocked: false }
          : t));
        return;
      }
      const valid = ['nodes', 'chat', 'files', 'my'];
      if (valid.includes(path) || path.startsWith('chat/')) {
        setAddressBarValue(url);
        setTabs(prev => prev.map(t => t.id === activeTabId
          ? { ...t, url, loading: false, isHome: false, isAiChat: false, isBlocked: false }
          : t));
        return;
      }
      return goHome(activeTabId);
    }

    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('file://')) {
      const isUrl = /^[\w.-]+\.[a-z]{2,}(\/.*)?$/.test(finalUrl) || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(finalUrl);
      finalUrl = isUrl ? `http://${finalUrl}` : (SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES.yandex)(finalUrl);
    }

    const isExternal = !isIntranetUrl(finalUrl);
    if (networkMode === 'intranet' && isExternal) {
      setTabs(prev => prev.map(t => t.id === activeTabId
        ? { ...t, isHome: false, isBlocked: true, blockedUrl: finalUrl, loading: false }
        : t));
      setAddressBarValue('');
      if (isElectron) await window.electronAPI.goHome(activeTabId);
      return;
    }

    setAddressBarValue(finalUrl);
    setTabs(prev => prev.map(t => t.id === activeTabId
      ? { ...t, url: finalUrl, loading: true, isHome: false, isAiChat: false, isHistory: false, isSettings: false, isBlocked: false, isExternalInSmart: networkMode === 'smart' && isExternal }
      : t));
    if (isElectron) await window.electronAPI.navigate(activeTabId, finalUrl);
  }, [activeTabId, networkMode, searchEngine, goHome, handleOpenAiChat, setTabs]); // eslint-disable-line

  const handleGoBack    = useCallback(async () => { if (isElectron) await window.electronAPI.goBack(activeTabId); }, [activeTabId]);
  const handleGoForward = useCallback(async () => { if (isElectron) await window.electronAPI.goForward(activeTabId); }, [activeTabId]);

  const handleReload = useCallback(async () => {
    if (!activeTab || activeTab.isHome || activeTab.isBlocked) return;
    if (activeTab.loading) {
      if (isElectron) await window.electronAPI.stopLoading(activeTabId);
    } else {
      if (isElectron) await window.electronAPI.reload(activeTabId);
    }
  }, [activeTabId, activeTab]);

  const handleCopyUrl = useCallback(() => {
    const url = activeTab?.url;
    if (url && !activeTab?.isHome && !activeTab?.isBlocked) {
      navigator.clipboard.writeText(url).catch(() => {});
      setCopyUrlFeedback(true);
      setTimeout(() => setCopyUrlFeedback(false), 1400);
    }
  }, [activeTab]);

  // ── Zoom ─────────────────────────────────────────────────────────────────────
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

  // ── Mute ─────────────────────────────────────────────────────────────────────
  const handleToggleMute = useCallback(async () => {
    if (!isElectron) return;
    const muted = !tabMuted[activeTabId];
    await window.electronAPI.setTabMuted(activeTabId, muted);
    setTabMuted(prev => ({ ...prev, [activeTabId]: muted }));
  }, [activeTabId, tabMuted]);

  // ── Downloads ────────────────────────────────────────────────────────────────
  const handleClearDownloads = useCallback(() => {
    downloads.filter(d => d.state !== 'progressing').forEach(d => window.electronAPI?.removeDownload?.(d.id));
  }, [downloads]);

  const clearBrowserNotifications = useCallback(() => {
    setBrowserNotifications([]);
    localStorage.removeItem('intra-browser-notifications');
  }, []);

  // ── Global keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const mod = navigator.platform.includes('Mac') ? e.metaKey : e.ctrlKey;
      if (!mod) {
        if (e.key === 'F5')  { e.preventDefault(); handleReload(); }
        if (e.key === 'F11') { e.preventDefault(); handleToggleFullScreen(); }
        if (e.key === 'F3' && findBarOpen) { e.preventDefault(); handleFindNext(true); }
        if (e.key === 'Escape' && findBarOpen) closeFindBar();
        return;
      }
      switch (e.key.toLowerCase()) {
        case 't': e.preventDefault(); handleNewTab(); break;
        case 'w': e.preventDefault(); handleCloseTab(activeTabId); break;
        case 'r': e.preventDefault(); handleReload(); break;
        case 'j': e.preventDefault(); setDownloadsPanelOpen(v => !v); break;
        case 'f': {
          const tab = tabs.find(t => t.id === activeTabId);
          if (tab && !tab.isHome && !tab.isAiChat && !tab.isBlocked) {
            e.preventDefault();
            setFindBarOpen(v => !v);
            if (!findBarOpen) setTimeout(() => findInputRef.current?.focus(), 50);
          }
          break;
        }
        case 'l':
          e.preventDefault();
          addressBarRef.current?.focus();
          addressBarRef.current?.select();
          break;
        case '=': case '+': e.preventDefault(); handleZoomIn(); break;
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
      if (mod && e.shiftKey) {
        if (e.key.toLowerCase() === 't') { e.preventDefault(); handleReopenClosedTab(); }
        if (e.key.toLowerCase() === 'n') { e.preventDefault(); handleNewPrivateTab(); }
        if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          navigator.clipboard.readText().then(t => { if (t?.trim()) handleNavigate(t.trim()); }).catch(() => {});
        }
      }
      if (e.altKey && e.key === 'ArrowLeft')  { e.preventDefault(); handleGoBack(); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); handleGoForward(); }
      if (mod && !e.shiftKey && !e.altKey) {
        const n = parseInt(e.key);
        if (n >= 1 && n <= 9) {
          e.preventDefault();
          const target = n === 9 ? tabs[tabs.length - 1] : tabs[n - 1];
          if (target) handleSwitchTab(target.id);
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeTabId, tabs, findBarOpen, handleToggleFullScreen, handleReload, handleFindNext,
      closeFindBar, handleNewTab, handleCloseTab, setFindBarOpen, findInputRef, handleZoomIn,
      handleZoomOut, handleZoomReset, handleSwitchTab, handleReopenClosedTab, handleNewPrivateTab,
      handleNavigate, handleGoBack, handleGoForward]); // eslint-disable-line

  // ── Unified layout ───────────────────────────────────────────────────────────
  const isHomeTab = (activeTab?.isHome && !activeTab?.isBlocked) ?? false;
  const isBrowserPage = !isHomeTab && !activeTab?.isAiChat && !activeTab?.isHistory && !activeTab?.isSettings;
  const zoom = tabZoom[activeTabId] || 0;
  const zoomPct = Math.round(100 * Math.pow(1.2, zoom));
  const isBookmarked = bookmarks.some(b => b.url === activeTab?.url);
  const activeDownloadsCount = downloads.filter(d => d.state === 'progressing').length;
  const networkModes = [
    { id: 'internet',  label: 'Интернет' },
    { id: 'smart',     label: 'Smart' },
    { id: 'intranet',  label: 'Интрасеть' },
  ];
  const currentNetMode = networkMode;

  return (
    <div onMouseMove={handleMouseMove} style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'white' }}>
      {(!isFullScreen || headerVisible) && <>
        {!isHomeTab && (
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
            downloads={downloads}
            onClearDownloads={handleClearDownloads}
            onCancelDownload={(id) => window.electronAPI?.cancelDownload?.(id)}
            onRemoveDownload={(id) => window.electronAPI?.removeDownload?.(id)}
          />
        )}

        {/* Downloads panel overlay */}
        {downloadsPanelOpen && !isHomeTab && <>
          <div style={{
            position: 'fixed', top: 84, right: 8, bottom: 8, width: 360,
            background: 'white', borderRadius: 12,
            boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
            zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            animation: 'slideInRight 0.2s ease',
          }}>
            <DownloadsPanel
              downloads={downloads}
              onClose={() => setDownloadsPanelOpen(false)}
              onClearDownloads={handleClearDownloads}
              onCancelDownload={(id) => window.electronAPI?.cancelDownload?.(id)}
              onRemoveDownload={(id) => window.electronAPI?.removeDownload?.(id)}
              onShowInFolder={(id) => window.electronAPI?.showInFolder?.(id)}
            />
          </div>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setDownloadsPanelOpen(false)} />
        </>}

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <TabBar
            tabs={tabs} activeTabId={activeTabId}
            onSwitchTab={handleSwitchTab} onCloseTab={handleCloseTab}
            onNewTab={() => handleNewTab()}
            onDuplicateTab={handleDuplicateTab}
            onCloseOtherTabs={handleCloseOtherTabs}
            onCloseTabsToRight={handleCloseTabsToRight}
            onPinTab={handlePinTab}
          />

          {/* Home tab content */}
          {isHomeTab && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {activeTab?.isBlank
                ? <BlankTab onNavigate={(url) => {
                    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isBlank: false } : t));
                    handleNavigate(url);
                  }} />
                : <HomePage
                    onNavigate={handleNavigate}
                    tabs={tabs} activeTabId={activeTabId}
                    onNewTab={() => handleNewTab()}
                    onNewPrivateTab={handleNewPrivateTab}
                    onSwitchTab={handleSwitchTab}
                    onCloseTab={handleCloseTab}
                    intranetOnly={intranetOnly}
                    onToggleIntranetOnly={() => setNetworkMode(networkMode === 'intranet' ? 'internet' : 'intranet')}
                    bookmarks={bookmarks}
                    onBookmarksChange={setBookmarks}
                    onOpenAiChat={handleOpenAiChat}
                    browserNotifications={browserNotifications}
                    onClearBrowserNotifications={clearBrowserNotifications}
                    searchEngine={searchEngine}
                    onSearchEngineChange={setSearchEngine}
                  />
              }
            </div>
          )}

          {activeTab?.isAiChat && (
            <AiChatPage
              activeTab={activeTab}
              selectionRequest={pendingSelectionReq}
              onSelectionHandled={() => setPendingSelectionReq(null)}
            />
          )}
          {activeTab?.isHistory  && <HistoryPage onNavigate={handleNavigate} bookmarks={bookmarks} />}
          {activeTab?.isSettings && <SettingsPage onNavigate={handleNavigate} />}

          {/* Private tab indicator */}
          {activeTab?.isPrivate && (
            <div style={{ height: 2, flexShrink: 0, background: 'linear-gradient(90deg, #7c3aed 0%, #a78bfa 50%, #7c3aed 100%)' }} />
          )}

          {/* Navigation bar */}
          {isBrowserPage && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, height: 46, padding: '0 10px',
              background: activeTab?.isPrivate ? '#faf5ff' : 'white',
              borderBottom: `1px solid ${activeTab?.isPrivate ? '#e9d5ff' : '#e2e8f0'}`,
              flexShrink: 0,
            }}>
              <NavBtn onClick={handleGoBack} disabled={!activeTab?.canGoBack} title="Назад (Alt+←)">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                </svg>
              </NavBtn>
              <NavBtn onClick={handleGoForward} disabled={!activeTab?.canGoForward} title="Вперёд (Alt+→)">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </NavBtn>
              <NavBtn onClick={handleReload} title={activeTab?.loading ? 'Остановить (Esc)' : 'Обновить (F5)'}>
                {activeTab?.loading
                  ? <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  : <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                }
              </NavBtn>
              <NavBtn onClick={() => goHome(activeTabId)} title="Домой">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                </svg>
              </NavBtn>

              <AddressBar
                ref={addressBarRef}
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

              {/* Zoom controls */}
              {activeTab && !activeTab.isHome && !activeTab.isBlocked && !activeTab.isAiChat && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 1, background: '#f8fafc', borderRadius: 7, border: '1px solid #e2e8f0', padding: '0 2px', flexShrink: 0 }}>
                  <NavBtn onClick={handleZoomOut} title="Уменьшить (Ctrl+-)">
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M5 12h14"/></svg>
                  </NavBtn>
                  <button onClick={handleZoomReset} title="Сбросить (Ctrl+0)" style={{
                    fontSize: 10, fontWeight: 700, color: zoom !== 0 ? '#2563eb' : '#64748b',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 4px', minWidth: 32, textAlign: 'center',
                  }}>{zoomPct}%</button>
                  <NavBtn onClick={handleZoomIn} title="Увеличить (Ctrl+=)">
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  </NavBtn>
                </div>
              )}

              {/* Mute */}
              {activeTab && !activeTab.isHome && !activeTab.isBlocked && !activeTab.isAiChat && (
                <NavBtn onClick={handleToggleMute} title={tabMuted[activeTabId] ? 'Включить звук' : 'Выключить звук'}>
                  {tabMuted[activeTabId]
                    ? <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd"/><path d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>
                    : <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m-3.536-9.536A5 5 0 005.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5z"/></svg>
                  }
                </NavBtn>
              )}

              {/* Find in page */}
              {activeTab && !activeTab.isHome && !activeTab.isBlocked && !activeTab.isAiChat && (
                <NavBtn
                  active={findBarOpen}
                  title="Найти на странице (Ctrl+F)"
                  onClick={() => { setFindBarOpen(v => !v); if (!findBarOpen) setTimeout(() => findInputRef.current?.focus(), 50); }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                </NavBtn>
              )}

              {/* Downloads */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <NavBtn onClick={() => setDownloadsPanelOpen(v => !v)} active={downloadsPanelOpen} title="Загрузки (Ctrl+J)">
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                </NavBtn>
                {activeDownloadsCount > 0 && (
                  <div style={{
                    position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15,
                    borderRadius: 8, background: '#2563eb', color: 'white',
                    fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', padding: '0 3px', lineHeight: 1,
                  }}>{activeDownloadsCount > 9 ? '9+' : activeDownloadsCount}</div>
                )}
              </div>

              {/* Network mode */}
              <div style={{ display: 'flex', gap: 1, background: '#f1f5f9', borderRadius: 7, padding: 2, border: '1px solid #e2e8f0', flexShrink: 0 }}>
                {networkModes.map(m => (
                  <button key={m.id}
                    onClick={() => setNetworkMode(m.id)}
                    title={m.id === 'smart' ? 'Разрешать все сайты, но помечать внешние' : undefined}
                    style={{
                      padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
                      background: currentNetMode === m.id ? (m.id === 'smart' ? '#f59e0b' : '#2563eb') : 'transparent',
                      color: currentNetMode === m.id ? 'white' : '#64748b',
                      boxShadow: currentNetMode === m.id ? (m.id === 'smart' ? '0 1px 6px rgba(245,158,11,0.35)' : '0 1px 6px rgba(37,99,235,0.3)') : 'none',
                    }}
                  >{m.label}</button>
                ))}
              </div>

              {/* Smart mode indicator */}
              {networkMode === 'smart' && activeTab?.isExternalInSmart && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px',
                  background: '#fef3c7', borderRadius: 6, border: '1px solid #fcd34d',
                  fontSize: 10, color: '#92400e', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>
                  Внешний сайт
                </div>
              )}

              {/* Browser menu */}
              <div ref={menuBtnRef}>
                <NavBtn title="Меню" onClick={() => {
                  if (isElectron && menuBtnRef.current) {
                    const r = menuBtnRef.current.getBoundingClientRect();
                    window.electronAPI.openBrowserMenu({ right: Math.round(r.right), bottom: Math.round(r.bottom) });
                  }
                }}>
                  <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                  </svg>
                </NavBtn>
              </div>

              {/* Bookmark toggle */}
              {activeTab && !activeTab.isHome && !activeTab.isBlocked && (
                <NavBtn
                  active={isBookmarked}
                  title={isBookmarked ? 'Убрать из закладок' : 'Добавить в закладки'}
                  onClick={() => {
                    const url = activeTab.url;
                    const title = activeTab.title || url;
                    if (isBookmarked) {
                      setBookmarks(prev => prev.filter(b => b.url !== url));
                    } else {
                      setBookmarks(prev => [...prev, { url, title, favicon: activeTab.favicon || null }]);
                    }
                  }}
                >
                  <svg width="15" height="15" fill={isBookmarked ? '#2563eb' : 'none'} stroke={isBookmarked ? '#2563eb' : 'currentColor'} viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                  </svg>
                </NavBtn>
              )}
            </div>
          )}

          {/* Page loading bar */}
          {isBrowserPage && !activeTab?.isBlocked && (
            <PageLoadingBar loading={activeTab?.loading} />
          )}

          {/* Find bar */}
          {findBarOpen && activeTab && !activeTab.isHome && !activeTab.isBlocked && !activeTab.isAiChat && (
            <FindBar
              inputRef={findInputRef}
              query={findQuery}
              result={findResult}
              caseSensitive={findCaseSensitive}
              onQueryChange={handleFindChange}
              onNext={handleFindNext}
              onClose={closeFindBar}
              onToggleCase={toggleFindCaseSensitive}
            />
          )}

          {/* Blocked page */}
          {isBrowserPage && activeTab?.isBlocked && (
            <BlockedPage
              url={activeTab.blockedUrl}
              onGoHome={() => goHome(activeTabId)}
              onDisableBlock={() => setNetworkMode('internet')}
            />
          )}
        </div>
      </>}
    </div>
  );
}
