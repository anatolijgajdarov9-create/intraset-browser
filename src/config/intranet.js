// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  INTRA BROWSER — Конфигурация интранет-ресурсов                         ║
// ║  Этот файл легко редактируется для добавления ваших ресурсов            ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const INTRANET_CONFIG = {
  // Название вашей организации
  orgName: 'Intra сеть',

  // Поисковая система по умолчанию
  defaultSearch: 'https://yandex.ru/search/?text=',

  // Диапазоны IP адресов интранета (для определения — внутренний ли ресурс)
  intranetRanges: [
    '192.168.',
    '10.',
    '172.16.',
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.',
    'localhost',
    '127.0.0.1'
  ],

  // Внутренние домены (без HTTP)
  intranetDomains: [
    '.local',
    '.intra',
    '.corp',
    '.lan',
    '.internal'
  ],

  // ── Сервисы — теперь берутся из истории посещений в localStorage ─────────
  // Поле оставлено пустым. "Часто посещаемые" формируются автоматически.
  services: [],

  // ── Закладки (панель закладок) — теперь хранятся в localStorage ──────────
  // Начальные закладки задаются здесь только для первого запуска (если localStorage пуст).
  bookmarks: []
};

// Утилита — определить, является ли URL внутренним ресурсом
export function isIntranetUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return INTRANET_CONFIG.intranetRanges.some(r => hostname.startsWith(r)) ||
      INTRANET_CONFIG.intranetDomains.some(d => hostname.endsWith(d)) ||
      hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}
