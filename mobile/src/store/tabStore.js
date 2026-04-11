import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

let tabIdCounter = 1;
const newTabId = () => `tab-${tabIdCounter++}`;

const TABS_KEY = 'intra-tabs';

/**
 * Сохранить вкладки в AsyncStorage (немедленно — для критичных операций)
 */
async function persistTabs(tabs) {
  try {
    await AsyncStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  } catch (e) {
    console.error('[TabStore] Error persisting tabs:', e);
  }
}

/**
 * Debounced сохранение — для частых обновлений (url, title, favicon, navState)
 */
let persistTimer = null;
function schedulePersist(tabs) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    AsyncStorage.setItem(TABS_KEY, JSON.stringify(tabs))
      .catch(e => console.error('[TabStore] Error scheduling persist:', e));
  }, 500);
}

/**
 * Загрузить вкладки из AsyncStorage
 */
async function loadTabs() {
  try {
    const tabs = await AsyncStorage.getItem(TABS_KEY);
    return tabs ? JSON.parse(tabs) : null;
  } catch (e) {
    console.error('[TabStore] Error loading tabs:', e);
    return null;
  }
}

/**
 * Хранилище состояния вкладок
 */
export const useTabStore = create((set, get) => ({
  // Массив вкладок (будет загружен из AsyncStorage)
  tabs: [],

  // ID активной вкладки
  activeTabId: null,

  // Zoom уровень по вкладке
  tabZoom: {},

  // Mute состояние по вкладке
  tabMuted: {},

  // Недавно закрытые вкладки (только на сессию, не персистируются)
  recentlyClosed: [],

  // Флаг «показываем домашний экран поверх реального URL» (не персистируется)
  // { [tabId]: boolean }
  tabHomeOverlay: {},

  // ─── Действия ──────────────────────────────────────────────────────────

  // Инициализация — загрузка вкладок из AsyncStorage
  initActiveTabId: async () => {
    const savedTabs = await loadTabs();

    // Валидация и санитизация загруженных данных
    const validTabs = (savedTabs || [])
      .filter(t => t && typeof t.id === 'string' && typeof t.url === 'string')
      .map(t => ({
        loading: false,
        canGoBack: false,
        canGoForward: false,
        isPrivate: false,
        favicon: null,
        isHome: t.url === 'intra://home',
        ...t,
        // Сбрасываем транзиентные состояния
        loading: false,
      }));

    if (validTabs.length > 0) {
      // Восстанавливаем вкладки
      set({ tabs: validTabs, activeTabId: validTabs[0].id });
      // Восстанавливаем счётчик
      const maxId = Math.max(...validTabs.map(t => parseInt(t.id.split('-')[1]) || 0));
      tabIdCounter = maxId + 1;
    } else {
      // Создаём новую домашнюю вкладку
      const newTab = {
        id: newTabId(),
        url: 'intra://home',
        title: 'Новая вкладка',
        favicon: null,
        loading: false,
        canGoBack: false,
        canGoForward: false,
        isHome: true,
        isPrivate: false,
        isBlank: false,
      };
      set({ tabs: [newTab], activeTabId: newTab.id });
    }
  },
  
  // Создать новую вкладку
  createTab: (url = 'intra://home', title = 'Новая вкладка', isPrivate = false, isBlank = false) => {
    const tab = {
      id: newTabId(),
      url,
      title,
      favicon: null,
      loading: false,
      canGoBack: false,
      canGoForward: false,
      isHome: url === 'intra://home',
      isPrivate,
      isBlank,
    };

    set(state => {
      const newTabs = [...state.tabs, tab];
      persistTabs(newTabs);
      return { tabs: newTabs, activeTabId: tab.id };
    });

    return tab;
  },
  
  // Закрыть вкладку
  closeTab: (tabId) => {
    const { tabs, activeTabId, recentlyClosed } = get();

    // Сохраняем в "недавно закрытые" (только не-домашние и не-приватные)
    const closingTab = tabs.find(t => t.id === tabId);
    let newRecentlyClosed = recentlyClosed;
    if (closingTab && closingTab.url !== 'intra://home' && !closingTab.isPrivate) {
      newRecentlyClosed = [
        { url: closingTab.url, title: closingTab.title, favicon: closingTab.favicon, closedAt: Date.now() },
        ...recentlyClosed,
      ].slice(0, 10);
    }

    // Если это последняя вкладка — создаём новую домашнюю
    if (tabs.length === 1) {
      const newTab = {
        id: newTabId(),
        url: 'intra://home',
        title: 'Новая вкладка',
        favicon: null,
        loading: false,
        canGoBack: false,
        canGoForward: false,
        isHome: true,
        isPrivate: false,
        isBlank: false,
      };
      persistTabs([newTab]);
      set({ tabs: [newTab], activeTabId: newTab.id, recentlyClosed: newRecentlyClosed });
      return newTab;
    }

    const idx = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);

    // Если закрыли активную — переключаемся на соседнюю
    let newActiveId = activeTabId;
    if (activeTabId === tabId) {
      const nextTab = newTabs[Math.max(0, idx - 1)];
      newActiveId = nextTab.id;
    }

    persistTabs(newTabs);
    set({ tabs: newTabs, activeTabId: newActiveId, recentlyClosed: newRecentlyClosed });
  },

  // Восстановить недавно закрытую вкладку
  restoreTab: (closedEntry) => {
    const tab = {
      id: newTabId(),
      url: closedEntry.url,
      title: closedEntry.title || closedEntry.url,
      favicon: closedEntry.favicon || null,
      loading: false,
      canGoBack: false,
      canGoForward: false,
      isHome: false,
      isPrivate: false,
      isBlank: false,
    };
    set(state => {
      const newTabs = [...state.tabs, tab];
      const newRecentlyClosed = state.recentlyClosed.filter(r => r.closedAt !== closedEntry.closedAt);
      persistTabs(newTabs);
      return { tabs: newTabs, activeTabId: tab.id, recentlyClosed: newRecentlyClosed };
    });
    return tab;
  },
  
  // Установить / снять домашний оверлей для вкладки (без изменения URL)
  setTabHomeOverlay: (tabId, value) => {
    set(state => ({
      tabHomeOverlay: { ...state.tabHomeOverlay, [tabId]: value },
    }));
  },

  // Переключить активную вкладку
  switchTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  // Обновить URL вкладки
  updateTabUrl: (tabId, url) => {
    set(state => {
      const newTabs = state.tabs.map(t =>
        t.id === tabId
          ? { ...t, url, isHome: url === 'intra://home' }
          : t
      );
      schedulePersist(newTabs);
      return { tabs: newTabs };
    });
  },

  // Обновить заголовок вкладки
  updateTabTitle: (tabId, title) => {
    set(state => {
      const newTabs = state.tabs.map(t =>
        t.id === tabId ? { ...t, title } : t
      );
      schedulePersist(newTabs);
      return { tabs: newTabs };
    });
  },

  // Обновить favicon вкладки
  updateTabFavicon: (tabId, favicon) => {
    set(state => {
      const newTabs = state.tabs.map(t =>
        t.id === tabId ? { ...t, favicon } : t
      );
      schedulePersist(newTabs);
      return { tabs: newTabs };
    });
  },

  // Обновить состояние загрузки (транзиентное — не сохраняем)
  updateTabLoading: (tabId, loading) => {
    set(state => ({
      tabs: state.tabs.map(t => t.id === tabId ? { ...t, loading } : t),
    }));
  },

  // Обновить навигационные состояния
  updateTabNavState: (tabId, { canGoBack, canGoForward }) => {
    set(state => {
      const newTabs = state.tabs.map(t =>
        t.id === tabId ? { ...t, canGoBack, canGoForward } : t
      );
      schedulePersist(newTabs);
      return { tabs: newTabs };
    });
  },
  
  // Установить zoom для вкладки
  setTabZoom: (tabId, zoomLevel) => {
    set(state => ({
      tabZoom: { ...state.tabZoom, [tabId]: zoomLevel },
    }));
  },
  
  // Переключить mute вкладки
  toggleTabMuted: (tabId) => {
    set(state => {
      const currentlyMuted = state.tabMuted[tabId] || false;
      return {
        tabMuted: { ...state.tabMuted, [tabId]: !currentlyMuted },
      };
    });
  },
  
  // Получить активную вкладку
  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId) || tabs[0];
  },
}));
