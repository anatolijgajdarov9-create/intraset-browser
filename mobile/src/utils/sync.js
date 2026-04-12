/**
 * Модуль синхронизации данных между устройствами
 * Поддерживает: закладки, история, настройки
 * 
 * Реализация: локальный файл в общей директории (для ручной синхронизации)
 * Позже можно добавить серверную синхронизацию
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

const SYNC_VERSION = '1.0';
const SYNC_FILE_NAME = 'intraset-sync.json';

const KEYS = {
  BOOKMARKS: 'intra-bookmarks',
  HISTORY: 'intra-history',
  SETTINGS: 'intra-settings',
};

const MAX_HISTORY_ITEMS = 200;
const MAX_BOOKMARKS_ITEMS = 500;

export const SyncStatus = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
};

export const SyncDirection = {
  EXPORT: 'export',
  IMPORT: 'import',
  MERGE: 'merge',
};

async function getSyncFilePath() {
  const dir = FileSystem.documentDirectory;
  return dir + SYNC_FILE_NAME;
}

export async function exportData() {
  try {
    const [bookmarks, history, settings] = await Promise.all([
      AsyncStorage.getItem(KEYS.BOOKMARKS),
      AsyncStorage.getItem(KEYS.HISTORY),
      AsyncStorage.getItem(KEYS.SETTINGS),
    ]);

    const syncData = {
      version: SYNC_VERSION,
      timestamp: Date.now(),
      deviceName: 'Mobile',
      bookmarks: bookmarks ? JSON.parse(bookmarks) : [],
      history: history ? JSON.parse(history) : [],
      settings: settings ? JSON.parse(settings) : {},
    };

    const filePath = await getSyncFilePath();
    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(syncData, null, 2));

    return {
      success: true,
      filePath,
      data: syncData,
    };
  } catch (e) {
    console.error('[Sync] Export error:', e);
    return { success: false, error: e.message };
  }
}

export async function importData(fileUri) {
  try {
    const content = await FileSystem.readAsStringAsync(fileUri);
    const syncData = JSON.parse(content);

    if (!syncData.version) {
      return { success: false, error: 'Неверный формат файла' };
    }

    const merged = await mergeData(syncData, SyncDirection.MERGE);

    return {
      success: true,
      imported: merged,
      timestamp: syncData.timestamp,
    };
  } catch (e) {
    console.error('[Sync] Import error:', e);
    return { success: false, error: e.message };
  }
}

export async function mergeData(importedData, direction = SyncDirection.MERGE) {
  const results = { bookmarks: 0, history: 0, settings: 0 };

  if (direction === SyncDirection.MERGE || direction === SyncDirection.IMPORT) {
    if (importedData.bookmarks && importedData.bookmarks.length > 0) {
      const currentBookmarks = JSON.parse(await AsyncStorage.getItem(KEYS.BOOKMARKS) || '[]');
      const existingUrls = new Set(currentBookmarks.map(b => b.url));
      
      const newBookmarks = importedData.bookmarks.filter(b => !existingUrls.has(b.url));
      const mergedBookmarks = [...currentBookmarks, ...newBookmarks].slice(0, MAX_BOOKMARKS_ITEMS);
      
      await AsyncStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(mergedBookmarks));
      results.bookmarks = newBookmarks.length;
    }

    if (importedData.history && importedData.history.length > 0) {
      const currentHistory = JSON.parse(await AsyncStorage.getItem(KEYS.HISTORY) || '[]');
      const existingUrls = new Set(currentHistory.map(h => h.url));
      
      const newHistory = importedData.history.filter(h => !existingUrls.has(h.url));
      const mergedHistory = [...currentHistory, ...newHistory].slice(0, MAX_HISTORY_ITEMS);
      
      await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(mergedHistory));
      results.history = newHistory.length;
    }

    if (importedData.settings) {
      const currentSettings = JSON.parse(await AsyncStorage.getItem(KEYS.SETTINGS) || '{}');
      const mergedSettings = { ...currentSettings, ...importedData.settings };
      
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(mergedSettings));
      results.settings = 1;
    }
  }

  if (direction === SyncDirection.EXPORT) {
    await exportData();
  }

  return results;
}

export async function shareExportFile() {
  try {
    const result = await exportData();
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, error: 'Sharing не доступен' };
    }

    await Sharing.shareAsync(result.filePath, {
      mimeType: 'application/json',
      dialogTitle: 'Экспорт данных Intraset Browser',
    });

    // Сохраняем время последнего экспорта
    await setLastSyncTime(Date.now());

    return { success: true };
  } catch (e) {
    console.error('[Sync] Share error:', e);
    return { success: false, error: e.message };
  }
}

export async function getLastSyncTime() {
  try {
    const data = await AsyncStorage.getItem('intra-sync-meta');
    if (data) {
      const meta = JSON.parse(data);
      return meta.lastSync || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setLastSyncTime(timestamp) {
  try {
    const meta = { lastSync: timestamp };
    await AsyncStorage.setItem('intra-sync-meta', JSON.stringify(meta));
  } catch (e) {
    console.error('[Sync] Set meta error:', e);
  }
}

export function formatSyncTime(timestamp) {
  if (!timestamp) return 'Никогда';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Только что';
  if (diffMins < 60) return `${diffMins} мин. назад`;
  if (diffHours < 24) return `${diffHours} ч. назад`;
  if (diffDays < 7) return `${diffDays} дн. назад`;
  
  return date.toLocaleDateString('ru-RU');
}