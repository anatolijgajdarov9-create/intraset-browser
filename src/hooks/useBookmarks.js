import { useState, useCallback } from 'react';

export function useBookmarks() {
  const [bookmarks, setBookmarksState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('intra-bookmarks') || '[]'); } catch { return []; }
  });

  const setBookmarks = useCallback((updater) => {
    setBookmarksState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem('intra-bookmarks', JSON.stringify(next));
      return next;
    });
  }, []);

  return { bookmarks, setBookmarks };
}
