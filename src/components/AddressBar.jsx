import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const AddressBar = forwardRef(function AddressBar({ value, onChange, onNavigate, activeTab }, ref) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selIdx, setSelIdx] = useState(-1);
  const inputRef = useRef(null);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const isSecure = activeTab?.url?.startsWith('https://');

  // Экспортируем focus/select для Ctrl+L
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    select: () => inputRef.current?.select(),
  }));

  useEffect(() => {
    if (!focused) { setDebouncedValue(value); return; }
    const t = setTimeout(() => setDebouncedValue(value), 140);
    return () => clearTimeout(t);
  }, [value, focused]);

  useEffect(() => {
    if (!focused || !debouncedValue.trim()) { setSuggestions([]); setSelIdx(-1); return; }
    const q = debouncedValue.trim().toLowerCase();
    if (q.length < 2) { setSuggestions([]); setSelIdx(-1); return; }
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
    const isSearchQuery = !/^[\w.-]+\.[a-z]{2,}(\/.*)?$/.test(q) && !/^\d{1,3}\.\d/.test(q);
    if (isSearchQuery) {
      results.push({ url: `__search__:${debouncedValue.trim()}`, title: `Найти: ${debouncedValue.trim()}`, favicon: null, type: 'search' });
    }
    setSuggestions(results);
    setSelIdx(-1);
  }, [debouncedValue, focused]);

  const handleKeyDown = e => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelIdx(i => Math.max(i - 1, -1)); return; }
      if (e.key === 'Escape') { setSuggestions([]); setSelIdx(-1); return; }
    }
    if (e.key === 'Enter') {
      const sel = selIdx >= 0 && suggestions[selIdx] ? suggestions[selIdx] : null;
      const target = sel
        ? (sel.url.startsWith('__search__:') ? sel.url.slice('__search__:'.length) : sel.url)
        : value;
      onNavigate(target);
      setSuggestions([]);
      setSelIdx(-1);
      inputRef.current?.blur();
    }
  };

  const showDropdown = focused && suggestions.length > 0;

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8, height: 34,
          padding: '0 10px',
          borderRadius: showDropdown ? '8px 8px 0 0' : 8,
          cursor: 'text',
          background: focused ? 'white' : '#f8fafc',
          border: `1px solid ${focused ? '#3b82f6' : '#e2e8f0'}`,
          borderBottom: showDropdown ? '1px solid #e2e8f0' : undefined,
          boxShadow: focused && !showDropdown ? '0 0 0 3px rgba(59,130,246,0.1)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Иконка безопасности */}
        <div style={{ flexShrink: 0, opacity: focused ? 0 : 1, transition: 'opacity 0.15s', display: 'flex' }}>
          {isSecure
            ? <svg width="12" height="12" fill="#22c55e" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
            : <svg width="12" height="12" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
          }
        </div>

        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { setFocused(true); setTimeout(() => inputRef.current?.select(), 0); }}
          onBlur={() => { setFocused(false); setTimeout(() => setSuggestions([]), 150); }}
          placeholder="Введите адрес или поисковый запрос..."
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#1e293b', fontSize: 13 }}
        />

        {focused && value.length > 0 && (
          <button
            onMouseDown={e => { e.preventDefault(); onChange(''); inputRef.current?.focus(); setSuggestions([]); }}
            style={{
              width: 16, height: 16, borderRadius: '50%', border: 'none',
              background: '#cbd5e1', color: '#475569',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, padding: 0,
            }}
          >
            <svg width="8" height="8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Выпадающий список подсказок */}
      {showDropdown && (
        <div style={{
          position: 'absolute', top: 34, left: 0, right: 0, zIndex: 1000,
          background: 'white', border: '1px solid #3b82f6', borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 0 0 3px rgba(59,130,246,0.1)',
          overflow: 'hidden', animation: 'fadeIn 0.08s ease',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={s.url + i}
              onMouseDown={() => {
                const nav = s.url.startsWith('__search__:') ? s.url.slice('__search__:'.length) : s.url;
                onNavigate(nav); setSuggestions([]);
              }}
              onMouseEnter={() => setSelIdx(i)}
              onMouseLeave={() => setSelIdx(-1)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                cursor: 'pointer',
                background: i === selIdx ? '#eff6ff' : 'transparent',
                borderTop: i > 0 ? '1px solid #f1f5f9' : 'none',
                transition: 'background 0.1s',
              }}
            >
              {s.type === 'search'
                ? <svg width="14" height="14" fill="none" stroke="#64748b" viewBox="0 0 24 24" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                : s.favicon
                  ? <img src={s.favicon} width={14} height={14} style={{ borderRadius: 2, flexShrink: 0 }} />
                  : <svg width="14" height="14" fill="none" stroke={s.type === 'bookmark' ? '#2563eb' : '#94a3b8'} viewBox="0 0 24 24" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                      {s.type === 'bookmark'
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                        : <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></>
                      }
                    </svg>
              }
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, color: s.type === 'search' ? '#475569' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: s.type === 'search' ? 'italic' : 'normal' }}>{s.title}</div>
                {s.type !== 'search' && <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url}</div>}
              </div>
              {s.type === 'bookmark' && (
                <span style={{ fontSize: 9, color: '#2563eb', fontWeight: 700, background: '#eff6ff', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>БМ</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default AddressBar;
