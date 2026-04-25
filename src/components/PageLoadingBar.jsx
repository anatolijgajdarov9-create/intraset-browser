import React, { useEffect, useRef, useState } from 'react';

export default function PageLoadingBar({ loading }) {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const timers = useRef([]);

  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const after = (ms, fn) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  };

  useEffect(() => {
    clearAll();
    if (loading) {
      setFading(false);
      setVisible(true);
      setWidth(0);
      after(60,   () => setWidth(18));
      after(1400, () => setWidth(48));
      after(4000, () => setWidth(72));
      after(7500, () => setWidth(86));
    } else {
      setWidth(100);
      after(180, () => {
        setFading(true);
        after(320, () => { setVisible(false); setWidth(0); setFading(false); });
      });
    }
    return clearAll;
  }, [loading]);

  if (!visible) return null;

  return (
    <div style={{ height: 3, background: 'transparent', flexShrink: 0, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${width}%`,
        background: 'linear-gradient(90deg, #2563eb 0%, #60a5fa 60%, #a5f3fc 100%)',
        borderRadius: 2,
        transition: fading ? 'opacity 0.32s' : width === 100 ? 'width 0.22s ease' : 'width 0.9s ease',
        transitionProperty: fading ? 'opacity' : 'width',
        opacity: fading ? 0 : 1,
        boxShadow: '0 0 8px rgba(37,99,235,0.5)',
      }} />
    </div>
  );
}
