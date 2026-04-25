import React, { useState } from 'react';

export default function NavBtn({ onClick, disabled, active, title, children }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 30, height: 30, borderRadius: 6, flexShrink: 0,
        border: active ? '1px solid #dbeafe' : '1px solid transparent',
        background: active ? '#eff6ff' : hov ? '#f8fafc' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        color: active ? '#2563eb' : disabled ? '#cbd5e1' : hov ? '#1e293b' : '#64748b',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}
