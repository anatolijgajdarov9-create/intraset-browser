import React, { useState, useEffect } from 'react';

const isElectron = typeof window.electronAPI !== 'undefined';

function Section({ title, icon, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      background: 'white', borderRadius: 12, border: '1px solid #e2e8f0',
      overflow: 'hidden', marginBottom: 12
    }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', border: 'none', background: 'none',
        cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#1e293b'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          {title}
        </span>
        <svg width="16" height="16" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

function Toggle({ label, checked, onChange, description }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{description}</div>}
      </div>
      <button onClick={() => onChange(!checked)} style={{
        width: 42, height: 24, borderRadius: 12, border: 'none',
        background: checked ? '#2563eb' : '#d1d5db',
        position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%', background: 'white',
          position: 'absolute', top: 2, left: checked ? 20 : 2,
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}/>
      </button>
    </div>
  );
}

function SelectRow({ label, value, options, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px',
        fontSize: 12, color: '#475569', background: '#f8fafc', outline: 'none', cursor: 'pointer'
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── SettingsPage ─────────────────────────────────────────────────────────────
export default function SettingsPage({ onNavigate }) {
  // Search engine
  const [searchEngine, setSearchEngine] = useState(() =>
    localStorage.getItem('intra-search-engine') || 'yandex'
  );

  // New tab mode
  const [newTabMode, setNewTabMode] = useState(() =>
    localStorage.getItem('intra-newtab') || 'home'
  );

  // UI settings
  const [animations, setAnimations] = useState(() =>
    localStorage.getItem('intra-ui-animations') !== 'false'
  );
  const [compact, setCompact] = useState(() =>
    localStorage.getItem('intra-ui-compact') === 'true'
  );
  const [darkMode, setDarkMode] = useState(() =>
    localStorage.getItem('intra-dark-mode') === 'true'
  );

  // Intranet
  const [intranetOnly, setIntranetOnly] = useState(() =>
    localStorage.getItem('intra-intranet-only') === 'true'
  );

  // AI server path
  const [serverPath, setServerPath] = useState(() =>
    localStorage.getItem('intra-llama-server') || ''
  );
  const [contextSize, setContextSize] = useState(() =>
    Number(localStorage.getItem('intra-ai-context')) || 4096
  );

  // Storage stats
  const [storageSize, setStorageSize] = useState(0);

  useEffect(() => {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    setStorageSize(total);
  }, []);

  const saveSetting = (key, value) => {
    localStorage.setItem(`intra-${key}`, String(value));
  };

  const handleSearchEngineChange = (engine) => {
    setSearchEngine(engine);
    saveSetting('search-engine', engine);
  };

  const handleNewTabModeChange = (mode) => {
    setNewTabMode(mode);
    saveSetting('newtab', mode);
  };

  const handleAnimationsChange = (val) => {
    setAnimations(val);
    saveSetting('ui-animations', val);
    window.dispatchEvent(new Event('storage'));
  };

  const handleCompactChange = (val) => {
    setCompact(val);
    saveSetting('ui-compact', val);
    window.dispatchEvent(new Event('storage'));
  };

  const handleDarkModeChange = (val) => {
    setDarkMode(val);
    saveSetting('dark-mode', val);
    document.body.classList.toggle('intra-dark', val);
  };

  const handleIntranetChange = (val) => {
    setIntranetOnly(val);
    saveSetting('intranet-only', val);
  };

  const handleSelectServerPath = async () => {
    if (!isElectron) return;
    const result = await window.electronAPI.showOpenDialog({
      title: 'Выберите llama-server',
      filters: [{ name: 'Executable', extensions: ['exe', 'bin', '*'] }],
      properties: ['openFile'],
    });
    if (!result.canceled && result.filePaths?.length) {
      const path = result.filePaths[0];
      setServerPath(path);
      localStorage.setItem('intra-llama-server', path);
    }
  };

  const handleClearData = async (type) => {
    if (!confirm('Вы уверены?')) return;
    switch (type) {
      case 'history':
        localStorage.removeItem('intra-history');
        break;
      case 'visits':
        localStorage.removeItem('intra-visits');
        break;
      case 'bookmarks':
        localStorage.removeItem('intra-bookmarks');
        break;
      case 'events':
        localStorage.removeItem('intra-events');
        break;
      case 'note':
        localStorage.removeItem('intra-note');
        break;
      case 'all':
        if (!confirm('Это удалит ВСЕ данные браузера. Продолжить?')) return;
        const keys = Object.keys(localStorage).filter(k => k.startsWith('intra-'));
        keys.forEach(k => localStorage.removeItem(k));
        break;
    }
    setStorageSize(() => {
      let total = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) total += localStorage[key].length + key.length;
      }
      return total;
    });
  };

  const formatBytes = (chars) => {
    if (chars < 1024) return `${chars} символов`;
    return `${(chars / 1024).toFixed(1)} КБ`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
        background: 'white', borderBottom: '1px solid #e2e8f0'
      }}>
        <button onClick={() => onNavigate('intra://home')} style={{
          border: 'none', background: 'none', cursor: 'pointer', color: '#64748b',
          display: 'flex', alignItems: 'center', padding: 4
        }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>Настройки</h1>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20, maxWidth: 640, margin: '0 auto', width: '100%' }}>
        {/* Search */}
        <Section title="Поиск" icon={
          <svg width="18" height="18" fill="none" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="1.8">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
        }>
          <SelectRow
            label="Поисковая система"
            value={searchEngine}
            options={[
              { value: 'yandex', label: 'Яндекс' },
              { value: 'google', label: 'Google' },
              { value: 'duckduckgo', label: 'DuckDuckGo' },
              { value: 'bing', label: 'Bing' },
            ]}
            onChange={handleSearchEngineChange}
          />
        </Section>

        {/* New Tab */}
        <Section title="Новая вкладка" icon={
          <svg width="18" height="18" fill="none" stroke="#7c3aed" viewBox="0 0 24 24" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/>
          </svg>
        }>
          <SelectRow
            label="При открытии новой вкладки"
            value={newTabMode}
            options={[
              { value: 'home', label: 'Домашняя страница' },
              { value: 'blank', label: 'Пустая страница' },
            ]}
            onChange={handleNewTabModeChange}
          />
        </Section>

        {/* Appearance */}
        <Section title="Внешний вид" icon={
          <svg width="18" height="18" fill="none" stroke="#0891b2" viewBox="0 0 24 24" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
          </svg>
        }>
          <Toggle label="Анимации" description="Плавные переходы и эффекты" checked={animations} onChange={handleAnimationsChange} />
          <Toggle label="Тёмная тема" description="Тёмное оформление интерфейса" checked={darkMode} onChange={handleDarkModeChange} />
          <Toggle label="Компактный режим" description="Уменьшенные отступы и шрифты" checked={compact} onChange={handleCompactChange} />
        </Section>

        {/* Network */}
        <Section title="Сеть" icon={
          <svg width="18" height="18" fill="none" stroke="#f97316" viewBox="0 0 24 24" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
          </svg>
        }>
          <Toggle label="Только интрасеть" description="Блокировать внешние сайты" checked={intranetOnly} onChange={handleIntranetChange} />
        </Section>

        {/* AI */}
        <Section title="AI-ассистент" icon={
          <svg width="18" height="18" fill="none" stroke="#10b981" viewBox="0 0 24 24" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
        }>
          <div style={{ padding: '10px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', marginBottom: 6 }}>Путь к llama-server</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={serverPath}
                readOnly
                placeholder="Не выбран"
                style={{
                  flex: 1, height: 32, padding: '0 10px', fontSize: 12,
                  border: '1px solid #e2e8f0', borderRadius: 7, outline: 'none',
                  background: '#f8fafc', color: serverPath ? '#1e293b' : '#94a3b8'
                }}
              />
              {isElectron && (
                <button onClick={handleSelectServerPath} style={{
                  padding: '0 14px', borderRadius: 7, border: 'none',
                  background: '#2563eb', color: 'white', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
                }}>Выбрать</button>
              )}
            </div>
          </div>
          <div style={{ padding: '10px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', marginBottom: 6 }}>Размер контекста</div>
            <select value={contextSize} onChange={e => {
              const v = Number(e.target.value);
              setContextSize(v);
              saveSetting('ai-context', v);
            }} style={{
              border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px',
              fontSize: 12, color: '#475569', background: '#f8fafc', outline: 'none', cursor: 'pointer'
            }}>
              <option value={2048}>2048 токенов</option>
              <option value={4096}>4096 токенов</option>
              <option value={8192}>8192 токенов</option>
              <option value={16384}>16384 токенов</option>
            </select>
          </div>
        </Section>

        {/* Storage */}
        <Section title="Хранилище данных" icon={
          <svg width="18" height="18" fill="none" stroke="#6366f1" viewBox="0 0 24 24" strokeWidth="1.8">
            <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
        }>
          <div style={{ padding: '10px 0', fontSize: 12, color: '#64748b' }}>
            Занято: <strong>{formatBytes(storageSize)}</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { key: 'history', label: 'История' },
              { key: 'visits', label: 'Посещения' },
              { key: 'bookmarks', label: 'Закладки' },
              { key: 'events', label: 'События' },
              { key: 'note', label: 'Заметка' },
            ].map(item => (
              <button key={item.key} onClick={() => handleClearData(item.key)} style={{
                padding: '5px 10px', borderRadius: 6, border: '1px solid #f1f5f9',
                background: '#f8fafc', fontSize: 11, color: '#64748b', cursor: 'pointer'
              }}>Очистить: {item.label}</button>
            ))}
            <button onClick={() => handleClearData('all')} style={{
              padding: '5px 10px', borderRadius: 6, border: '1px solid #fecaca',
              background: '#fef2f2', fontSize: 11, color: '#ef4444', cursor: 'pointer', fontWeight: 600
            }}>Очистить всё</button>
          </div>
        </Section>

        {/* About */}
        <Section title="О браузере" icon={
          <svg width="18" height="18" fill="none" stroke="#64748b" viewBox="0 0 24 24" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
          </svg>
        }>
          <div style={{ padding: '8px 0', fontSize: 13, color: '#475569' }}>
            <div><strong>Intra Browser</strong> — браузер для интранет-сетей</div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8' }}>
              Electron + React + llama.cpp
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
