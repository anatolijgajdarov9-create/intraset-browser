/**
 * Утилиты форматирования данных для модуля загрузок
 * Независимые функции без зависимостей от React/компонентов
 */

const BYTE_UNITS = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
const SPEED_UNITS = ['Б/с', 'КБ/с', 'МБ/с', 'ГБ/с'];

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0 || bytes == null) return '0 Б';
  if (bytes < 0) return '—';

  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(i === 0 ? 0 : decimals)} ${BYTE_UNITS[i] || 'Б'}`;
}

export function formatSpeed(bytesPerSecond, decimals = 1) {
  if (bytesPerSecond === 0 || bytesPerSecond == null) return '0 Б/с';
  if (bytesPerSecond < 0) return '—';

  const k = 1024;
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  const value = bytesPerSecond / Math.pow(k, i);

  return `${value.toFixed(decimals)} ${SPEED_UNITS[i] || 'Б/с'}`;
}

export function formatDuration(seconds) {
  if (seconds == null || seconds < 0) return '—';
  if (seconds === 0) return '0 сек';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours} ч`);
  if (minutes > 0) parts.push(`${minutes} мин`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} сек`);

  return parts.join(' ');
}

export function formatPercent(received, total) {
  if (total === 0 || total == null) return null;
  if (received == null) return 0;
  return Math.round((received / total) * 100);
}

export function formatEta(bytesRemaining, bytesPerSecond) {
  if (!bytesRemaining || !bytesPerSecond || bytesPerSecond <= 0) return null;
  const seconds = bytesRemaining / bytesPerSecond;
  return formatDuration(seconds);
}

export function formatFileSizeProgress(received, total) {
  if (total === 0 || total == null) {
    return received > 0 ? formatBytes(received) : null;
  }
  return `${formatBytes(received)} / ${formatBytes(total)}`;
}

export function getStatusLabel(state) {
  const labels = {
    progressing: 'Загрузка',
    completed: 'Готово',
    interrupted: 'Ошибка',
    cancelled: 'Отменено',
    paused: 'Приостановлено'
  };
  return labels[state] || state;
}

export function getStatusColor(state) {
  const colors = {
    progressing: '#2563eb',
    completed: '#22c55e',
    interrupted: '#ef4444',
    cancelled: '#f59e0b',
    paused: '#94a3b8'
  };
  return colors[state] || '#94a3b8';
}
