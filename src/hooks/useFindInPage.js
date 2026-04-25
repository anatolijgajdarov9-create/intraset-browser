import { useState, useCallback, useEffect, useRef } from 'react';

export function useFindInPage(isElectron, activeTabId) {
  const [findBarOpen, setFindBarOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findResult, setFindResult] = useState(null);
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  const findInputRef = useRef(null);

  // IPC: результаты поиска
  useEffect(() => {
    if (!isElectron) return;
    const off = window.electronAPI.onFindResult?.((data) => {
      if (data.tabId === activeTabId) {
        setFindResult({ active: data.activeMatchOrdinal, total: data.matches });
      }
    }) ?? (() => {});
    return off;
  }, [activeTabId, isElectron]);

  const handleFindNext = useCallback((forward = true) => {
    if (!isElectron || !findQuery.trim()) return;
    window.electronAPI.findInPage(activeTabId, findQuery, { forward, findNext: true });
  }, [activeTabId, findQuery, isElectron]);

  const closeFindBar = useCallback(() => {
    setFindBarOpen(false);
    setFindQuery('');
    setFindResult(null);
    if (isElectron) window.electronAPI.stopFind(activeTabId, 'clearSelection');
  }, [activeTabId, isElectron]);

  const handleFindChange = useCallback((text) => {
    setFindQuery(text);
    setFindResult(null);
    if (!isElectron) return;
    if (text.trim()) {
      window.electronAPI.findInPage(activeTabId, text, { forward: true, findNext: false, matchCase: findCaseSensitive });
    } else {
      window.electronAPI.stopFind(activeTabId, 'clearSelection');
    }
  }, [activeTabId, findCaseSensitive, isElectron]);

  const toggleFindCaseSensitive = useCallback(() => {
    setFindCaseSensitive(v => {
      const next = !v;
      if (findQuery.trim() && isElectron) {
        window.electronAPI.findInPage(activeTabId, findQuery, { forward: true, findNext: false, matchCase: next });
      }
      return next;
    });
  }, [activeTabId, findQuery, isElectron]);

  return {
    findBarOpen, setFindBarOpen,
    findQuery, findResult, findCaseSensitive,
    findInputRef,
    handleFindNext, closeFindBar, handleFindChange, toggleFindCaseSensitive,
  };
}
