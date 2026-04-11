import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../store/settingsStore';
import { useTabStore } from '../store/tabStore';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';
import { shareExportFile, importData, getLastSyncTime, formatSyncTime } from '../utils/sync';
import * as DocumentPicker from 'expo-document-picker';
import { clearHistory, clearDownloads, setBookmarks, setVisits } from '../utils/storage';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, insets), [theme, insets]);
  const { settings, updateSetting, toggleDarkMode, toggleIntranetOnly, toggleNightMode } = useSettingsStore();
  const initActiveTabId = useTabStore(state => state.initActiveTabId);
  const [lastSync, setLastSync] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    const time = await getLastSyncTime();
    setLastSync(formatSyncTime(time));
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setIsImporting(true);
      const uri = result.assets[0].uri;
      const imported = await importData(uri);
      if (imported.success) {
        const { bookmarks = 0, history = 0 } = imported.imported || {};
        Alert.alert(
          'Импорт завершён',
          `Добавлено: закладок — ${bookmarks}, записей истории — ${history}.`,
        );
      } else {
        Alert.alert('Ошибка импорта', imported.error || 'Не удалось прочитать файл');
      }
    } catch (e) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await shareExportFile();
      if (result.success) {
        Alert.alert('Экспорт', 'Файл синхронизации создан и готов к отправке');
      } else {
        Alert.alert('Ошибка', result.error || 'Не удалось экспортировать данные');
      }
    } catch (e) {
      Alert.alert('Ошибка', e.message);
    }
    setIsExporting(false);
  };

  const searchEngines = [
    { key: 'yandex',     name: 'Яндекс',     icon: 'search' },
    { key: 'google',     name: 'Google',     icon: 'search' },
    { key: 'duckduckgo', name: 'DuckDuckGo', icon: 'search' },
    { key: 'bing',       name: 'Bing',       icon: 'search' },
  ];

  const handleClearHistory = () => {
    Alert.alert(
      'Очистить историю?',
      'Все записи будут удалены.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Очистить', style: 'destructive', onPress: () => clearHistory() },
      ]
    );
  };

  const handleClearDownloads = () => {
    Alert.alert(
      'Очистить загрузки?',
      'Список загрузок будет очищен.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Очистить', style: 'destructive', onPress: () => clearDownloads() },
      ]
    );
  };

  const handleResetAll = () => {
    Alert.alert(
      'Сбросить все данные?',
      'История, загрузки и закладки будут удалены. Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить всё', style: 'destructive',
          onPress: async () => {
            await Promise.all([
              clearHistory(),
              clearDownloads(),
              setBookmarks([]),
              setVisits({}),
            ]);
            await initActiveTabId();
          },
        },
      ]
    );
  };

  const ActionRow = ({ title, description, destructive, onPress }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingTitle, destructive && { color: theme.error }]}>{title}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
    </TouchableOpacity>
  );

  const SettingRow = ({ title, description, value, onValueChange }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor={theme.textInverse}
        ios_backgroundColor={theme.border}
      />
    </View>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Заголовок */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Настройки</Text>
        <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
          <Text style={styles.doneButtonText}>Готово</Text>
        </TouchableOpacity>
      </View>

      {/* Основные */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ОСНОВНЫЕ</Text>

        <SettingRow
          title="Тёмная тема"
          description="Переключить на тёмную тему оформления"
          value={settings.darkMode}
          onValueChange={toggleDarkMode}
        />
        <SettingRow
          title="Только интранет"
          description="Разрешить только локальные сети и интранет"
          value={settings.intranetOnly}
          onValueChange={toggleIntranetOnly}
        />
        <SettingRow
          title="Ночной режим сайтов"
          description="Инвертировать цвета страниц для комфортного чтения"
          value={settings.nightMode}
          onValueChange={toggleNightMode}
        />
        <SettingRow
          title="Новая вкладка — пустая"
          description={settings.newTabMode === 'blank' ? 'Пустая страница' : 'Главная страница'}
          value={settings.newTabMode === 'blank'}
          onValueChange={(v) => updateSetting('newTabMode', v ? 'blank' : 'home')}
        />
      </View>

      {/* Поисковая система */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ПОИСКОВАЯ СИСТЕМА</Text>
        {searchEngines.map((engine) => (
          <TouchableOpacity
            key={engine.key}
            style={styles.engineItem}
            onPress={() => updateSetting('searchEngine', engine.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.engineName}>{engine.name}</Text>
            {settings.searchEngine === engine.key && (
              <Ionicons name="checkmark" size={20} color={theme.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Синхронизация */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>СИНХРОНИЗАЦИЯ</Text>
        <View style={styles.syncCard}>
          <View style={styles.syncInfo}>
            <Text style={styles.syncTitle}>Синхронизация данных</Text>
            <Text style={styles.syncDesc}>
              Экспортируйте данные на другое устройство или импортируйте ранее сохранённый файл
            </Text>
            {lastSync && (
              <Text style={styles.syncLast}>Последний экспорт: {lastSync}</Text>
            )}
          </View>
          <View style={styles.syncButtons}>
            <TouchableOpacity
              style={[styles.syncButton, isExporting && styles.syncButtonDisabled]}
              onPress={handleExport}
              disabled={isExporting}
              activeOpacity={0.7}
            >
              <Ionicons name="download-outline" size={20} color={theme.textInverse} />
              <Text style={styles.syncButtonText}>
                {isExporting ? 'Экспорт...' : 'Экспорт'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.syncButton, styles.syncButtonImport, isImporting && styles.syncButtonDisabled]}
              onPress={handleImport}
              disabled={isImporting}
              activeOpacity={0.7}
            >
              <Ionicons name="cloud-upload-outline" size={20} color={theme.primary} />
              <Text style={[styles.syncButtonText, { color: theme.primary }]}>
                {isImporting ? 'Импорт...' : 'Импорт'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Данные */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ДАННЫЕ</Text>
        <ActionRow
          title="Очистить историю"
          description="Удалить все записи посещений"
          onPress={handleClearHistory}
        />
        <ActionRow
          title="Очистить загрузки"
          description="Очистить список загрузок"
          onPress={handleClearDownloads}
        />
        <ActionRow
          title="Сбросить все данные"
          description="История, загрузки и закладки"
          destructive
          onPress={handleResetAll}
        />
      </View>

      {/* О приложении */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>О ПРИЛОЖЕНИИ</Text>
        <View style={styles.aboutCard}>
          <View style={styles.aboutLogo}>
            <Ionicons name="globe" size={28} color={theme.primary} />
          </View>
          <Text style={styles.aboutName}>Intra Browser</Text>
          <Text style={styles.aboutVersion}>Версия 1.2</Text>
          <Text style={styles.aboutDesc}>
            Мобильная версия интранет-ориентированного браузера
          </Text>
        </View>
      </View>

      <View style={{ height: insets.bottom + SIZES.paddingXl }} />
    </ScrollView>
  );
}

const makeStyles = (theme, insets) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.backgroundSecondary,
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
    backgroundColor: theme.background,
  },
  headerTitle: {
    fontSize: SIZES.textXl,
    fontWeight: '700',
    color: theme.text,
  },
  doneButton: { padding: SIZES.paddingSm },
  doneButtonText: {
    fontSize: SIZES.textMd,
    color: theme.primary,
    fontWeight: '600',
  },
  section: {
    marginTop: SIZES.paddingMd,
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.border,
  },
  sectionLabel: {
    fontSize: SIZES.textXs,
    fontWeight: '700',
    color: theme.textSecondary,
    letterSpacing: 0.8,
    paddingHorizontal: SIZES.paddingLg,
    paddingTop: SIZES.paddingMd,
    paddingBottom: SIZES.paddingSm,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.paddingLg,
    paddingVertical: SIZES.paddingMd,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
  },
  settingInfo: {
    flex: 1,
    marginRight: SIZES.paddingMd,
  },
  settingTitle: {
    fontSize: SIZES.textMd,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: SIZES.textSm,
    color: theme.textSecondary,
  },
  engineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.paddingLg,
    paddingVertical: SIZES.paddingMd,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
  },
  engineName: {
    fontSize: SIZES.textMd,
    color: theme.text,
  },
  aboutCard: {
    alignItems: 'center',
    padding: SIZES.paddingXl,
    gap: SIZES.paddingXs,
  },
  aboutLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.paddingSm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.07)',
  },
  aboutName: {
    fontSize: SIZES.textXl,
    fontWeight: '700',
    color: theme.text,
  },
  aboutVersion: {
    fontSize: SIZES.textSm,
    color: theme.textSecondary,
  },
  aboutDesc: {
    fontSize: SIZES.textSm,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  syncCard: {
    padding: SIZES.paddingLg,
    borderTopWidth: 1,
    borderTopColor: theme.borderLight,
  },
  syncInfo: {
    marginBottom: SIZES.paddingMd,
  },
  syncButtons: {
    flexDirection: 'row',
    gap: SIZES.paddingSm,
  },
  syncTitle: {
    fontSize: SIZES.textMd,
    fontWeight: '600',
    color: theme.text,
    marginBottom: SIZES.paddingXs,
  },
  syncDesc: {
    fontSize: SIZES.textSm,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  syncLast: {
    fontSize: SIZES.textXs,
    color: theme.textTertiary,
    marginTop: SIZES.paddingXs,
  },
  syncButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.primary,
    paddingVertical: SIZES.paddingSm,
    paddingHorizontal: SIZES.paddingMd,
    borderRadius: SIZES.radiusMd,
    gap: SIZES.paddingXs,
  },
  syncButtonImport: {
    backgroundColor: theme.primaryLight,
    borderWidth: 1,
    borderColor: theme.primary,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    fontSize: SIZES.textSm,
    fontWeight: '600',
    color: theme.textInverse,
  },
});
