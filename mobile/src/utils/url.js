/**
 * Утилиты для работы с URL
 */

// Поисковые системы
export const SEARCH_ENGINES = {
  yandex: { name: 'Яндекс', url: q => `https://yandex.ru/search/?text=${encodeURIComponent(q)}` },
  google: { name: 'Google', url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  duckduckgo: { name: 'DuckDuckGo', url: q => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  bing: { name: 'Bing', url: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
};

/**
 * Преобразовать пользовательский ввод в URL
 * - Если это URL — вернуть с http://
 * - Если это поисковый запрос — вернуть URL поисковой выдачи
 */
export function inputToUrl(input, searchEngine = 'yandex') {
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  // Уже полный URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('file://')) {
    return trimmed;
  }
  
  // intra:// протокол
  if (trimmed.startsWith('intra://')) {
    return trimmed;
  }
  
  // Похоже на URL (example.com, example.com/path, 1.2.3.4)
  const isUrl = /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed) || 
                /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(trimmed);
  
  if (isUrl) {
    return `http://${trimmed}`;
  }
  
  // Поисковый запрос
  const engine = SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES.yandex;
  return engine.url(trimmed);
}

/**
 * Получить домен из URL
 */
export function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Получить favicon URL из Google API
 */
export function getFaviconUrl(url) {
  const domain = getDomain(url);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

/**
 * Проверить: URL пригоден для отслеживания?
 */
export function isTrackableUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname;
    if (!host || host.length < 2) return false;
    // Исключаем только истинный localhost — инранет-адреса (192.168.x.x, 10.x.x.x, 172.x.x.x)
    // являются полноценными сайтами для интранет-браузера и должны отслеживаться.
    if (host === 'localhost' || /^127\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Сократить URL для отображения
 */
export function shortenUrl(url, maxLength = 40) {
  if (!url || url.length <= maxLength) return url;
  try {
    const parsed = new URL(url);
    const short = parsed.hostname + parsed.pathname.slice(0, 20);
    return short.length > maxLength ? short.slice(0, maxLength) + '…' : short;
  } catch {
    return url.slice(0, maxLength) + '…';
  }
}
