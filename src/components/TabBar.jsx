import React, { useState, useRef, useEffect } from 'react';

const isElectron = typeof window.electronAPI !== 'undefined';

function TabContextMenu({ tabId, tabs, onDuplicateTab, onCloseOtherTabs, onCloseTabsToRight, onCloseTab, onPinTab, onClose, x, y }) {
  const ctxTab = tabs.find(t => t.id === tabId);
  const ctxIdx = tabs.findIndex(t => t.id === tabId);
  const hasTabsToRight = ctxIdx < tabs.length - 1;
  const hasOtherTabs = tabs.length > 1;
  const isPinned = ctxTab?.isPinned;

  const items = [
    {
      label: isPinned ? 'Открепить вкладку' : 'Закрепить вкладку',
      icon: <svg width="12" height="12" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>,
      onClick: () => { onPinTab?.(tabId); onClose(); },
    },
    {
      label: 'Дублировать вкладку',
      icon: <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
      onClick: () => { onDuplicateTab?.(tabId); onClose(); },
    },
    ...(hasOtherTabs || hasTabsToRight ? [null] : []),
    ...(hasOtherTabs ? [{
      label: 'Закрыть другие вкладки',
      icon: <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
      onClick: () => { onCloseOtherTabs?.(tabId); onClose(); },
    }] : []),
    ...(hasTabsToRight ? [{
      label: 'Закрыть вкладки справа',
      icon: <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>,
      onClick: () => { onCloseTabsToRight?.(tabId); onClose(); },
    }] : []),
    null,
    {
      label: 'Закрыть вкладку',
      icon: <svg width="12" height="12" fill="none" stroke="#ef4444" viewBox="0 0 24 24" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
      onClick: () => { if (!isPinned) { onCloseTab(tabId); onClose(); } },
      danger: true,
      disabled: isPinned,
    },
  ];

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed', top: y, left: x, zIndex: 9999,
        background: 'white', border: '1px solid #e2e8f0',
        borderRadius: 10, padding: '5px 0',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        minWidth: 210, animation: 'fadeIn 0.1s ease',
      }}
    >
      {items.map((item, i) =>
        item === null
          ? <div key={i} style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
          : (
            <button
              key={i}
              onClick={item.disabled ? undefined : item.onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                padding: '7px 14px', border: 'none', background: 'transparent',
                cursor: item.disabled ? 'not-allowed' : 'pointer', textAlign: 'left', fontSize: 12, fontFamily: 'inherit',
                color: item.disabled ? '#cbd5e1' : (item.danger ? '#ef4444' : '#1e293b'), transition: 'background 0.1s',
                opacity: item.disabled ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = item.danger ? '#fff5f5' : '#f8fafc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ color: item.disabled ? '#cbd5e1' : (item.danger ? '#ef4444' : '#64748b'), flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontWeight: 500 }}>{item.label}</span>
            </button>
          )
      )}
    </div>
  );
}

