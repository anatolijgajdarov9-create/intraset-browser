import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { addDownload, updateDownload } from '../utils/storage';

const DOWNLOAD_EXTENSIONS = new Set([
  'pdf','doc','docx','xls','xlsx','ppt','pptx',
  'zip','rar','7z','tar','gz','tgz',
  'apk','exe','dmg','deb','rpm',
  'mp3','mp4','avi','mkv','mov','wav','flac',
  'csv',
]);

export function isLikelyDownloadUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    return !!ext && DOWNLOAD_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

async function downloadFileAndSave(url, customFilename) {
  if (!url) return;
  const filename = customFilename ||
    decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'download');
  const downloadsDir = FileSystem.documentDirectory + 'downloads/';
  const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
  }
  const entryList = await addDownload({ filename, url, uri: null, size: null, status: 'downloading' });
  const entryId = entryList?.[0]?.id;
  try {
    const { uri } = await FileSystem.downloadAsync(url, downloadsDir + filename);
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (entryId) {
      await updateDownload(entryId, { uri, size: fileInfo.size || null, status: 'completed' });
    }
    return filename;
  } catch (e) {
    if (entryId) await updateDownload(entryId, { status: 'failed' });
    throw e;
  }
}

export function useDownloadInterceptor() {
  const handleFileDownload = useCallback(async ({ nativeEvent }) => {
    const url = nativeEvent?.url;
    if (!url) return;
    Alert.alert('Скачивание', 'Начинаю скачивание...');
    try {
      const filename = await downloadFileAndSave(url);
      Alert.alert('Готово', `Файл «${filename}» сохранён в загрузки`);
    } catch (e) {
      Alert.alert('Ошибка', `Не удалось скачать файл: ${e.message}`);
    }
  }, []);

  const handleContextMenuDownload = useCallback((url) => {
    if (!url) return;
    Alert.alert('Скачивание', 'Начинаю скачивание...');
    downloadFileAndSave(url)
      .then(filename => Alert.alert('Готово', `Файл «${filename}» сохранён в загрузки`))
      .catch(e => Alert.alert('Ошибка', `Не удалось скачать: ${e.message}`));
  }, []);

  const saveWebPage = useCallback(async (url) => {
    if (!url || url === 'intra://home') return;
    let filename;
    try {
      const p = new URL(url);
      const base = (p.hostname + (p.pathname !== '/' ? p.pathname : '')).replace(/[^\w.-]/g, '_');
      filename = base.slice(0, 60).replace(/_+$/, '') + '.html';
    } catch {
      filename = 'page.html';
    }
    Alert.alert('Сохранение', `Скачиваю «${filename}»...`);
    try {
      const saved = await downloadFileAndSave(url, filename);
      Alert.alert('Готово', `«${saved}» сохранён в загрузки`);
    } catch (e) {
      Alert.alert('Ошибка', `Не удалось сохранить страницу: ${e.message}`);
    }
  }, []);

  return { handleFileDownload, handleContextMenuDownload, saveWebPage };
}
