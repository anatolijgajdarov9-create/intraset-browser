import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../store/settingsStore';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, insets), [theme, insets]);
  const { settings, updateSetting, toggleDarkMode, toggleIntranetOnly } = useSettingsStore();

  const searchEngines = [
    { key: 'yandex',     name: 'Яндекс',     icon: 'search' },
    { key: 'google',     name: 'Google',     icon: 'search' },
    { key: 'duckduckgo', name: 'DuckDuckGo', icon: 'search' },
    { key: 'bing',       name: 'Bing',       icon: 'search' },
  ];

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

      {/* О приложении */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>О ПРИЛОЖЕНИИ</Text>
        <View style={styles.aboutCard}>
          <View style={styles.aboutLogo}>
            <Ionicons name="globe" size={36} color={theme.primary} />
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
    borderRadius: SIZES.radiusXl,
    backgroundColor: theme.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.paddingSm,
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
});
