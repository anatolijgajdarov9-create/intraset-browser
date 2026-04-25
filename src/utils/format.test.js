import {
  formatBytes,
  formatSpeed,
  formatDuration,
  formatPercent,
  formatEta,
  formatFileSizeProgress,
  getStatusLabel,
  getStatusColor,
} from './format';

describe('formatBytes', () => {
  test('0 байт возвращает "0 Б"', () => {
    expect(formatBytes(0)).toBe('0 Б');
  });

  test('null/undefined возвращает "0 Б"', () => {
    expect(formatBytes(null)).toBe('0 Б');
    expect(formatBytes(undefined)).toBe('0 Б');
  });

  test('отрицательное значение возвращает "—"', () => {
    expect(formatBytes(-1)).toBe('—');
  });

  test('1024 байт = 1.00 КБ', () => {
    expect(formatBytes(1024)).toBe('1.00 КБ');
  });

  test('1536 байт = 1.50 КБ', () => {
    expect(formatBytes(1536)).toBe('1.50 КБ');
  });

  test('1048576 байт = 1.00 МБ', () => {
    expect(formatBytes(1048576)).toBe('1.00 МБ');
  });
});

describe('formatSpeed', () => {
  test('0 байт/с возвращает "0 Б/с"', () => {
    expect(formatSpeed(0)).toBe('0 Б/с');
  });

  test('1024 байт/с = 1 КБ/с', () => {
    expect(formatSpeed(1024)).toBe('1.0 КБ/с');
  });

  test('отрицательное значение возвращает "—"', () => {
    expect(formatSpeed(-100)).toBe('—');
  });
});

describe('formatDuration', () => {
  test('0 секунд возвращает "0 сек"', () => {
    expect(formatDuration(0)).toBe('0 сек');
  });

  test('null/undefined возвращает "—"', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
  });

  test('отрицательное значение возвращает "—"', () => {
    expect(formatDuration(-1)).toBe('—');
  });

  test('60 секунд = 1 мин', () => {
    expect(formatDuration(60)).toBe('1 мин');
  });

  test('90 секунд = 1 мин 30 сек', () => {
    expect(formatDuration(90)).toBe('1 мин 30 сек');
  });

  test('3661 секунда = 1 ч 1 мин 1 сек', () => {
    expect(formatDuration(3661)).toBe('1 ч 1 мин 1 сек');
  });
});

describe('formatPercent', () => {
  test('50% от 100 = 50', () => {
    expect(formatPercent(50, 100)).toBe(50);
  });

  test('0 при total = 0', () => {
    expect(formatPercent(50, 0)).toBeNull();
  });

  test('null при received = null', () => {
    expect(formatPercent(null, 100)).toBe(0);
  });
});

describe('formatEta', () => {
  test('возвращает formatDuration результат', () => {
    expect(formatEta(600, 10)).toBe('1 мин');
  });

  test('null при некорректных значениях', () => {
    expect(formatEta(0, 10)).toBeNull();
    expect(formatEta(100, 0)).toBeNull();
    expect(formatEta(100, -1)).toBeNull();
    expect(formatEta(null, 10)).toBeNull();
  });
});

describe('formatFileSizeProgress', () => {
  test('формат "получено / всего"', () => {
    expect(formatFileSizeProgress(1024, 4096)).toBe('1.00 КБ / 4.00 КБ');
  });

  test('только получено при total = 0', () => {
    expect(formatFileSizeProgress(1024, 0)).toBe('1.00 КБ');
  });

  test('null при оба = 0', () => {
    expect(formatFileSizeProgress(0, 0)).toBeNull();
  });
});

describe('getStatusLabel', () => {
  test('возвращает правильные метки', () => {
    expect(getStatusLabel('progressing')).toBe('Загрузка');
    expect(getStatusLabel('completed')).toBe('Готово');
    expect(getStatusLabel('interrupted')).toBe('Ошибка');
    expect(getStatusLabel('cancelled')).toBe('Отменено');
    expect(getStatusLabel('paused')).toBe('Приостановлено');
  });

  test('возвращает state при неизвестном значении', () => {
    expect(getStatusLabel('unknown')).toBe('unknown');
  });
});

describe('getStatusColor', () => {
  test('возвращает цвета для известных статусов', () => {
    expect(getStatusColor('progressing')).toBe('#2563eb');
    expect(getStatusColor('completed')).toBe('#22c55e');
    expect(getStatusColor('interrupted')).toBe('#ef4444');
    expect(getStatusColor('cancelled')).toBe('#f59e0b');
    expect(getStatusColor('paused')).toBe('#94a3b8');
  });

  test('возвращает дефолтный цвет для неизвестного статуса', () => {
    expect(getStatusColor('unknown')).toBe('#94a3b8');
  });
});