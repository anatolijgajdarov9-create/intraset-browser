import AsyncStorage from '@react-native-async-storage/async-storage';

// Ключи хранилища
const KEYS = {
  BOOKMARKS: 'intra-bookmarks',
  HISTORY: 'intra-history',
  VISITS: 'intra-visits',
  DOWNLOADS: 'intra-downloads',
  SETTINGS: 'intra-settings',
  SEARCH_ENGINE: 'intra-search-engine',
  NEWTAB: 'intra-newtab',
};

/**
 * Получить данные по ключу
 */
export async function getItem(key, defaultValue = null) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.error(`[Storage] Error getting ${key}:`, e);
    return defaultValue;
  }
}

/**
 * Сохранить данные по ключу
 */
export async function setItem(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[Storage] Error setting ${key}:`, e);
  }
}

/**
 * Удалить данные по ключу
 */
export async function removeItem(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.error(`[Storage] Error removing ${key}:`, e);
  }
}

/**
 * Очистить всё хранилище
 */
export async function clearAll() {
  try {
    await AsyncStorage.clear();
  } catch (e) {
    console.error('[Storage] Error clearing storage:', e);
  }
}

// ─── Закладки ──────────────────────────────────────────────────────────────

export async function getBookmarks() {
  return getItem(KEYS.BOOKMARKS, []);
}

export async function setBookmarks(bookmarks) {
  return setItem(KEYS.BOOKMARKS, bookmarks);
}

export async function addBookmark(bookmark) {
  const bookmarks = await getBookmarks();
  bookmarks.unshift({ ...bookmark, id: Date.now().toString() });
  await setBookmarks(bookmarks);
  return bookmarks;
}

export async function removeBookmark(id) {
  const bookmarks = await getBookmarks();
  const filtered = bookmarks.filter(b => b.id !== id);
  await setBookmarks(filtered);
  return filtered;
}

export async function isBookmarked(url) {
  const bookmarks = await getBookmarks();
  return bookmarks.some(b => b.url === url);
}

// ─── История посещений ────────────────────────────────────────────────────

export async function getHistory() {
  return getItem(KEYS.HISTORY, []);
}

export async function setHistory(history) {
  return setItem(KEYS.HISTORY, history);
}

export async function addHistoryEntry(entry) {
  const history = await getHistory();
  // Убираем дубли
  const filtered = history.filter(h => h.url !== entry.url);
  filtered.unshift({ ...entry, id: Date.now().toString(), timestamp: Date.now() });
  // Ограничиваем 200 записями
  const limited = filtered.slice(0, 200);
  await setHistory(limited);
  return limited;
}

export async function clearHistory() {
  await setHistory([]);
}

// ─── Загрузки ─────────────────────────────────────────────────────────────

export async function getDownloads() {
  return getItem(KEYS.DOWNLOADS, []);
}

export async function setDownloadsList(downloads) {
  return setItem(KEYS.DOWNLOADS, downloads);
}

export async function addDownload(download) {
  const downloads = await getDownloads();
  downloads.unshift({ ...download, id: Date.now().toString(), date: Date.now() });
  await setDownloadsList(downloads);
  return downloads;
}

export async function removeDownload(id) {
  const downloads = await getDownloads();
  const filtered = downloads.filter(d => d.id !== id);
  await setDownloadsList(filtered);
  return filtered;
}

export async function clearDownloads() {
  await setDownloadsList([]);
}

// ─── Мета-данные посещений (по доменам) ───────────────────────────────────

export async function getVisits() {
  return getItem(KEYS.VISITS, {});
}

export async function setVisits(visits) {
  return setItem(KEYS.VISITS, visits);
}

export async function trackVisit(url, title, favicon) {
  if (!isTrackableUrl(url)) return;
  
  try {
    const parsed = new URL(url);
    const key = parsed.origin;
    const visits = await getVisits();
    const prev = visits[key] || { count: 0, title: '', favicon: null, url: '' };
    const newTitle = title || prev.title || parsed.hostname;
    
    visits[key] = {
      count: prev.count + 1,
      title: newTitle,
      favicon: favicon || prev.favicon,
      url,
      lastVisit: Date.now()
    };
    
    await setVisits(visits);
  } catch (e) {
    console.error('[Storage] Error tracking visit:', e);
  }
}

function isTrackableUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname;
    if (!host || host.length < 3) return false;
    if (host === 'localhost' || /^127\./.test(host) || /^192\.168\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

// ─── Настройки ────────────────────────────────────────────────────────────

export async function getSettings() {
  return getItem(KEYS.SETTINGS, {
    searchEngine: 'yandex',
    newTabMode: 'home', // 'home' | 'blank'
    darkMode: false,
    intranetOnly: false,
  });
}

export async function setSettings(settings) {
  return setItem(KEYS.SETTINGS, settings);
}

export async function updateSetting(key, value) {
  const settings = await getSettings();
  settings[key] = value;
  await setSettings(settings);
  return settings;
}
