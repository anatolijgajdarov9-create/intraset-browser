import React, { useState, useEffect, useCallback, useMemo } from 'react';

const isElectron = typeof window.electronAPI !== 'undefined';

function getHistory() {
  try { return JSON.parse(localStorage.getItem('intra-history') || '[]'); } catch { return []; }
}

function saveHistory(history) {
  localStorage.setItem('intra-history', JSON.stringify(history));
}

// ─── Группировка по дням ────────────────────────────────────────────────────
function groupByDay(items) {
  const groups = [];
  const now = Date.now();
  const dayMs = 86400000;

  for (const item of items) {
    const ts = item.timestamp || 0;
    const diff = Math.floor((now - ts) / dayMs);
    let label;
    if (diff === 0) label = 'Сегодня';
    else if (diff === 1) label = 'Вчера';
    else if (diff < 7) label = itemDateLabel(ts);
    else label = itemDateLabel(ts);

    if (!groups.length || groups[groups.length - 1].label !== label) {
      groups.push({ label, items: [] });
    }
    groups[groups.length - 1].items.push(item);
  }
  return groups;
}

function itemDateLabel(ts) {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── Иконки ──────────────────────────────────────────────────────────────────
function GlobeIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="1.8" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="12" height="12" fill="#2563eb" stroke="#2563eb" viewBox="0 0 24 24" strokeWidth="1.5" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
    </svg>
  );
}

// ─── HistoryItem ─────────────────────────────────────────────────────────────
function HistoryItem({ item, onNavigate, onDelete, isBookmarked }) {
  const [hov, setHov] = useState(false);
  const time = new Date(item.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onNavigate(item.url)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
        borderRadius: 8, background: hov ? '#f8fafc' : 'transparent',
        transition: 'all 0.15s', cursor: 'pointer'
      }}
    >
      {item.favicon
        ? <img src={item.favicon} width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />
        : <GlobeIcon />
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title || item.url}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.url}
        </div>
      </div>
      <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{time}</span>
      {isBookmarked && <BookmarkIcon />}
      {hov && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(item.url); }}
          style={{
            width: 22, height: 22, borderRadius: 5, border: 'none', flexShrink: 0,
            background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#ef4444'
          }}
        >
          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── HistoryPage ─────────────────────────────────────────────────────────────
export default function HistoryPage({ onNavigate, bookmarks = [] }) {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState(() => getHistory());
  const [selectedDate, setSelectedDate] = useState(null); // фильтр по дню

  useEffect(() => {
    const handler = () => setHistory(getHistory());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const bookmarkUrls = useMemo(() => new Set(bookmarks.map(b => b.url)), [bookmarks]);

  // Доступные даты для фильтра
  const availableDates = useMemo(() => {
    const dates = new Set();
    for (const h of history) {
      if (h.timestamp) dates.add(new Date(h.timestamp).toDateString());
    }
    return Array.from(dates).sort().reverse();
  }, [history]);

  // Фильтрация
  const filtered = useMemo(() => {
    let items = history;
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(h =>
        (h.title || '').toLowerCase().includes(q) ||
        h.url.toLowerCase().includes(q)
      );
    }
    if (selectedDate) {
      items = items.filter(h => new Date(h.timestamp).toDateString() === selectedDate);
    }
    return items;
  }, [history, query, selectedDate]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  const handleDelete = useCallback((url) => {
    const next = history.filter(h => h.url !== url);
    setHistory(next);
    saveHistory(next);
  }, [history]);

  const handleClearAll = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const handleDeleteDay = useCallback((dateStr) => {
    const next = history.filter(h => new Date(h.timestamp).toDateString() !== dateStr);
    setHistory(next);
    saveHistory(next);
  }, [history]);

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
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>История</h1>
        {history.length > 0 && (
          <button onClick={handleClearAll} style={{
            marginLeft: 'auto', padding: '6px 14px', borderRadius: 7, border: '1px solid #fecaca',
            background: '#fef2f2', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>
            Очистить историю
          </button>
        )}
      </div>

      {/* Search + Date filter */}
      <div style={{ padding: '12px 20px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9, padding: '0 12px'
        }}>
          <svg width="14" height="14" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск по истории..."
            style={{
              flex: 1, border: 'none', background: 'none', outline: 'none',
              fontSize: 13, color: '#1e293b', padding: '8px 0'
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
        {availableDates.length > 1 && (
          <select
            value={selectedDate || ''}
            onChange={e => setSelectedDate(e.target.value || null)}
            style={{
              border: '1px solid #e2e8f0', borderRadius: 8, padding: '0 10px',
              fontSize: 12, color: '#475569', background: '#f8fafc', outline: 'none',
              cursor: 'pointer', minWidth: 120
            }}
          >
            <option value="">Все даты</option>
            {availableDates.map(d => (
              <option key={d} value={d}>{new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 0' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
            <svg width="48" height="48" fill="none" stroke="#cbd5e1" viewBox="0 0 24 24" strokeWidth="1" style={{ margin: '0 auto 12px', display: 'block' }}>
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>
              {query || selectedDate ? 'Ничего не найдено' : 'История пуста'}
            </div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              {query || selectedDate ? 'Попробуйте изменить фильтры' : 'Посещённые страницы появятся здесь'}
            </div>
          </div>
        ) : (
          grouped.map((group, gi) => (
            <div key={gi} style={{ marginBottom: gi < grouped.length - 1 ? 16 : 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 20px', fontSize: 12, fontWeight: 700, color: '#64748b',
                textTransform: 'uppercase', letterSpacing: '0.04em'
              }}>
                <span>{group.label}</span>
                <button
                  onClick={() => handleDeleteDay(group.items[0] && new Date(group.items[0].timestamp).toDateString())}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 11, fontWeight: 500, textTransform: 'none', letterSpacing: 'normal' }}
                >Удалить день</button>
              </div>
              {group.items.map((item, ii) => (
                <HistoryItem
                  key={`${item.url}-${ii}`}
                  item={item}
                  onNavigate={onNavigate}
                  onDelete={handleDelete}
                  isBookmarked={bookmarkUrls.has(item.url)}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
