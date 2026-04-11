import { create } from 'zustand';
import { getSettings, updateSetting } from '../utils/storage';

/**
 * Хранилище настроек приложения
 */
export const useSettingsStore = create((set, get) => ({
  // Состояние настроек
  settings: {
    searchEngine: 'yandex',
    newTabMode: 'home', // 'home' | 'blank'
    darkMode: false,
    intranetOnly: false,
    nightMode: false,   // CSS-инверсия на сайтах без тёмной темы
  },
  
  // Флаг загрузки
  isLoading: true,
  
  // ─── Действия ──────────────────────────────────────────────────────────
  
  // Загрузить настройки из хранилища
  loadSettings: async () => {
    set({ isLoading: true });
    const settings = await getSettings();
    set({ settings, isLoading: false });
  },
  
  // Обновить одну настройку
  updateSetting: async (key, value) => {
    const newSettings = await updateSetting(key, value);
    set({ settings: newSettings });
    return newSettings;
  },
  
  // Обновить все настройки
  setSettings: async (settings) => {
    set({ settings });
    // Сохраняем каждую
    for (const [key, value] of Object.entries(settings)) {
      await updateSetting(key, value);
    }
  },
  
  // Переключить тёмную тему
  toggleDarkMode: async () => {
    const { settings } = get();
    const newValue = !settings.darkMode;
    await updateSetting('darkMode', newValue);
    set(state => ({
      settings: { ...state.settings, darkMode: newValue },
    }));
  },
  
  // Переключить интранет-режим
  toggleIntranetOnly: async () => {
    const { settings } = get();
    const newValue = !settings.intranetOnly;
    await updateSetting('intranetOnly', newValue);
    set(state => ({
      settings: { ...state.settings, intranetOnly: newValue },
    }));
  },

  // Переключить ночной режим (CSS-инверсия)
  toggleNightMode: async () => {
    const { settings } = get();
    const newValue = !settings.nightMode;
    await updateSetting('nightMode', newValue);
    set(state => ({
      settings: { ...state.settings, nightMode: newValue },
    }));
  },
}));
