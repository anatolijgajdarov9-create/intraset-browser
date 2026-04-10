// Конфигурация интранет-доменов (перенесено из десктопной версии)
const intranetDomains = [
  '.local',
  '.intra',
  '.corporate',
  '.internal',
  '.lan',
  'localhost',
  '127.0.0.1',
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
];

const intranetUrls = [
  'http://localhost',
  'http://127.0.0.1',
];

/**
 * Проверка: является ли URL интранет-адресом
 */
export function isIntranetUrl(url) {
  if (!url) return false;
  
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // Проверка по доменам
    for (const domain of intranetDomains) {
      if (hostname.endsWith(domain)) return true;
    }
    
    // Проверка по конкретным URL
    for (const prefix of intranetUrls) {
      if (url.toLowerCase().startsWith(prefix)) return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Список интранет-доменов для отображения в настройках
 */
export function getIntranetDomains() {
  return [...intranetDomains];
}
