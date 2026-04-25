import React from 'react';
import NavBtn from './NavBtn';

export default function FindBar({
  inputRef, query, result, caseSensitive,
  onQueryChange, onNext, onPrev, onClose, onToggleCase,
}) {
  const noResult = result && result.total === 0 && query;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      height: 38, padding: '0 10px',
      background: 'white', borderBottom: '1px solid #e2e8f0',
      flexShrink: 0, animation: 'fadeIn 0.12s ease',
    }}>
      <input
        ref={inputRef}
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onNext(!e.shiftKey ? true : false);
          if (e.key === 'F3') onNext(true);
          if (e.key === 'Escape') onClose();
        }}
        placeholder="Найти на странице..."
        style={{
          width: 200, height: 28, padding: '0 10px', fontSize: 13,
          border: `1px solid ${noResult ? '#fca5a5' : '#cbd5e1'}`,
          borderRadius: 7, outline: 'none',
          background: noResult ? '#fff5f5' : '#f8fafc',
          color: '#1e293b', transition: 'border-color 0.15s, background 0.15s',
        }}
      />

      {/* Учёт регистра */}
      <button
        onClick={onToggleCase}
        title={caseSensitive ? 'Без учёта регистра' : 'С учётом регистра'}
        style={{
          width: 28, height: 28, borderRadius: 6, border: 'none',
          background: caseSensitive ? '#eff6ff' : 'transparent',
          color: caseSensitive ? '#2563eb' : '#94a3b8',
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'system-ui', transition: 'background 0.15s, color 0.15s',
        }}
      >Aa</button>

      {/* Счётчик совпадений */}
      {query && result && (
        <span style={{
          fontSize: 11, whiteSpace: 'nowrap',
          color: result.total === 0 ? '#ef4444' : '#64748b',
          fontWeight: result.total === 0 ? 600 : 400,
          minWidth: 60,
        }}>
          {result.total === 0 ? 'Не найдено' : `${result.active} из ${result.total}`}
        </span>
      )}

      {query && (
        <>
          <NavBtn onClick={() => onNext(false)} title="Предыдущее (Shift+Enter)">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path d="M18 15l-6-6-6 6"/>
            </svg>
          </NavBtn>
          <NavBtn onClick={() => onNext(true)} title="Следующее (Enter)">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </NavBtn>
        </>
      )}

      <NavBtn onClick={onClose} title="Закрыть (Esc)">
        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </NavBtn>
    </div>
  );
}
