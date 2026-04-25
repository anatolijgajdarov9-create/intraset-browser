import { useState, useCallback, useRef } from 'react';

export function useFullscreen(isElectron) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerHideTimer = useRef(null);

  // Исправлен баг stale closure: используем функциональный updater
  const handleToggleFullScreen = useCallback(() => {
    if (!isElectron) return;
    window.electronAPI.toggleFullScreen?.();
    setIsFullScreen(prev => {
      const next = !prev;
      // next=true → входим в полноэкранный режим → скрываем шапку
      // next=false → выходим → показываем шапку
      setHeaderVisible(!next);
      return next;
    });
  }, [isElectron]);

  const handleMouseMove = useCallback((e) => {
    if (!isFullScreen) return;
    if (e.clientY < 84) {
      setHeaderVisible(true);
      clearTimeout(headerHideTimer.current);
      headerHideTimer.current = setTimeout(() => setHeaderVisible(false), 2500);
    }
  }, [isFullScreen]);

  return { isFullScreen, headerVisible, handleMouseMove, handleToggleFullScreen };
}