export default function TabBar({
  tabs, activeTabId,
  onSwitchTab, onCloseTab, onNewTab,
  onDuplicateTab, onCloseOtherTabs, onCloseTabsToRight, onPinTab,
}) {
  const [hoveredTabId, setHoveredTabId] = useState(null);
  const [faviconErrors, setFaviconErrors] = useState({});
  const [ctxMenu, setCtxMenu] = useState(null); // { tabId, x, y }
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  const handleWheel = e => {
    if (scrollRef.current) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY || e.deltaX;
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 38,
      background: 'white', borderBottom: '1px solid #e2e8f0',
      WebkitAppRegion: 'drag', flexShrink: 0,
    }}>
      {/* Прокручиваемая область вкладок */}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        style={{
          display: 'flex', alignItems: 'center', flex: 1,
          overflowX: 'auto', overflowY: 'hidden',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
          padding: '0 4px', gap: 2,
        }}
      >
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const isHovered = hoveredTabId === tab.id;
          const showClose = (isActive || isHovered) && !tab.isPinned;
          const hasFavicon = tab.favicon && !faviconErrors[tab.id];

          return (
            <div
              key={tab.id}
              onClick={() => onSwitchTab(tab.id)}
              onAuxClick={e => { if (e.button === 1 && !tab.isPinned) { e.preventDefault(); onCloseTab(tab.id); } }}
              onContextMenu={e => { e.preventDefault(); setCtxMenu({ tabId: tab.id, x: e.clientX, y: e.clientY }); }}
              onMouseEnter={() => setHoveredTabId(tab.id)}
              onMouseLeave={() => setHoveredTabId(null)}
              title={tab.isPinned ? `${tab.title || 'Новая вкладка'} (закреплена)` : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                height: 28,
                padding: tab.isPinned ? '0 8px' : '0 8px',
                borderRadius: 6, cursor: 'pointer',
                maxWidth: tab.isPinned ? 38 : 200,
                minWidth: tab.isPinned ? 32 : 80,
                flexShrink: 0, WebkitAppRegion: 'no-drag',
                background: isActive
                  ? (tab.isPrivate ? '#f3e8ff' : '#f1f5f9')
                  : (isHovered ? '#f8fafc' : 'transparent'),
                border: `1px solid ${isActive ? (tab.isPinned ? '#fbbf24' : tab.isPrivate ? '#d8b4fe' : '#e2e8f0') : 'transparent'}`,
                transition: 'background 0.15s, border-color 0.15s, max-width 0.2s',
                boxShadow: tab.isPinned && isActive ? '0 0 0 2px rgba(251,191,36,0.2)' : 'none',
              }}
            >
              {/* Иконка */}
              {tab.isPrivate ? (
                <svg width="10" height="10" fill="none" stroke="#7c3aed" viewBox="0 0 24 24" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
              ) : hasFavicon ? (
                <img
                  src={tab.favicon} width={11} height={11}
                  style={{ borderRadius: 2, flexShrink: 0 }}
                  onError={() => setFaviconErrors(prev => ({ ...prev, [tab.id]: true }))}
                />
              ) : (
                <div style={{
                  width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                  background: tab.isPinned ? '#f59e0b' : (tab.loading ? '#3b82f6' : '#cbd5e1'),
                  animation: tab.loading ? 'tabSpin 1s linear infinite' : 'none',
                  transition: 'background 0.2s',
                }} />
              )}

              {/* Заголовок — скрыт для закреплённых */}
              {!tab.isPinned && (
                <span style={{
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: 11,
                  color: isActive ? (tab.isPrivate ? '#7c3aed' : '#1e293b') : '#64748b',
                  fontWeight: isActive ? 500 : 400,
                }}>
                  {tab.title || 'Новая вкладка'}
                </span>
              )}

              {/* Индикатор воспроизведения звука */}
              {tab.isPlaying && !showClose && (
                <svg width="9" height="9" fill="#3b82f6" viewBox="0 0 20 20" style={{ flexShrink: 0, opacity: 0.85 }}>
                  <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"/>
                </svg>
              )}

              {/* Кнопка закрытия — только для незакреплённых */}
              {!tab.isPinned && (
                <CloseTabBtn visible={showClose} onClick={e => { e.stopPropagation(); onCloseTab(tab.id); }} />
              )}
            </div>
          );
        })}

        {/* Кнопка новой вкладки */}
        <NewTabBtn onClick={onNewTab} />

        {/* Drag region fill */}
        <div style={{ flex: 1, minWidth: 20, WebkitAppRegion: 'drag' }} />
      </div>

      {/* Кнопки управления окном */}
      {isElectron && (
        <WindowControls />
      )}

      {/* Контекстное меню */}
      {ctxMenu && (
        <TabContextMenu
          tabId={ctxMenu.tabId}
          tabs={tabs}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onDuplicateTab={onDuplicateTab}
          onCloseOtherTabs={onCloseOtherTabs}
          onCloseTabsToRight={onCloseTabsToRight}
          onCloseTab={onCloseTab}
          onPinTab={onPinTab}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

function CloseTabBtn({ visible, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 15, height: 15, borderRadius: 3, border: 'none',
        background: hov ? '#fee2e2' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: hov ? '#ef4444' : '#94a3b8',
        flexShrink: 0,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.12s, background 0.12s, color 0.12s',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <svg width="8" height="8" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  );
}

function NewTabBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 28, height: 28, borderRadius: 6, border: 'none',
        background: hov ? '#f1f5f9' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: hov ? '#2563eb' : '#94a3b8',
        fontSize: 16, flexShrink: 0, WebkitAppRegion: 'no-drag',
        transition: 'background 0.15s, color 0.15s',
      }}
    >+</button>
  );
}

function WindowControlBtn({ label, isClose, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 32, height: 28, border: 'none', borderRadius: 4,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, WebkitAppRegion: 'no-drag', flexShrink: 0,
        background: hov ? (isClose ? '#fee2e2' : '#f1f5f9') : 'transparent',
        color: hov && isClose ? '#ef4444' : '#94a3b8',
        transition: 'background 0.15s, color 0.15s',
      }}
    >{label}</button>
  );
}

function WindowControls() {
  return (
    <>
      <WindowControlBtn label="─" onClick={() => window.electronAPI.minimize?.()} />
      <WindowControlBtn label="□" onClick={() => window.electronAPI.maximize?.()} />
      <WindowControlBtn label="✕" isClose onClick={() => window.electronAPI.close?.()} />
    </>
  );
}
