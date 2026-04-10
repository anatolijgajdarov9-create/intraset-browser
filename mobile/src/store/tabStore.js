import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

let tabIdCounter = 1;
const newTabId = () => `tab-${tabIdCounter++}`;

const TABS_KEY = 'intra-tabs';

/**
 * Сохранить вкладки в AsyncStorage
 */
async function persistTabs(tabs) {
  try {
    await AsyncStorage.setItem(TABS_KEY, JSON.stringify(tabs));
  } catch (e) {
    console.error('[TabStore] Error persisting tabs:', e);
  }
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

  // ─── Действия ──────────────────────────────────────────────────────────

  // Инициализация — загрузка вкладок из AsyncStorage
  initActiveTabId: async () => {
    const savedTabs = await loadTabs();
    
    if (savedTabs && savedTabs.length > 0) {
      // Восстанавливаем вкладки
      set({ tabs: savedTabs, activeTabId: savedTabs[0].id });
      // Восстанавливаем счётчик
      const maxId = Math.max(...savedTabs.map(t => parseInt(t.id.split('-')[1]) || 0));
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
    const { tabs, activeTabId } = get();

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
      set({ tabs: [newTab], activeTabId: newTab.id });
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
    set({ tabs: newTabs, activeTabId: newActiveId });
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
      persistTabs(newTabs);
      return { tabs: newTabs };
    });
  },

  // Обновить заголовок вкладки
  updateTabTitle: (tabId, title) => {
    set(state => {
      const newTabs = state.tabs.map(t =>
        t.id === tabId ? { ...t, title } : t
      );
      persistTabs(newTabs);
      return { tabs: newTabs };
    });
  },

  // Обновить favicon вкладки
  updateTabFavicon: (tabId, favicon) => {
    set(state => {
      const newTabs = state.tabs.map(t =>
        t.id === tabId ? { ...t, favicon } : t
      );
      persistTabs(newTabs);
      return { tabs: newTabs };
    });
  },

  // Обновить состояние загрузки
  updateTabLoading: (tabId, loading) => {
    set(state => {
      const newTabs = state.tabs.map(t =>
        t.id === tabId ? { ...t, loading } : t
      );
      persistTabs(newTabs);
      return { tabs: newTabs };
    });
  },

  // Обновить навигационные состояния
  updateTabNavState: (tabId, { canGoBack, canGoForward }) => {
    set(state => {
      const newTabs = state.tabs.map(t =>
        t.id === tabId ? { ...t, canGoBack, canGoForward } : t
      );
      persistTabs(newTabs);
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
