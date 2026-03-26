import React, { useState, useEffect, useRef, useCallback } from 'react';

const isElectron = typeof window.electronAPI !== 'undefined';

function GlobeIcon({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="gc" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#60c8ff"/>
          <stop offset="100%" stopColor="#1565c0"/>
        </radialGradient>
        <radialGradient id="gn" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#80d4ff"/>
          <stop offset="100%" stopColor="#1976d2"/>
        </radialGradient>
        <filter id="glow2"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx="50" cy="50" r="46" stroke="url(#gc)" strokeWidth="2.5" fill="none"/>
      <ellipse cx="50" cy="50" rx="28" ry="46" stroke="url(#gc)" strokeWidth="1.8" fill="none"/>
      <ellipse cx="50" cy="50" rx="46" ry="22" stroke="url(#gc)" strokeWidth="1.8" fill="none"/>
      <line x1="50" y1="4" x2="50" y2="96" stroke="url(#gc)" strokeWidth="1.8"/>
      <line x1="4" y1="50" x2="96" y2="50" stroke="url(#gc)" strokeWidth="1.8"/>
      <line x1="15" y1="18" x2="85" y2="82" stroke="url(#gc)" strokeWidth="1.5" opacity="0.7"/>
      <line x1="85" y1="18" x2="15" y2="82" stroke="url(#gc)" strokeWidth="1.5" opacity="0.7"/>
      {[[50,4],[50,96],[4,50],[96,50],[50,27],[50,73],[22,28],[78,28],[22,72],[78,72],[27,50],[73,50],[50,50]].map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r={i===12?5:3.5} fill="url(#gn)" filter="url(#glow2)"/>
      ))}
    </svg>
  );
}

function SBtn({ icon, label, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button onClick={onClick}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{
          width: '100%', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 10, border: 'none', cursor: 'pointer',
          background: active ? '#eff6ff' : hov ? '#f8fafc' : 'transparent',
          color: active ? '#2563eb' : hov ? '#2563eb' : '#64748b',
          borderLeft: `3px solid ${active ? '#2563eb' : 'transparent'}`,
          transition: 'all 0.15s'
        }}>{icon}</button>
      {hov && label && (
        <div style={{
          position: 'absolute', left: '110%', top: '50%', transform: 'translateY(-50%)',
          background: '#0f172a', color: 'white', fontSize: 11, fontWeight: 500,
          padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 1000,
          pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>{label}</div>
      )}
    </div>
  );
}

// Panel — панель слева (рядом с доком)
function Panel({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 500, display: 'flex', alignItems: 'stretch',
      pointerEvents: 'none'
    }}>
      {/* Панель слева - левее дока */}
      <div style={{
        width: 380, background: 'white', boxShadow: '8px 0 40px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.25s ease',
        flexShrink: 0, pointerEvents: 'auto', marginLeft: 60
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid #f1f5f9'
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{title}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display:'flex', alignItems:'center', padding:2 }}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>{children}</div>
      </div>
      {/* Overlay справа от панели - для закрытия */}
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.18)', pointerEvents: 'auto' }} onClick={onClose}/>
    </div>
  );
}

function SCard({ icon, label, color, bg, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}
        style={{
          width: 56, height: 56, borderRadius: 14, background: hov ? color : bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: typeof icon === 'string' ? 24 : undefined,
          color: hov ? 'white' : color,
          transition: 'all 0.25s', boxShadow: hov ? `0 8px 20px ${color}40` : '0 2px 6px rgba(0,0,0,0.06)',
          transform: hov ? 'translateY(-2px)' : 'none'
        }}>{icon}</div>
      <span style={{ fontSize: 11, fontWeight: 500, color: '#475569', maxWidth: 60, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

function TRow({ favicon, title, url, time, onOpen, onClose }) {
  const [hov, setHov] = useState(false);
  const timeStr = time ? new Date(time).toLocaleString('ru', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
        borderRadius: 10, background: hov ? '#f8fafc' : 'transparent',
        transition: 'all 0.15s', cursor: 'pointer'
      }} onClick={onOpen}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, background: '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        {favicon ? <img src={favicon} width={14} height={14} onError={e=>e.target.style.display='none'}/> : <svg width="14" height="14" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20"/></svg>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title || url || 'Без названия'}</div>
        <div style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{timeStr || url}</div>
      </div>
      {hov && onClose && (
        <button onClick={e => { e.stopPropagation(); onClose(); }} style={{
          width: 24, height: 24, borderRadius: 6, border: 'none', flexShrink: 0,
          background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#ef4444'
        }}><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
      )}
    </div>
  );
}

// Получить топ посещаемых сайтов из localStorage
function getTopVisits(limit = 8) {
  try {
    const visits = JSON.parse(localStorage.getItem('intra-visits') || '{}');
    return Object.entries(visits)
      .filter(([, data]) => {
        // Фильтруем записи без заголовка и с нечитаемыми URL
        if (!data.url) return false;
        try { new URL(data.url); } catch { return false; }
        return true;
      })
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([, data]) => ({ ...data }));
  } catch {
    return [];
  }
}

// Получить историю посещений
function getHistory(limit = 100) {
  try {
    return JSON.parse(localStorage.getItem('intra-history') || '[]').slice(0, limit);
  } catch {
    return [];
  }
}

const VISIT_COLORS = ['#2563eb','#7c3aed','#0891b2','#6366f1','#f97316','#10b981','#f59e0b','#8b5cf6'];
const VISIT_BGS    = ['#eff6ff','#f5f3ff','#ecfeff','#eef2ff','#fff7ed','#ecfdf5','#fffbeb','#f5f3ff'];

// Безопасное получение hostname из URL
function safeHostname(url) {
  try { return new URL(url).hostname; } catch { return url.slice(0, 20); }
}

