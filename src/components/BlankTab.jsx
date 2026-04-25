import React, { useRef, useEffect, useState } from 'react';

export default function BlankTab({ onNavigate }) {
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => { setTimeout(() => ref.current?.focus(), 80); }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', background: 'white', gap: 20,
      animation: 'fadeUp 0.25s ease',
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', letterSpacing: '-0.03em' }}>
        Intraset
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: 440, height: 44,
        background: '#f8fafc', border: '1.5px solid #e2e8f0',
        borderRadius: 12, padding: '0 14px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}>
        <svg width="15" height="15" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          ref={ref}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && q.trim()) onNavigate(q.trim()); }}
          placeholder="Введите адрес или поисковый запрос..."
          style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: 14, color: '#1e293b' }}
        />
        {q && (
          <button
            onClick={() => onNavigate(q.trim())}
            style={{
              padding: '4px 12px', borderRadius: 7, border: 'none',
              background: '#2563eb', color: 'white', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s',
            }}
          >Перейти</button>
        )}
      </div>
    </div>
  );
}
