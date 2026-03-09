import React from 'react';

export default function BookmarksBar({ bookmarks, onNavigate }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', height: 32, padding: '0 12px', gap: 2,
      backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', flexShrink: 0, overflow: 'hidden'
    }}>
      <span style={{ color: '#cbd5e1', fontSize: 11, marginRight: 4, flexShrink: 0 }}>★</span>
      {bookmarks.map((bm, i) => (
        <BookmarkItem key={i} bookmark={bm} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function BookmarkItem({ bookmark, onNavigate }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={() => onNavigate(bookmark.url)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, height: 24, padding: '0 8px',
        background: hov ? '#f1f5f9' : 'none', border: 'none', cursor: 'pointer',
        borderRadius: 5, color: hov ? '#2563eb' : '#475569', fontSize: 12,
        fontFamily: "'Inter','Manrope',system-ui,sans-serif",
        transition: 'all 0.15s', whiteSpace: 'nowrap', flexShrink: 0
      }}
    >{bookmark.title}</button>
  );
}