// ─── EventDetailModal ────────────────────────────────────────────────────────
function EventDetailModal({ event, onClose, onDelete, onNavigate, onSave }) {
  const [note, setNote] = useState(event.note || '');
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 16, width: 440, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{event.title}</span>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display:'flex', alignItems:'center', padding:2 }}><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ background: '#eff6ff', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
              {event.date || '—'}
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#166534', fontWeight: 600 }}>
              ⏰ {event.time || '—'}
            </div>
          </div>
          {event.subtitle && (
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{event.subtitle}</div>
          )}
          {event.url && (
            <button onClick={() => { onNavigate(event.url); onClose(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              Открыть ссылку события
            </button>
          )}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Заметки к событию</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Добавьте заметки, ссылки, детали..."
              style={{ width: '100%', minHeight: 80, padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: '#1e293b' }}/>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
          <button onClick={() => { onSave({ ...event, note }); onClose(); }}
            style={{ flex: 1, padding: '9px 0', background: '#2563eb', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Сохранить</button>
          <button onClick={() => { onDelete(event.id); onClose(); }}
            style={{ padding: '9px 16px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Удалить</button>
        </div>
      </div>
    </div>
  );
}

function applyUiPrefs({ animations, compact }) {
  let el = document.getElementById('intra-ui-style');
  if (!el) { el = document.createElement('style'); el.id = 'intra-ui-style'; document.head.appendChild(el); }
  el.textContent = !animations
    ? '*, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }'
    : '';
  document.body.classList.toggle('intra-compact', Boolean(compact));
}

export default function HomePage({
  onNavigate, tabs = [], activeTabId, onNewTab, onNewPrivateTab,
  onSwitchTab, onCloseTab, intranetOnly, onToggleIntranetOnly,
  bookmarks = [], onBookmarksChange, onOpenAiChat,
  browserNotifications = [], onClearBrowserNotifications,
  searchEngine = 'yandex', onSearchEngineChange,
}) {
  const [time, setTime] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggSelIdx, setSuggSelIdx] = useState(-1);
  const [searchFocused, setSearchFocused] = useState(false);
  const [panel, setPanel] = useState(null);
  const [networkMode, setNetworkMode] = useState(intranetOnly ? 'intranet' : 'internet');

  // Events — persist to localStorage
  const [events, setEventsState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('intra-events') || '[]'); } catch { return []; }
  });
  const setEvents = useCallback((updater) => {
    setEventsState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem('intra-events', JSON.stringify(next));
      return next;
    });
  }, []);

  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', subtitle: '', url: '' });
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [detailEvent, setDetailEvent] = useState(null);
  const [topVisits, setTopVisits] = useState([]);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState(() => localStorage.getItem('intra-note') || '');
  const [showWidgetManager, setShowWidgetManager] = useState(false);
  const [widgets, setWidgets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('intra-widgets') || '{}'); } catch { return {}; }
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [newBm, setNewBm] = useState({ title: '', url: '' });
  const [showAddBm, setShowAddBm] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [uiSettings, setUiSettings] = useState(() => ({
    animations: localStorage.getItem('intra-ui-animations') !== 'false',
    compact: localStorage.getItem('intra-ui-compact') !== 'false',
  }));
  useEffect(() => { applyUiPrefs(uiSettings); }, []); // eslint-disable-line

  const toggleUiSetting = (key) => {
    setUiSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(`intra-ui-${key}`, String(next[key]));
      applyUiPrefs(next);
      return next;
    });
  };
  const [newTabMode, setNewTabMode] = useState(() => localStorage.getItem('intra-newtab') || 'home');

  // AI GGUF — node-llama-cpp (нативный, главный процесс, без ограничений по размеру)
  const [aiModel, setAiModel] = useState(() => {
    try { return JSON.parse(localStorage.getItem('intra-ai-model') || 'null'); } catch { return null; }
  });
  const [aiLoaded, setAiLoaded] = useState(false);
  const [aiChat, setAiChat] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiContextSize, setAiContextSize] = useState(() => Number(localStorage.getItem('intra-ai-context')) || 4096);
  const [aiLoadProgress, setAiLoadProgress] = useState(null); // null=idle, 0-100=loading
  const aiLoadTimerRef = useRef(null);
  const [aiStreamedTokens, setAiStreamedTokens] = useState(0);

  // Downloads
  const [downloads, setDownloads] = useState([]);

  useEffect(() => {
    if (!isElectron) return;
    const pollDownloads = async () => {
      try {
        const res = await window.electronAPI.getDownloads();
        if (res?.success) setDownloads(res.downloads || []);
      } catch (e) { console.error('Downloads poll error:', e); }
    };
    pollDownloads();
    const interval = setInterval(pollDownloads, 1000);
    return () => clearInterval(interval);
  }, []);

  const notifBtnRef = useRef(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
      const days = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
      const months = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
      setDateStr(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setTopVisits(getTopVisits(8));
    setHistoryItems(getHistory(50));
  }, []); // обновляется при каждом монтировании (при возврате на домашнюю страницу)

  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); setSuggSelIdx(-1); return; }
    const q = query.trim().toLowerCase();
    const seen = new Set();
    const results = [];
    try {
      const history = JSON.parse(localStorage.getItem('intra-history') || '[]');
      for (const h of history) {
        if (results.length >= 6) break;
        if (!h.url || seen.has(h.url)) continue;
        if (h.url.toLowerCase().includes(q) || (h.title || '').toLowerCase().includes(q)) {
          seen.add(h.url);
          results.push({ url: h.url, title: h.title || h.url, favicon: h.favicon, type: 'history' });
        }
      }
    } catch {}
    try {
      const bms = JSON.parse(localStorage.getItem('intra-bookmarks') || '[]');
      for (const b of bms) {
        if (results.length >= 6) break;
        if (!b.url || seen.has(b.url)) continue;
        if (b.url.toLowerCase().includes(q) || (b.title || '').toLowerCase().includes(q)) {
          seen.add(b.url);
          results.push({ url: b.url, title: b.title || b.url, favicon: b.favicon, type: 'bookmark' });
        }
      }
    } catch {}
    setSuggestions(results);
    setSuggSelIdx(-1);
  }, [query]);

  const handleSearch = (e) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSuggSelIdx(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSuggSelIdx(i => Math.max(i - 1, -1)); return; }
      if (e.key === 'Escape') { setSuggestions([]); setSuggSelIdx(-1); return; }
    }
    if (e.key === 'Enter') {
      const target = suggSelIdx >= 0 && suggestions[suggSelIdx] ? suggestions[suggSelIdx].url : query.trim();
      if (target) { onNavigate(target); setSuggestions([]); setSuggSelIdx(-1); }
    }
  };

  const suggestionDropdown = searchFocused && suggestions.length > 0 && (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, marginTop: 2,
      background: 'white', border: '1px solid #3b82f6', borderRadius: 10,
      boxShadow: '0 8px 24px rgba(37,99,235,0.12)', overflow: 'hidden'
    }}>
      {suggestions.map((s, i) => (
        <div key={s.url}
          onMouseDown={() => { onNavigate(s.url); setSuggestions([]); setSuggSelIdx(-1); setQuery(''); }}
          onMouseEnter={() => setSuggSelIdx(i)}
          onMouseLeave={() => setSuggSelIdx(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
            cursor: 'pointer', background: i === suggSelIdx ? '#eff6ff' : 'transparent',
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
  );

  // Синхронизация состояния AI с главным процессом + потоковые события
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.aiGetStatus().then(status => {
      if (status.loaded && status.modelName) {
        setAiLoaded(true);
        setAiModel(prev => prev || { name: status.modelName });
        if (status.contextSize) setAiContextSize(status.contextSize);
      }
    }).catch(() => {});

    const offToken = window.electronAPI.onAiToken((text) => {
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
      setAiLoading(false);
      setAiStreamedTokens(0);
      setAiChat(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, streaming: false } : m));
    });
    const offError = window.electronAPI.onAiError((msg) => {
      setAiLoading(false);
      setAiStreamedTokens(0);
      setAiChat(prev => [...prev, { role: 'bot', text: `❌ Ошибка: ${msg}` }]);
    });
    const offLog = window.electronAPI.onAiServerLog?.((text) => {
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

  const handleLoadModel = async () => {
    if (!window.electronAPI) return;

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

  const sendAiMessage = () => {
    if (!aiInput.trim() || !aiLoaded || aiLoading) return;
    const userText = aiInput.trim();
    setAiInput('');
    setAiStreamedTokens(0);
    setAiChat(prev => [...prev, { role: 'user', text: userText }]);
    setAiLoading(true);
    // Ответ приходит через события ai-token / ai-done / ai-error
    window.electronAPI.aiChat(userText).catch(() => {});
  };

  // Вкладки открытые сейчас (не-домашние)
  const recentTabs = (tabs || []).filter(t => !t.isHome && t.url && t.url !== 'intra://home');

  // AI context usage estimation
  const estimatedTokens = aiChat
    .filter(m => !m.isServerLog)
    .reduce((s, m) => s + Math.ceil((m.text || '').length / 4), 0);
  const contextUsedPct = aiLoaded && aiContextSize > 0
    ? Math.min(100, Math.round(estimatedTokens / aiContextSize * 100))
    : 0;
  const lastBotMsg = [...aiChat].reverse().find(m => m.role === 'bot' && !m.isServerLog && !m.streaming);

  const updateWidgets = (next) => {
    setWidgets(next);
    localStorage.setItem('intra-widgets', JSON.stringify(next));
  };

  // Upcoming events: today or in the future (not past dates)
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingEvents = events
    .filter(ev => !ev.date || ev.date >= todayStr)
    .slice(0, 5);
  // Total notification count: upcoming events + browser notifications
  const totalNotifCount = upcomingEvents.length + browserNotifications.length;

  const clearHistory = () => {
    localStorage.removeItem('intra-history');
    localStorage.removeItem('intra-visits');
    setHistoryItems([]);
    setTopVisits([]);
  };

  const refreshTopVisits = useCallback(() => setTopVisits(getTopVisits(8)), []);

  const clearTopVisits = () => {
    localStorage.removeItem('intra-visits');
    setTopVisits([]);
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%', background: 'linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)', fontFamily: "'Inter','Manrope',system-ui,sans-serif" }}>

      {/* ── SIDEBAR — zIndex 600, ВЫШЕ чем Panel (zIndex 500) ── */}
      <div style={{
        width: 60, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '14px 6px', background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)', borderRight: '1px solid #e2e8f0',
        flexShrink: 0, zIndex: 600, position: 'relative'
      }}>
        <div style={{
          marginBottom: 20, padding: 7, borderRadius: 12, background: 'white',
          cursor: 'pointer', boxShadow: '0 2px 10px rgba(37,99,235,0.15)',
          border: '1px solid #e2e8f0', transition: 'transform 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
          onMouseEnter={e => e.currentTarget.style.transform='scale(1.07)'}
          onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}
          onClick={() => onNavigate('intra://home')}
        ><GlobeIcon size={26}/></div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
          <SBtn active={!panel} label="Главная" onClick={() => setPanel(null)}
            icon={<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>}
          />
          <SBtn active={panel==='bookmarks'} label="Закладки" onClick={() => setPanel(p => p==='bookmarks'?null:'bookmarks')}
            icon={<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>}
          />
          <SBtn active={panel==='history'} label="История" onClick={() => { setHistoryItems(getHistory(50)); setPanel(p => p==='history'?null:'history'); }}
            icon={<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          />
          <SBtn active={panel==='downloads'} label="Загрузки" onClick={() => setPanel(p => p==='downloads'?null:'downloads')}
            icon={<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>}
          />
          <div style={{ height: 1, background: '#e2e8f0', margin: '4px 8px' }}/>
          <SBtn active={panel==='calendar'} label="События" onClick={() => setPanel(p => p==='calendar'?null:'calendar')}
            icon={<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>}
          />
          <SBtn active={panel==='ai'} label="AI Модель" onClick={() => setPanel(p => p==='ai'?null:'ai')}
            icon={<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
          />
          {onOpenAiChat && (
            <SBtn label="AI Чат" onClick={onOpenAiChat}
              icon={<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
          <SBtn label="Настройки" active={panel==='settings'} onClick={() => setPanel(p => p==='settings'?null:'settings')}
            icon={<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
          />
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{
          height: 52, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
          background: 'rgba(255,255,255,0.95)',
          borderBottom: '1px solid #e2e8f0', flexShrink: 0, position: 'relative', zIndex: 10
        }}>
          {[
            { title:'Назад', icon:<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>},
            { title:'Вперёд', icon:<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>},
            { title:'Обновить', icon:<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>},
            { title:'Домой', icon:<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>},
          ].map(({title, icon}) => (
            <button key={title} title={title} style={{
              width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#94a3b8', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0
            }}
              onMouseEnter={e=>{e.currentTarget.style.background='#f1f5f9';e.currentTarget.style.color='#1e293b';}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#94a3b8';}}
              onClick={title==='Домой'?()=>onNavigate('intra://home'):undefined}
            >{icon}</button>
          ))}

          {/* Address bar */}
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
              <svg width="12" height="12" fill="#22c55e" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
            </div>
            <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={handleSearch}
              placeholder="Поиск или введите URL..."
              style={{
                width: '100%', height: 34, paddingLeft: 30, paddingRight: 8,
                borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc',
                fontSize: 13, color: '#1e293b', outline: 'none', transition: 'all 0.2s', boxSizing: 'border-box'
              }}
              onFocus={e=>{setSearchFocused(true);e.target.style.borderColor='#3b82f6';e.target.style.boxShadow='0 0 0 3px rgba(59,130,246,0.1)';e.target.style.background='white';}}
              onBlur={e=>{e.target.style.borderColor='#e2e8f0';e.target.style.boxShadow='none';e.target.style.background='#f8fafc';setTimeout(()=>{setSearchFocused(false);setSuggestions([]);},150);}}
            />
            {suggestionDropdown}
          </div>

          {/* Network modes */}
          <div style={{ display: 'flex', gap: 1, background: '#f1f5f9', borderRadius: 7, padding: 2, border: '1px solid #e2e8f0', flexShrink: 0 }}>
            {[['internet','Интернет'],['smart','Smart'],['intranet','Интрасеть']].map(([id,lbl]) => (
              <button key={id} onClick={() => { setNetworkMode(id); if (id==='intranet') onToggleIntranetOnly?.(true); else if(id==='internet') onToggleIntranetOnly?.(false); }}
                style={{
                  padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
                  background: networkMode===id ? '#2563eb' : 'transparent',
                  color: networkMode===id ? 'white' : '#64748b',
                  boxShadow: networkMode===id ? '0 1px 6px rgba(37,99,235,0.3)' : 'none'
                }}>{lbl}</button>
            ))}
          </div>

          {/* Колокольчик уведомлений — z-index решён через position: fixed на дропдауне */}
          <div ref={notifBtnRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: showNotifications ? '#eff6ff' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: showNotifications ? '#2563eb' : '#94a3b8', cursor: 'pointer', transition: 'all 0.15s', position: 'relative'
            }}
              onMouseEnter={e=>{e.currentTarget.style.background='#eff6ff';e.currentTarget.style.color='#2563eb';}}
              onMouseLeave={e=>{ if(!showNotifications){e.currentTarget.style.background='transparent';e.currentTarget.style.color='#94a3b8';} }}
              onClick={() => setShowNotifications(v => !v)}
            >
              <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
              {totalNotifCount > 0 && (
                <div style={{ position:'absolute',top:4,right:4,width:8,height:8,borderRadius:'50%',background:'#ef4444',border:'2px solid white' }}/>
              )}
            </button>
            {/* Дропдаун — position: fixed чтобы быть поверх всего контента */}
            {showNotifications && (
              <>
                {/* Backdrop — не перекрываем сайдбар (left:60) */}
                <div style={{ position:'fixed',top:0,left:60,right:0,bottom:0,zIndex:800 }} onClick={() => setShowNotifications(false)}/>
                <div style={{
                  position:'fixed',
                  top: notifBtnRef.current ? notifBtnRef.current.getBoundingClientRect().bottom + 6 : 96,
                  right: 20,
                  width:300,zIndex:801,
                  background:'white',borderRadius:12,boxShadow:'0 8px 30px rgba(0,0,0,0.18)',
                  border:'1px solid #e2e8f0', overflow:'hidden'
                }}>
                  <div style={{ padding:'12px 14px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                    <span style={{ fontSize:13,fontWeight:700,color:'#1e293b' }}>Уведомления</span>
                    {browserNotifications.length > 0 && (
                      <button onClick={()=>{ onClearBrowserNotifications?.(); setShowNotifications(false); }} style={{ fontSize:11,color:'#94a3b8',border:'none',background:'none',cursor:'pointer' }}>Очистить</button>
                    )}
                  </div>
                  <div style={{ maxHeight:320,overflowY:'auto' }}>
                    {totalNotifCount === 0 ? (
                      <div style={{ textAlign:'center',padding:'30px 0',color:'#94a3b8' }}>
                        <div style={{ marginBottom:6,display:'flex',justifyContent:'center' }}><svg width="28" height="28" fill="none" stroke="#93c5fd" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg></div>
                        <div style={{ fontSize:12 }}>Нет новых уведомлений</div>
                      </div>
                    ) : (
                      <>
                        {upcomingEvents.map(ev => (
                          <div key={ev.id} style={{ padding:'10px 14px',borderBottom:'1px solid #f8fafc',display:'flex',gap:10,alignItems:'flex-start',cursor:'pointer' }}
                            onClick={()=>{ setDetailEvent(ev); setShowNotifications(false); }}>
                            <div style={{ width:8,height:8,borderRadius:'50%',background:'#2563eb',flexShrink:0,marginTop:4 }}/>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ fontSize:12,fontWeight:600,color:'#1e293b' }}>{ev.title}</div>
                              <div style={{ fontSize:11,color:'#94a3b8' }}>
                                {ev.date && `${ev.date} `}{ev.time && `${ev.time} `}{ev.subtitle && `· ${ev.subtitle}`}
                              </div>
                            </div>
                          </div>
                        ))}
                        {browserNotifications.slice(0, 10).map((n, i) => (
                          <div key={i} style={{ padding:'10px 14px',borderBottom:'1px solid #f8fafc',display:'flex',gap:10,alignItems:'flex-start' }}>
                            <div style={{ width:8,height:8,borderRadius:'50%',background:'#f97316',flexShrink:0,marginTop:4 }}/>
                            <div style={{ flex:1,minWidth:0 }}>
                              <div style={{ fontSize:12,fontWeight:600,color:'#1e293b' }}>{n.title || 'Уведомление'}</div>
                              {n.body && <div style={{ fontSize:11,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{n.body}</div>}
                              <div style={{ fontSize:10,color:'#cbd5e1' }}>{n.timestamp ? new Date(n.timestamp).toLocaleString('ru',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'}) : ''}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Dashboard */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>

            {/* Header */}
            <div className="fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, animationDelay: '0.05s' }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>Intra Browser</h1>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0', fontWeight: 500 }}>
                  Krasoft Labs <span style={{ color: '#cbd5e1', margin: '0 5px' }}>|</span>
                  <span style={{ fontSize: 11 }}>Powered by Andrew Krasovsky</span>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 300, color: '#64748b' }}>{time}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>{dateStr}</div>
              </div>
            </div>

            {/* Search */}
            <div className="fade-up" style={{ maxWidth: 640, margin: '0 auto 22px', animationDelay: '0.1s', position: 'relative' }}>
              <div style={{ background: 'white', borderRadius: 14, padding: 10, boxShadow: '0 4px 20px rgba(37,99,235,0.07)', border: '1px solid rgba(226,232,240,0.8)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ paddingLeft: 6, color: '#94a3b8', flexShrink: 0 }}>
                    <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  </div>
                  <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={handleSearch}
                    placeholder="Поиск или введите URL... (Enter)"
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, color: '#1e293b', background: 'transparent', padding: '5px 0' }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => { setSearchFocused(false); setSuggestions([]); }, 150)}
                  />
                  <button onClick={() => query.trim() && onNavigate(query.trim())} style={{
                    padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: '#2563eb', color: 'white', fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
                  }}>
                    Найти <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                  </button>
                </div>
              </div>
              {suggestionDropdown}
            </div>

            {/* Main grid */}
            <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16, animationDelay: '0.15s' }}>

              {/* Часто посещаемые */}
              <div style={{ gridColumn: '1/3', background: 'rgba(255,255,255,0.9)', borderRadius: 14, padding: 18, border: '1px solid rgba(226,232,240,0.8)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                    Часто посещаемые
                    {topVisits.length > 0 && <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 11, marginLeft: 6 }}>{topVisits.length} сайтов</span>}
                  </span>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {topVisits.length > 0 && (
                      <button onClick={clearTopVisits}
                        style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                        onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'}
                        onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}
                      >Очистить</button>
                    )}
                    <button onClick={refreshTopVisits} style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>↻</button>
                  </div>
                </div>
                {topVisits.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8' }}>
                    <div style={{ marginBottom:6,display:'flex',justifyContent:'center' }}><svg width="28" height="28" fill="none" stroke="#93c5fd" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg></div>
                    <div style={{ fontSize: 12 }}>Начните просматривать сайты — они появятся здесь</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                    {topVisits.map((site, idx) => (
                      <SCard
                        key={site.url}
                        icon={site.favicon ? <img src={site.favicon} width={24} height={24} style={{ borderRadius: 4 }} onError={e=>e.target.style.display='none'}/> : (site.title?.[0]?.toUpperCase() || <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7"/></svg>)}
                        label={site.title ? (site.title.length > 12 ? site.title.slice(0,12)+'…' : site.title) : safeHostname(site.url)}
                        color={VISIT_COLORS[idx % VISIT_COLORS.length]}
                        bg={VISIT_BGS[idx % VISIT_BGS.length]}
                        onClick={() => onNavigate(site.url)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* AI панель */}
              {widgets.ai !== false && (
                <div style={{ background: 'linear-gradient(to bottom right,white,#f0f9ff)', borderRadius: 14, border: '1px solid #dbeafe', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ padding: 5, borderRadius: 7, background: '#dbeafe' }}>
                        <svg width="13" height="13" stroke="#2563eb" fill="none" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Локальная AI</div>
                        <div style={{ fontSize: 10, color: aiLoaded ? '#22c55e' : '#94a3b8' }}>
                          {aiLoaded ? aiModel?.name : 'Модель не загружена'}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setPanel('ai')} style={{ padding: '4px 10px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                      Настройка
                    </button>
                  </div>
                  {/* Loading progress bar or context usage bar */}
                  {aiLoading && !aiLoaded && aiLoadProgress !== null ? (
                    <div style={{ padding: '4px 14px 7px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 9, color: '#2563eb', fontWeight: 600 }}>Загрузка модели...</span>
                        <span style={{ fontSize: 9, color: '#2563eb', fontWeight: 600 }}>{aiLoadProgress}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: '#dbeafe', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${aiLoadProgress}%`, background: '#2563eb', borderRadius: 2, transition: 'width 0.4s ease' }}/>
                      </div>
                    </div>
                  ) : aiLoaded ? (
                    <div style={{ padding: '4px 14px 6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 9, color: '#94a3b8' }}>Контекст</span>
                        <span style={{ fontSize: 9, color: contextUsedPct > 85 ? '#ef4444' : '#94a3b8', fontWeight: contextUsedPct > 85 ? 700 : 400 }}>{contextUsedPct}%</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${contextUsedPct}%`, background: contextUsedPct > 85 ? '#ef4444' : contextUsedPct > 60 ? '#f59e0b' : '#22c55e', borderRadius: 2, transition: 'width 0.3s' }}/>
                      </div>
                      {contextUsedPct > 85 && <div style={{ fontSize: 9, color: '#ef4444', marginTop: 2 }}>Контекст почти заполнен</div>}
                    </div>
                  ) : null}
                  <div style={{ flex: 1, padding: 10, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, minHeight: 80, maxHeight: 140 }}>
                    {aiChat.length === 0 && !aiLoading ? (
                      <div style={{ background: '#f8fafc', borderRadius: 9, padding: 10, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                        {aiLoaded ? 'Задайте вопрос...' : 'Загрузите модель GGUF для работы.'}
                      </div>
                    ) : (
                      <>
                        {aiChat.map((msg,i) => (
                          <div key={i} style={{ padding:'6px 8px',borderRadius:8,fontSize:11,lineHeight:1.5,whiteSpace:'pre-wrap',
                            background:msg.role==='user'?'#eff6ff':'#f8fafc',color:msg.role==='user'?'#1e40af':'#374151',
                            alignSelf:msg.role==='user'?'flex-end':'flex-start',maxWidth:'90%' }}>{msg.text}</div>
                        ))}
                        {aiLoading && !aiChat.some(m=>m.streaming) && <div style={{ fontSize:11,color:'#94a3b8',fontStyle:'italic' }}>Генерация...</div>}
                      </>
                    )}
                  </div>
                  {/* Response status bar */}
                  {aiLoading && aiLoaded && (
                    <div style={{ padding: '4px 14px 5px', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontSize: 9, color: '#64748b' }}>
                          {aiStreamedTokens === 0 ? 'Ожидание ответа...' : `Генерация... ${aiStreamedTokens} токенов`}
                        </span>
                        {aiStreamedTokens > 0 && <span style={{ fontSize: 9, color: '#2563eb', fontWeight: 600 }}>{Math.min(Math.round(aiStreamedTokens / 10.24), 95)}%</span>}
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden', position: 'relative' }}>
                        {aiStreamedTokens === 0
                          ? <div className="ai-indeterminate" style={{ position: 'absolute', top: 0, height: '100%', width: '30%', borderRadius: 2, background: '#2563eb' }}/>
                          : <div style={{ height: '100%', width: `${Math.min(aiStreamedTokens / 10.24, 95)}%`, background: '#2563eb', borderRadius: 2, transition: 'width 0.15s' }}/>
                        }
                      </div>
                    </div>
                  )}
                  <div style={{ padding: '7px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 5, alignItems: 'center' }}>
                    <input value={aiInput} onChange={e=>setAiInput(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey) sendAiMessage(); }}
                      placeholder={aiLoaded ? 'Введите сообщение...' : 'Загрузите модель...'}
                      disabled={!aiLoaded || aiLoading}
                      style={{ flex:1,padding:'5px 9px',borderRadius:7,border:'1px solid #e2e8f0',fontSize:11,color:'#1e293b',background:'white',outline:'none' }}
                    />
                    <button onClick={sendAiMessage} disabled={!aiLoaded||!aiInput.trim()||aiLoading} style={{ width:28,height:28,borderRadius:6,border:'none',background:aiLoaded&&aiInput.trim()&&!aiLoading?'#2563eb':'#e2e8f0',display:'flex',alignItems:'center',justifyContent:'center',cursor:aiLoaded&&aiInput.trim()&&!aiLoading?'pointer':'not-allowed', flexShrink:0 }}>
                      <svg width="11" height="11" fill="none" stroke={aiInput.trim()&&!aiLoading?'white':'#94a3b8'} viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    </button>
                    {lastBotMsg && (
                      <button title="Скопировать ответ" onClick={() => navigator.clipboard.writeText(lastBotMsg.text)} style={{ width:28,height:28,borderRadius:6,border:'none',background:'#f1f5f9',color:'#64748b',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}>
                        <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                      </button>
                    )}
                    {aiChat.length > 0 && (
                      <button title="Очистить чат" onClick={() => { setAiChat([]); window.electronAPI?.aiClearHistory?.(); }} style={{ width:28,height:28,borderRadius:6,border:'none',background:'#f1f5f9',color:'#64748b',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}>
                        <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                      </button>
                    )}
                    {aiLoaded && (
                      <button title="Выгрузить модель" onClick={async () => { await window.electronAPI.aiUnloadModel(); setAiModel(null); setAiLoaded(false); setAiChat([]); setAiLoadProgress(null); localStorage.removeItem('intra-ai-model'); }} style={{ width:28,height:28,borderRadius:6,border:'none',background:'#fff0f0',color:'#ef4444',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}>
                        <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom grid */}
            <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, animationDelay: '0.2s' }}>

              {/* Недавние вкладки (открытые сейчас) */}
              {widgets.tabs !== false && (
                <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 14, padding: 16, border: '1px solid rgba(226,232,240,0.8)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Открытые вкладки</span>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {recentTabs.length > 0 && (
                        <button onClick={() => recentTabs.forEach(t=>onCloseTab(t.id))} style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                          onMouseEnter={e=>e.currentTarget.style.color='#ef4444'} onMouseLeave={e=>e.currentTarget.style.color='#64748b'}
                        >Закрыть все</button>
                      )}
                    </div>
                  </div>
                  {recentTabs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 12 }}>
                      <div style={{ marginBottom:6,display:'flex',justifyContent:'center' }}><svg width="28" height="28" fill="none" stroke="#93c5fd" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path strokeLinecap="round" d="M8 21h8M12 17v4"/></svg></div>
                      Нет открытых вкладок
                    </div>
                  ) : (
                    recentTabs.map(tab => (
                      <TRow key={tab.id} favicon={tab.favicon} title={tab.title} url={tab.url}
                        onOpen={() => { onSwitchTab(tab.id); }}
                        onClose={() => onCloseTab(tab.id)}
                      />
                    ))
                  )}
                </div>
              )}

              {/* События */}
              {widgets.events !== false && (
                <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 14, padding: 16, border: '1px solid rgba(226,232,240,0.8)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Запланированные события</span>
                    <button onClick={() => setShowAddEvent(true)} style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Добавить</button>
                  </div>
                  {showAddEvent && (
                    <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 10, border: '1px solid #e2e8f0' }}>
                      <input value={newEvent.title} onChange={e=>setNewEvent(v=>({...v,title:e.target.value}))}
                        placeholder="Название события *" style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', marginBottom: 6, boxSizing: 'border-box' }}/>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <input type="date" value={newEvent.date} onChange={e=>setNewEvent(v=>({...v,date:e.target.value}))}
                          style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none' }}/>
                        <input type="time" value={newEvent.time} onChange={e=>setNewEvent(v=>({...v,time:e.target.value}))}
                          style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none' }}/>
                      </div>
                      <input value={newEvent.subtitle} onChange={e=>setNewEvent(v=>({...v,subtitle:e.target.value}))}
                        placeholder="Описание (необязательно)" style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', marginBottom: 6, boxSizing: 'border-box' }}/>
                      <input value={newEvent.url} onChange={e=>setNewEvent(v=>({...v,url:e.target.value}))}
                        placeholder="Ссылка для перехода (необязательно)" style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}/>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => {
                          if (newEvent.title.trim()) {
                            setEvents(v => [...v, { ...newEvent, id: Date.now() }]);
                            setNewEvent({ title: '', date: '', time: '', subtitle: '', url: '' });
                            setShowAddEvent(false);
                          }
                        }} style={{ flex: 1, padding: '6px 0', background: '#2563eb', color: 'white', border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Сохранить</button>
                        <button onClick={() => setShowAddEvent(false)} style={{ flex: 1, padding: '6px 0', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>Отмена</button>
                      </div>
                    </div>
                  )}
                  {events.length === 0 && !showAddEvent && (
                    <div style={{ textAlign: 'center', padding: '18px 0', color: '#94a3b8' }}>
                      <div style={{ marginBottom:5,display:'flex',justifyContent:'center' }}><svg width="24" height="24" fill="none" stroke="#93c5fd" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg></div>
                      <div style={{ fontSize: 12 }}>Нет событий. Нажмите + Добавить</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {events.slice(0, 3).map(ev => (
                      <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: '1px solid #f1f5f9', background: 'white', cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor='#bfdbfe'}
                        onMouseLeave={e=>e.currentTarget.style.borderColor='#f1f5f9'}
                        onClick={() => setDetailEvent(ev)}>
                        <div style={{ flexShrink: 0, width: 36, textAlign: 'center' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb' }}>{ev.time || '—'}</div>
                          <div style={{ fontSize: 9, color: '#94a3b8' }}>{ev.date || ''}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                          {ev.subtitle && <div style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.subtitle}</div>}
                        </div>
                        <button onClick={e=>{e.stopPropagation(); setDetailEvent(ev);}} style={{ fontSize: 10, padding: '3px 8px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>Детали</button>
                        <button onClick={e=>{e.stopPropagation(); setEvents(v=>v.filter(x=>x.id!==ev.id));}} style={{ width:18,height:18,borderRadius:4,border:'none',background:'#fee2e2',color:'#ef4444',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center' }}><svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                      </div>
                    ))}
                    {events.length > 3 && (
                      <button onClick={() => setPanel('calendar')} style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', padding: '4px 0' }}>
                        Ещё {events.length - 3} событий...
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="fade-up" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', animationDelay: '0.25s' }}>
              <button onClick={() => onNewPrivateTab && onNewPrivateTab()} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
                border: 'none', background: '#0f172a', cursor: 'pointer', color: 'white',
                fontSize: 12, fontWeight: 500, boxShadow: '0 4px 14px rgba(0,0,0,0.2)', transition: 'all 0.2s'
              }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none';}}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                Новая приватная вкладка
              </button>
              <button onClick={() => setShowWidgetManager(true)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
                border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#475569',
                fontSize: 12, fontWeight: 500, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.2s'
              }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none';}}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                Виджеты
              </button>
              <button onClick={() => setShowNote(v => !v)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
                border: `1px solid ${showNote ? '#bfdbfe' : '#e2e8f0'}`,
                background: showNote ? '#eff6ff' : 'white', cursor: 'pointer',
                color: showNote ? '#2563eb' : '#475569',
                fontSize: 12, fontWeight: 500, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.2s'
              }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none';}}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                Быстрая заметка
              </button>
              <button onClick={() => { setHistoryItems(getHistory(50)); setPanel('history'); }} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10,
                border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#475569',
                fontSize: 12, fontWeight: 500, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.2s'
              }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none';}}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                История
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Быстрая заметка ── */}
      {showNote && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, width: 320, zIndex: 800,
          background: 'white', borderRadius: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', display:'flex', alignItems:'center', gap:6 }}><svg width="13" height="13" fill="none" stroke="#2563eb" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Быстрая заметка</span>
            <button onClick={() => setShowNote(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', display:'flex', alignItems:'center', padding:2 }}><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
          </div>
          <textarea
            value={noteText}
            onChange={e => { setNoteText(e.target.value); localStorage.setItem('intra-note', e.target.value); }}
            placeholder="Введите заметку..."
            autoFocus
            style={{ padding: '12px 14px', border: 'none', resize: 'none', outline: 'none', fontSize: 13, color: '#1e293b', lineHeight: 1.7, minHeight: 160, fontFamily: 'inherit', background: 'white' }}
          />
          <div style={{ padding: '6px 14px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>Автосохранение</span>
            <button onClick={() => { setNoteText(''); localStorage.removeItem('intra-note'); }} style={{ fontSize: 11, color: '#94a3b8', border: 'none', background: 'none', cursor: 'pointer' }}>Очистить</button>
          </div>
        </div>
      )}

      {/* ── Менеджер виджетов ── */}
      {showWidgetManager && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowWidgetManager(false)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Управление виджетами</h3>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#94a3b8' }}>Выберите блоки для отображения на главной странице</p>
            {[
              { id: 'ai', label: 'Локальная AI', desc: 'Чат с языковой моделью' },
              { id: 'tabs', label: 'Открытые вкладки', desc: 'Быстрый доступ к активным вкладкам' },
              { id: 'events', label: 'Запланированные события', desc: 'Календарь и напоминания' },
            ].map(w => (
              <label key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                <input type="checkbox" checked={widgets[w.id] !== false}
                  onChange={e => updateWidgets({...widgets, [w.id]: e.target.checked})}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#2563eb' }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{w.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{w.desc}</div>
                </div>
              </label>
            ))}
            <button onClick={() => setShowWidgetManager(false)} style={{ marginTop: 20, width: '100%', padding: '10px 0', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Применить</button>
          </div>
        </div>
      )}

      {/* ── PANELS ── */}

      {panel === 'bookmarks' && (
        <Panel title="Закладки" onClose={() => setPanel(null)}>
          <button onClick={() => setShowAddBm(true)} style={{ width: '100%', padding: '7px 0', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>+ Добавить закладку</button>
          {showAddBm && (
            <div style={{ background: '#f8fafc', borderRadius: 9, padding: 10, marginBottom: 12, border: '1px solid #e2e8f0' }}>
              <input value={newBm.title} onChange={e=>setNewBm(v=>({...v,title:e.target.value}))} placeholder="Название"
                style={{ width:'100%',padding:'5px 8px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:12,outline:'none',marginBottom:5,boxSizing:'border-box' }}/>
              <input value={newBm.url} onChange={e=>setNewBm(v=>({...v,url:e.target.value}))} placeholder="URL (https://...)"
                style={{ width:'100%',padding:'5px 8px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:12,outline:'none',marginBottom:7,boxSizing:'border-box' }}/>
              <div style={{ display:'flex',gap:6 }}>
                <button onClick={() => {
                  const url = newBm.url.trim();
                  const title = newBm.title.trim() || url;
                  if (url) {
                    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
                    onBookmarksChange(prev => [...prev, { title, url: finalUrl }]);
                    setNewBm({ title:'',url:'' });
                    setShowAddBm(false);
                  }
                }} style={{ flex:1,padding:'5px 0',background:'#2563eb',color:'white',border:'none',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer' }}>Сохранить</button>
                <button onClick={()=>setShowAddBm(false)} style={{ flex:1,padding:'5px 0',background:'#f1f5f9',color:'#64748b',border:'none',borderRadius:7,fontSize:11,cursor:'pointer' }}>Отмена</button>
              </div>
            </div>
          )}
          {bookmarks.length === 0 ? (
            <div style={{ textAlign:'center',padding:'30px 0',color:'#94a3b8' }}>
              <div style={{ marginBottom:8,display:'flex',justifyContent:'center' }}><svg width="32" height="32" fill="none" stroke="#93c5fd" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg></div>
              <div style={{ fontSize:12 }}>Нет закладок. Добавьте первую!</div>
            </div>
          ) : bookmarks.map((bm,i) => (
            <div key={i} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 10px',borderRadius:9,cursor:'pointer',transition:'background 0.15s',marginBottom:3 }}
              onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}
            >
              <div style={{ width:28,height:28,borderRadius:7,background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <svg width="12" height="12" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20"/></svg>
              </div>
              <div style={{ flex:1,minWidth:0 }} onClick={()=>{onNavigate(bm.url);setPanel(null);}}>
                <div style={{ fontSize:13,fontWeight:500,color:'#1e293b' }}>{bm.title}</div>
                <div style={{ fontSize:11,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{bm.url}</div>
              </div>
              <button onClick={()=>onBookmarksChange(prev=>prev.filter((_,j)=>j!==i))} style={{ border:'none',background:'#fee2e2',borderRadius:6,width:24,height:24,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#ef4444',flexShrink:0 }}><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
          ))}
        </Panel>
      )}

      {panel === 'history' && (
        <Panel title="История браузера" onClose={() => setPanel(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{historyItems.length} записей</p>
            {historyItems.length > 0 && (
              <button onClick={() => { clearHistory(); }} style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Очистить историю</button>
            )}
          </div>
          {historyItems.length === 0 ? (
            <div style={{ textAlign:'center',padding:'30px 0',color:'#94a3b8' }}>
              <div style={{ marginBottom:8,display:'flex',justifyContent:'center' }}><svg width="32" height="32" fill="none" stroke="#93c5fd" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3"/></svg></div>
              <div style={{ fontSize:12 }}>История пуста — начните просматривать сайты</div>
            </div>
          ) : historyItems.map((item, i) => (
            <TRow key={i} favicon={item.favicon} title={item.title} url={item.url} time={item.timestamp}
              onOpen={() => { onNavigate(item.url); setPanel(null); }}
            />
          ))}
        </Panel>
      )}

      {panel === 'downloads' && (
        <Panel title="⬇ Загрузки" onClose={() => setPanel(null)}>
          {downloads.length === 0 ? (
            <div style={{ textAlign:'center',padding:'40px 0',color:'#94a3b8' }}>
              <div style={{ marginBottom:10,display:'flex',justifyContent:'center' }}><svg width="36" height="36" fill="none" stroke="#93c5fd" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></div>
              <div style={{ fontSize:13,fontWeight:500,color:'#64748b' }}>Нет загрузок</div>
              <div style={{ fontSize:12,marginTop:4 }}>Скачанные файлы появятся здесь</div>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column' }}>
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
            </div>
          )}
        </Panel>
      )}

      {panel === 'calendar' && (
        <Panel title="Запланированные события" onClose={() => setPanel(null)}>
          <button onClick={() => setShowAddEvent(true)}
            style={{ width:'100%',padding:'8px 0',background:'#2563eb',color:'white',border:'none',borderRadius:9,fontSize:12,fontWeight:700,cursor:'pointer',marginBottom:14 }}>
            + Добавить событие
          </button>
          {showAddEvent && (
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 12, border: '1px solid #e2e8f0' }}>
              <input value={newEvent.title} onChange={e=>setNewEvent(v=>({...v,title:e.target.value}))}
                placeholder="Название события *" style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:12,outline:'none',marginBottom:6,boxSizing:'border-box' }}/>
              <div style={{ display:'flex',gap:6,marginBottom:6 }}>
                <input type="date" value={newEvent.date} onChange={e=>setNewEvent(v=>({...v,date:e.target.value}))}
                  style={{ flex:1,padding:'6px 8px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:12,outline:'none' }}/>
                <input type="time" value={newEvent.time} onChange={e=>setNewEvent(v=>({...v,time:e.target.value}))}
                  style={{ flex:1,padding:'6px 8px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:12,outline:'none' }}/>
              </div>
              <input value={newEvent.subtitle} onChange={e=>setNewEvent(v=>({...v,subtitle:e.target.value}))}
                placeholder="Описание (необязательно)" style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:12,outline:'none',marginBottom:6,boxSizing:'border-box' }}/>
              <input value={newEvent.url} onChange={e=>setNewEvent(v=>({...v,url:e.target.value}))}
                placeholder="Ссылка (https://...)" style={{ width:'100%',padding:'6px 8px',borderRadius:6,border:'1px solid #e2e8f0',fontSize:12,outline:'none',marginBottom:8,boxSizing:'border-box' }}/>
              <div style={{ display:'flex',gap:6 }}>
                <button onClick={() => {
                  if (newEvent.title.trim()) {
                    setEvents(v => [...v, { ...newEvent, id: Date.now() }]);
                    setNewEvent({ title:'',date:'',time:'',subtitle:'',url:'' });
                    setShowAddEvent(false);
                  }
                }} style={{ flex:1,padding:'6px 0',background:'#2563eb',color:'white',border:'none',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer' }}>Сохранить</button>
                <button onClick={() => setShowAddEvent(false)} style={{ flex:1,padding:'6px 0',background:'#f1f5f9',color:'#64748b',border:'none',borderRadius:7,fontSize:11,cursor:'pointer' }}>Отмена</button>
              </div>
            </div>
          )}
          {events.length === 0 && !showAddEvent && <div style={{ textAlign:'center',padding:'20px 0',color:'#94a3b8',fontSize:12 }}>Нет событий</div>}
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {events.map(ev => (
              <div key={ev.id} onClick={() => setDetailEvent(ev)} style={{ display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:10,border:'1px solid #f1f5f9',background:'white',cursor:'pointer',transition:'all 0.15s' }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor='#bfdbfe'; e.currentTarget.style.background='#f0f9ff'; }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor='#f1f5f9'; e.currentTarget.style.background='white'; }}>
                <div style={{ width:44,textAlign:'center',flexShrink:0 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:'#2563eb' }}>{ev.time||'—'}</div>
                  <div style={{ fontSize:9,color:'#94a3b8' }}>{ev.date||''}</div>
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:13,fontWeight:600,color:'#1e293b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{ev.title}</div>
                  {ev.subtitle && <div style={{ fontSize:11,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{ev.subtitle}</div>}
                </div>
                <div style={{ display:'flex',gap:6,flexShrink:0 }}>
                  <button onClick={e=>{e.stopPropagation();setDetailEvent(ev);}} style={{ fontSize:10,padding:'4px 8px',background:'#eff6ff',color:'#2563eb',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600 }}>Детали</button>
                  {ev.url && <button onClick={e=>{e.stopPropagation();onNavigate(ev.url);setPanel(null);}} style={{ fontSize:10,padding:'4px 8px',background:'#2563eb',color:'white',border:'none',borderRadius:6,cursor:'pointer',fontWeight:600 }}>Открыть</button>}
                  <button onClick={e=>{e.stopPropagation();setEvents(v=>v.filter(x=>x.id!==ev.id));}} style={{ border:'none',background:'none',cursor:'pointer',color:'#94a3b8',display:'flex',alignItems:'center',padding:2 }}><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {panel === 'ai' && (
        <Panel title="AI Модель" onClose={() => setPanel(null)}>
          <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
            <div style={{ padding:'12px 14px',borderRadius:10,background:aiLoaded?'#f0fdf4':'#f8fafc',border:`1px solid ${aiLoaded?'#bbf7d0':'#e2e8f0'}` }}>
              <div style={{ fontSize:13,fontWeight:700,color:aiLoaded?'#166534':'#64748b',marginBottom:6 }}>
                {aiLoaded ? aiModel?.name : aiLoading ? 'Загрузка...' : 'Модель не выбрана'}
              </div>
              <div style={{ fontSize:11,color:'#64748b',marginBottom:8,lineHeight:1.5 }}>
                Выберите файл <b>.gguf</b> — модель любого размера загрузится напрямую.
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:6 }}>
                <label style={{ fontSize:10,color:'#94a3b8',whiteSpace:'nowrap' }}>Контекст:</label>
                <select value={aiContextSize} onChange={e => { const v = Number(e.target.value); setAiContextSize(v); localStorage.setItem('intra-ai-context', String(v)); }}
                  style={{ flex:1,fontSize:10,padding:'3px 6px',borderRadius:5,border:'1px solid #e2e8f0',background:'white',cursor:'pointer' }}>
                  <option value={2048}>2 048 токенов</option>
                  <option value={4096}>4 096 (по умолч.)</option>
                  <option value={8192}>8 192 токенов</option>
                  <option value={16384}>16 384 токенов</option>
                  <option value={32768}>32 768 токенов</option>
                </select>
              </div>
              <button onClick={handleLoadModel} disabled={aiLoading} style={{ width:'100%',padding:'7px 0',background:aiLoading?'#e2e8f0':'#2563eb',color:aiLoading?'#94a3b8':'white',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:aiLoading?'not-allowed':'pointer' }}>
                {aiLoading ? 'Загрузка модели...' : aiModel ? 'Сменить модель (.gguf)' : 'Выбрать модель (.gguf)'}
              </button>
            </div>

            {/* Прогресс загрузки или использование контекста */}
            {aiLoading && !aiLoaded && aiLoadProgress !== null ? (
              <div style={{ borderRadius:8,padding:'10px 12px',background:'#eff6ff',border:'1px solid #dbeafe' }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                  <span style={{ fontSize:11,color:'#2563eb',fontWeight:600 }}>Загрузка модели...</span>
                  <span style={{ fontSize:11,color:'#2563eb',fontWeight:700 }}>{aiLoadProgress}%</span>
                </div>
                <div style={{ height:6,borderRadius:3,background:'#dbeafe',overflow:'hidden' }}>
                  <div style={{ height:'100%',width:`${aiLoadProgress}%`,background:'#2563eb',borderRadius:3,transition:'width 0.4s ease' }}/>
                </div>
              </div>
            ) : aiLoaded ? (
              <div style={{ borderRadius:8,padding:'10px 12px',background:'#f8fafc',border:'1px solid #e2e8f0' }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                  <span style={{ fontSize:11,color:'#64748b' }}>Использование контекста</span>
                  <span style={{ fontSize:11,fontWeight:600,color:contextUsedPct>85?'#ef4444':contextUsedPct>60?'#f59e0b':'#64748b' }}>{contextUsedPct}%</span>
                </div>
                <div style={{ height:6,borderRadius:3,background:'#e2e8f0',overflow:'hidden' }}>
                  <div style={{ height:'100%',width:`${contextUsedPct}%`,background:contextUsedPct>85?'#ef4444':contextUsedPct>60?'#f59e0b':'#22c55e',borderRadius:3,transition:'width 0.3s' }}/>
                </div>
                {contextUsedPct>85 && <div style={{ fontSize:10,color:'#ef4444',marginTop:4 }}>Контекст почти заполнен. Очистите чат или выгрузите модель.</div>}
              </div>
            ) : null}

            {/* Чат */}
            <div style={{ display:'flex',flexDirection:'column',gap:6,maxHeight:200,overflowY:'auto' }}>
              {aiChat.map((msg,i) => (
                <div key={i} style={{ padding:'8px 10px',borderRadius:9,fontSize:12,lineHeight:1.5,whiteSpace:'pre-wrap',
                  background:msg.role==='user'?'#eff6ff':'#f8fafc',color:msg.role==='user'?'#1e40af':'#374151',
                  alignSelf:msg.role==='user'?'flex-end':'flex-start',maxWidth:'90%' }}>{msg.text}</div>
              ))}
              {aiLoading && !aiChat.some(m=>m.streaming) && (
                <div style={{ fontSize:12,color:'#94a3b8',fontStyle:'italic',padding:'6px 10px' }}>Генерация ответа...</div>
              )}
            </div>
            {/* Response status bar */}
            {aiLoading && aiLoaded && (
              <div style={{ borderRadius:8, padding:'8px 12px', background:'#f8fafc', border:'1px solid #e2e8f0' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'#64748b' }}>
                    {aiStreamedTokens === 0 ? 'Ожидание ответа...' : `Генерация... ${aiStreamedTokens} токенов`}
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
            <div style={{ display:'flex',gap:7 }}>
              <input value={aiInput} onChange={e=>setAiInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey) sendAiMessage(); }}
                placeholder={aiLoaded ? 'Введите сообщение...' : 'Загрузите модель...'}
                disabled={!aiLoaded || aiLoading}
                style={{ flex:1,padding:'7px 10px',borderRadius:8,border:'1px solid #e2e8f0',fontSize:12,outline:'none' }}
              />
              <button onClick={sendAiMessage} disabled={!aiLoaded||!aiInput.trim()||aiLoading} style={{ width:36,height:36,borderRadius:8,border:'none',background:aiLoaded&&aiInput.trim()&&!aiLoading?'#2563eb':'#e2e8f0',display:'flex',alignItems:'center',justifyContent:'center',cursor:aiLoaded&&aiInput.trim()&&!aiLoading?'pointer':'not-allowed',flexShrink:0 }}>
                <svg width="13" height="13" fill="none" stroke={aiLoaded&&aiInput.trim()&&!aiLoading?'white':'#94a3b8'} viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
              </button>
            </div>
            <div style={{ display:'flex',gap:6,justifyContent:'flex-end' }}>
              {lastBotMsg && (
                <button title="Скопировать ответ" onClick={() => navigator.clipboard.writeText(lastBotMsg.text)} style={{ width:32,height:32,borderRadius:8,border:'none',background:'#f1f5f9',color:'#64748b',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
              )}
              {aiChat.length > 0 && (
                <button title="Очистить чат" onClick={() => { setAiChat([]); window.electronAPI?.aiClearHistory?.(); }} style={{ width:32,height:32,borderRadius:8,border:'none',background:'#f1f5f9',color:'#64748b',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                </button>
              )}
              {aiLoaded && (
                <button title="Выгрузить модель" onClick={async () => { await window.electronAPI.aiUnloadModel(); setAiModel(null); setAiLoaded(false); setAiChat([]); setAiLoadProgress(null); localStorage.removeItem('intra-ai-model'); }} style={{ width:32,height:32,borderRadius:8,border:'none',background:'#fff0f0',color:'#ef4444',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0M12 3v9"/></svg>
                </button>
              )}
            </div>
          </div>
        </Panel>
      )}

      {panel === 'settings' && (
        <Panel title="Настройки" onClose={() => setPanel(null)}>
          <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

            {/* ── Сеть ── */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Сеть</div>
              <div style={{ padding:12, borderRadius:10, background:intranetOnly?'#f0fdf4':'#f8fafc', border:`1px solid ${intranetOnly?'#bbf7d0':'#e2e8f0'}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#1e293b' }}>{intranetOnly?'Только интранет':'Полный доступ'}</span>
                  <div onClick={()=>onToggleIntranetOnly?.()} style={{ width:38, height:22, borderRadius:11, cursor:'pointer', background:intranetOnly?'#2563eb':'#e2e8f0', position:'relative', transition:'background 0.25s' }}>
                    <div style={{ position:'absolute', top:3, left:intranetOnly?18:3, width:16, height:16, borderRadius:'50%', background:'white', transition:'left 0.25s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }}/>
                  </div>
                </div>
                <div style={{ fontSize:11, color:'#64748b' }}>{intranetOnly?'Внешние сайты заблокированы.':'Доступ ко всем ресурсам сети.'}</div>
              </div>
            </div>

            {/* ── Поиск ── */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Поисковая система</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { id:'yandex', label:'Яндекс', abbr:'Я' },
                  { id:'google', label:'Google', abbr:'G' },
                  { id:'duckduckgo', label:'DuckDuckGo', abbr:'D' },
                  { id:'bing', label:'Bing', abbr:'B' },
                ].map(e => (
                  <button key={e.id} onClick={() => onSearchEngineChange?.(e.id)} style={{
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

            {/* ── Новая вкладка ── */}
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
                      width:16, height:16, borderRadius:'50%', flexShrink:0,
                      border:`2px solid ${newTabMode===opt.id ? '#2563eb' : '#cbd5e1'}`,
                      background: newTabMode===opt.id ? '#2563eb' : 'white',
                      display:'flex', alignItems:'center', justifyContent:'center'
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

            {/* ── Приватность ── */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Приватность и данные</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <button onClick={() => { localStorage.removeItem('intra-history'); localStorage.removeItem('intra-visits'); setHistoryItems([]); }} style={{
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
                  setHistoryItems([]);
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
        </Panel>
      )}

      {/* ── Детали события ── */}
      {detailEvent && (
        <EventDetailModal
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          onDelete={(id) => setEvents(v => v.filter(e => e.id !== id))}
          onNavigate={onNavigate}
          onSave={(updated) => setEvents(v => v.map(e => e.id === updated.id ? updated : e))}
        />
      )}
    </div>
  );
}
