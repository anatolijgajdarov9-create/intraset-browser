// Platform import removed — safeAreaTop replaced by useSafeAreaInsets() hook

// ─── Цветовые темы ───────────────────────────────────────────────────────────

export const lightTheme = {
  // Основные цвета
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#dbeafe',
  
  // Фон
  background: '#ffffff',
  backgroundSecondary: '#f8fafc',
  backgroundTertiary: '#f1f5f9',
  
  // Текст
  text: '#1e293b',
  textSecondary: '#64748b',
  textTertiary: '#94a3b8',
  textInverse: '#ffffff',
  
  // Границы
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  
  // Статусы
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Приватный режим
  private: '#7c3aed',
  privateLight: '#f3e8ff',
  privateBorder: '#d8b4fe',
  
  // Навигация
  tabBarBg: '#ffffff',
  tabBarBorder: '#e2e8f0',
  tabBarInactive: '#94a3b8',
  
  // Адресная строка
  addressBarBg: '#f1f5f9',
  addressBarBorder: '#e2e8f0',
  addressBarText: '#64748b',
  
  // Вкладки
  tabBg: '#ffffff',
  tabActive: '#eff6ff',
  tabInactive: 'transparent',

  // Прогресс-бар загрузки
  progressBar: '#2563eb',
  progressBarPrivate: '#7c3aed',

  // Панель поиска (Find in Page)
  findBarBg: '#f1f5f9',
  findBarBorder: '#e2e8f0',
};

export const darkTheme = {
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  primaryLight: '#1e3a8a',
  
  background: '#0f172a',
  backgroundSecondary: '#1e293b',
  backgroundTertiary: '#334155',
  
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',
  textInverse: '#ffffff',
  
  border: '#334155',
  borderLight: '#1e293b',
  
  success: '#34d399',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#60a5fa',
  
  private: '#a78bfa',
  privateLight: '#2e1065',
  privateBorder: '#7c3aed',
  
  tabBarBg: '#0f172a',
  tabBarBorder: '#1e293b',
  tabBarInactive: '#64748b',
  
  addressBarBg: '#1e293b',
  addressBarBorder: '#334155',
  addressBarText: '#94a3b8',
  
  tabBg: '#0f172a',
  tabActive: '#1e293b',
  tabInactive: 'transparent',

  progressBar: '#3b82f6',
  progressBarPrivate: '#a78bfa',

  findBarBg: '#1e293b',
  findBarBorder: '#334155',
};

// ─── Размеры компонентов ─────────────────────────────────────────────────────

export const SIZES = {
  // Адресная строка
  addressBarHeight: 48,
  
  // Панель вкладок
  tabBarHeight: 44,
  tabMinWidth: 80,
  tabMaxWidth: 200,
  
  // Нижняя панель навигации браузера
  bottomBarHeight: 52,

  // Прогресс-бар загрузки страницы
  progressBarHeight: 3,

  // Заголовок модальных экранов
  headerHeight: 52,

  // Навигация
  navBarHeight: 46,

  // Боковая панель
  sidebarWidth: 280,
  
  // Отступы
  paddingXs: 4,
  paddingSm: 8,
  paddingMd: 12,
  paddingLg: 16,
  paddingXl: 24,
  
  // Иконки
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  iconXl: 32,
  
  // Текст
  textXs: 10,
  textSm: 12,
  textMd: 14,
  textLg: 16,
  textXl: 18,
  text2Xl: 20,
  
  // Скругления
  radiusSm: 4,
  radiusMd: 8,
  radiusLg: 12,
  radiusXl: 16,
  radiusFull: 9999,
};

// По умолчанию — светлая тема
export const defaultTheme = lightTheme;
