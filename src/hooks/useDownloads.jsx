import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const POLL_INTERVAL = 1500;

const DownloadsContext = createContext(null);

export function DownloadsProvider({ children }) {
  const [downloads, setDownloads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const speedCache = useRef(new Map());
  const lastUpdateRef = useRef(new Map());
  const isInitialized = useRef(false);

  const isElectron = typeof window !== 'undefined' && window.electronAPI;

  const fetchDownloads = useCallback(async () => {
    if (!isElectron) return;

    try {
      const res = await window.electronAPI.getDownloads();
      if (res?.success) {
        const newDownloads = res.downloads || [];

        const now = Date.now();
        newDownloads.forEach(dl => {
          if (dl.state === 'progressing') {
            const last = lastUpdateRef.current.get(dl.id);
            if (last && dl.totalBytes > 0) {
              const deltaTime = (now - last.time) / 1000;
              const deltaBytes = dl.receivedBytes - last.received;
              if (deltaTime > 0 && deltaBytes > 0) {
                speedCache.current.set(dl.id, deltaBytes / deltaTime);
              }
            }
            lastUpdateRef.current.set(dl.id, {
              time: now,
              received: dl.receivedBytes
            });
          } else {
            lastUpdateRef.current.delete(dl.id);
          }
        });

        setDownloads(newDownloads);
        if (!isInitialized.current) {
          setIsLoading(false);
          isInitialized.current = true;
        }
      }
    } catch (e) {
      console.error('[DownloadsContext] fetch error:', e);
    }
  }, [isElectron]);

  const removeDownload = useCallback((downloadId) => {
    setDownloads(prev => prev.filter(d => d.id !== downloadId));
    speedCache.current.delete(downloadId);
    lastUpdateRef.current.delete(downloadId);
    if (isElectron) {
      window.electronAPI.removeDownload(downloadId);
    }
  }, [isElectron]);

  const clearDownloads = useCallback(() => {
    setDownloads([]);
    speedCache.current.clear();
    lastUpdateRef.current.clear();
    if (isElectron) {
      window.electronAPI.clearDownloads();
    }
  }, [isElectron]);

  const cancelDownload = useCallback((downloadId) => {
    if (isElectron && window.electronAPI.cancelDownload) {
      window.electronAPI.cancelDownload(downloadId);
    }
    removeDownload(downloadId);
  }, [isElectron, removeDownload]);

  const getDownloadSpeed = useCallback((downloadId) => {
    return speedCache.current.get(downloadId) || 0;
  }, []);

  useEffect(() => {
    if (!isElectron) return;

    fetchDownloads();

    const pollInterval = setInterval(fetchDownloads, POLL_INTERVAL);

    return () => {
      clearInterval(pollInterval);
    };
  }, [isElectron, fetchDownloads]);

  const activeDownloads = downloads.filter(d => d.state === 'progressing');
  const completedDownloads = downloads.filter(d => d.state === 'completed');
  const errorDownloads = downloads.filter(d => ['interrupted', 'cancelled'].includes(d.state));

  const value = {
    downloads,
    activeDownloads,
    completedDownloads,
    errorDownloads,
    isLoading,
    removeDownload,
    clearDownloads,
    cancelDownload,
    getDownloadSpeed,
    totalCount: downloads.length,
    activeCount: activeDownloads.length
  };

  return (
    <DownloadsContext.Provider value={value}>
      {children}
    </DownloadsContext.Provider>
  );
}

export function useDownloads() {
  const context = useContext(DownloadsContext);
  if (!context) {
    console.warn('[useDownloads] Not inside DownloadsProvider, creating standalone state');
    const [downloads, setDownloads] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const speedCache = useRef(new Map());
    const lastUpdateRef = useRef(new Map());
    const isElectron = typeof window !== 'undefined' && window.electronAPI;

    useEffect(() => {
      if (!isElectron) return;
      const fetch = async () => {
        const res = await window.electronAPI.getDownloads();
        if (res?.success) {
          setDownloads(res.downloads || []);
        }
      };
      fetch();
      const interval = setInterval(fetch, POLL_INTERVAL);
      return () => clearInterval(interval);
    }, []);

    return {
      downloads,
      activeDownloads: downloads.filter(d => d.state === 'progressing'),
      completedDownloads: downloads.filter(d => d.state === 'completed'),
      errorDownloads: downloads.filter(d => ['interrupted', 'cancelled'].includes(d.state)),
      isLoading,
      removeDownload: (id) => {
        setDownloads(prev => prev.filter(d => d.id !== id));
        if (isElectron) window.electronAPI.removeDownload(id);
      },
      clearDownloads: () => {
        setDownloads([]);
        if (isElectron) window.electronAPI.clearDownloads();
      },
      cancelDownload: (id) => {
        if (isElectron?.cancelDownload) window.electronAPI.cancelDownload(id);
        setDownloads(prev => prev.filter(d => d.id !== id));
      },
      getDownloadSpeed: (id) => speedCache.current.get(id) || 0,
      totalCount: downloads.length,
      activeCount: downloads.filter(d => d.state === 'progressing').length
    };
  }
  return context;
}
