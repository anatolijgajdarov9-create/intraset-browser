import { useSettingsStore } from '../store/settingsStore';
import { lightTheme, darkTheme } from '../utils/theme';

/**
 * Хук для получения текущей темы
 */
export function useTheme() {
  const { settings } = useSettingsStore();
  return settings.darkMode ? darkTheme : lightTheme;
}

/**
 * Хук для переключения темы
 */
export function useThemeToggle() {
  const { toggleDarkMode } = useSettingsStore();
  return toggleDarkMode;
}
