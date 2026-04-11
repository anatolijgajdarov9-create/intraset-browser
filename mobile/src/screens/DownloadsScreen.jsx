import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Share,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDownloads, setDownloadsList, removeDownload, clearDownloads } from '../utils/storage';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

export default function DownloadsScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, insets), [theme, insets]);
  const [downloads, setDownloads] = useState([]);

  useEffect(() => { loadDownloads(); }, []);

  // Перечитываем список при каждом возврате на экран
  useFocusEffect(
    useCallback(() => { loadDownloads(); }, [])
  );

  // Опрашиваем хранилище каждые 2 сек пока есть незавершённые загрузки
  useEffect(() => {
    const hasInProgress = downloads.some(d => d.status === 'downloading');
    if (!hasInProgress) return;
    const timer = setInterval(loadDownloads, 2000);
    return () => clearInterval(timer);
  }, [downloads]);

  const loadDownloads = async () => {
    const data = await getDownloads();
    setDownloads(data);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '—';
    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    let size = bytes;
    let i = 0;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return `${size.toFixed(1)} ${units[i]}`;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const days = Math.floor((Date.now() - date) / (1000 * 60 * 60 * 24));
    if (days === 0) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Вчера';
    if (days < 7) return date.toLocaleDateString('ru-RU', { weekday: 'short' });
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const handleOpenFile = async (download) => {
    try {
      if (download.uri) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(download.uri);
        } else {
          Alert.alert('Ошибка', 'Не удалось открыть файл');
        }
      } else {
        Alert.alert('Файл не найден', 'Файл был удалён или перемещён.');
      }
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось открыть файл');
    }
  };

  const handleShareFile = async (download) => {
    try {
      if (download.uri) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) await Sharing.shareAsync(download.uri);
      } else {
        await Share.share({ message: `${download.filename}\n${download.url}` });
      }
    } catch {}
  };

  const handleDelete = async (id) => {
    const download = downloads.find(d => d.id === id);
    Alert.alert(
      'Удалить загрузку?',
      `«${download?.filename}» будет удалён из списка`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить', style: 'destructive',
          onPress: async () => {
            if (download?.uri) {
              try {
                const info = await FileSystem.getInfoAsync(download.uri);
                if (info.exists) await FileSystem.deleteAsync(download.uri);
              } catch {}
            }
            await removeDownload(id);
            await loadDownloads();
          },
        },
      ]
    );
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Очистить загрузки?',
      'Все записи и файлы будут удалены',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить', style: 'destructive',
          onPress: async () => {
            for (const d of downloads) {
              if (d?.uri) {
                try {
                  const info = await FileSystem.getInfoAsync(d.uri);
                  if (info.exists) await FileSystem.deleteAsync(d.uri);
                } catch {}
              }
            }
            await clearDownloads();
            setDownloads([]);
          },
        },
      ]
    );
  };

  const getFileIcon = (filename) => {
    if (!filename) return 'document-outline';
    const ext = filename.split('.').pop()?.toLowerCase();
    const map = {
      pdf: 'document-text-outline',
      doc: 'document-text-outline', docx: 'document-text-outline',
      xls: 'grid-outline', xlsx: 'grid-outline',
      jpg: 'image-outline', jpeg: 'image-outline', png: 'image-outline', gif: 'image-outline',
      mp3: 'musical-notes-outline', wav: 'musical-notes-outline',
      mp4: 'film-outline', avi: 'film-outline',
      zip: 'archive-outline', rar: 'archive-outline',
      apk: 'phone-portrait-outline',
    };
    return map[ext] || 'document-outline';
  };

  const renderDownload = ({ item }) => {
    const isDownloading = item.status === 'downloading';
    const isFailed = item.status === 'failed';
    return (
      <TouchableOpacity
        style={[styles.downloadItem, isFailed && styles.downloadItemFailed]}
        onPress={() => !isDownloading && handleOpenFile(item)}
        onLongPress={() => handleDelete(item.id)}
        activeOpacity={isDownloading ? 1 : 0.7}
      >
        <View style={[styles.fileIcon, isDownloading && styles.fileIconDownloading, isFailed && styles.fileIconFailed]}>
          <Ionicons
            name={isFailed ? 'alert-circle-outline' : isDownloading ? 'cloud-download-outline' : getFileIcon(item.filename)}
            size={24}
            color={isFailed ? theme.error : isDownloading ? theme.textSecondary : theme.primary}
          />
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{item.filename}</Text>
          <Text style={[styles.fileMeta, isFailed && { color: theme.error }]}>
            {isDownloading
              ? 'Загружается...'
              : isFailed
                ? 'Ошибка загрузки'
                : `${formatFileSize(item.size)} · ${formatDate(item.date)}`}
          </Text>
        </View>
        {!isDownloading && (
          <TouchableOpacity style={styles.shareButton} onPress={() => isFailed ? handleDelete(item.id) : handleShareFile(item)}>
            <Ionicons name={isFailed ? 'trash-outline' : 'share-outline'} size={20} color={isFailed ? theme.error : theme.primary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Загрузки ({downloads.length})</Text>
        <View style={styles.headerButtons}>
          {downloads.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
              <Text style={styles.clearButtonText}>Очистить</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneButtonText}>Готово</Text>
          </TouchableOpacity>
        </View>
      </View>

      {downloads.length > 0 ? (
        <FlatList
          data={downloads}
          keyExtractor={(item) => item.id}
          renderItem={renderDownload}
          contentContainerStyle={styles.list}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="download-outline" size={64} color={theme.textTertiary} />
          <Text style={styles.emptyTitle}>Нет загрузок</Text>
          <Text style={styles.emptyText}>Скачанные файлы будут отображаться здесь</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (theme, insets) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: insets.top + SIZES.paddingMd,
    paddingHorizontal: SIZES.paddingLg,
    paddingBottom: SIZES.paddingMd,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontSize: SIZES.textXl,
    fontWeight: '700',
    color: theme.text,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: { padding: SIZES.paddingSm, marginRight: SIZES.paddingXs },
  clearButtonText: {
    fontSize: SIZES.textMd,
    color: theme.error,
    fontWeight: '600',
  },
  doneButton: { padding: SIZES.paddingSm },
  doneButtonText: {
    fontSize: SIZES.textMd,
    color: theme.primary,
    fontWeight: '600',
  },
  list: { padding: SIZES.paddingMd },
  downloadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.paddingMd,
    marginBottom: SIZES.paddingSm,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: SIZES.radiusLg,
  },
  downloadItemFailed: {
    opacity: 0.8,
    borderWidth: 1,
    borderColor: theme.error,
  },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: SIZES.radiusMd,
    backgroundColor: theme.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.paddingMd,
  },
  fileIconDownloading: {
    backgroundColor: theme.backgroundTertiary,
  },
  fileIconFailed: {
    backgroundColor: '#fee2e2',
  },
  fileInfo: {
    flex: 1,
    marginRight: SIZES.paddingSm,
  },
  fileName: {
    fontSize: SIZES.textMd,
    color: theme.text,
    fontWeight: '500',
    marginBottom: 2,
  },
  fileMeta: {
    fontSize: SIZES.textSm,
    color: theme.textSecondary,
  },
  shareButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: SIZES.radiusMd,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.paddingXl * 2,
    gap: SIZES.paddingMd,
  },
  emptyTitle: {
    fontSize: SIZES.textXl,
    fontWeight: '700',
    color: theme.text,
  },
  emptyText: {
    fontSize: SIZES.textMd,
    color: theme.textSecondary,
    textAlign: 'center',
  },
});
