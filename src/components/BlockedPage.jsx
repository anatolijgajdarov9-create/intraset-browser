import React from 'react';

export default function BlockedPage({ url, onGoHome, onDisableBlock }) {
  const hostname = (() => { try { return new URL(url).hostname; } catch { return url; } })();

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: 40,
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(255,170,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,170,0,0.03) 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />

      {/* Error code */}
      <div style={{
        fontSize: 120, fontWeight: 800, lineHeight: 1,
        background: 'linear-gradient(135deg, rgba(255,170,0,0.15), rgba(255,68,102,0.15))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        marginBottom: 8, letterSpacing: '-0.05em',
        filter: 'drop-shadow(0 0 40px rgba(255,170,0,0.2))'
      }}>504</div>

      {/* Icon */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}><svg width="48" height="48" fill="none" stroke="#2563eb" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg></div>

      <div style={{
        fontSize: 22, fontWeight: 700, color: 'var(--text-primary)',
        marginBottom: 10, textAlign: 'center'
      }}>Доступ заблокирован</div>

      <div style={{
        fontSize: 14, color: 'var(--text-secondary)',
        marginBottom: 6, textAlign: 'center', maxWidth: 480
      }}>
        Включён режим <strong style={{ color: 'var(--status-warn)' }}>«Только интранет»</strong>.
        Переход на внешние сайты запрещён.
      </div>

      {/* Blocked URL */}
      <div style={{
        margin: '16px 0 32px', padding: '8px 20px',
        background: 'rgba(255,68,102,0.08)', border: '1px solid rgba(255,68,102,0.2)',
        borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 13,
        color: 'var(--status-err)', maxWidth: 560, wordBreak: 'break-all',
        textAlign: 'center'
      }}>
        {url}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onGoHome} style={{
          padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border-normal)',
          background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
          cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: 600,
          transition: 'all 0.15s'
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
        >
          На главную
        </button>
        <button onClick={onDisableBlock} style={{
          padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,170,0,0.4)',
          background: 'rgba(255,170,0,0.1)', color: 'var(--status-warn)',
          cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-ui)', fontWeight: 600,
          transition: 'all 0.15s'
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,170,0,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,170,0,0.1)'}
        >
          Отключить ограничение
        </button>
      </div>

      <div style={{
        marginTop: 32, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center'
      }}>
        Режим сети можно изменить в <span style={{ color: 'var(--text-accent)' }}>Настройки → Режим сети</span>
      </div>
    </div>
  );
}