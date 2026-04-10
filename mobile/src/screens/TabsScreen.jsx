import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Image,
} from 'react-native';
import { useTabStore } from '../store/tabStore';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

export default function TabsScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, insets), [theme, insets]);
  const { tabs, activeTabId, switchTab, closeTab, createTab } = useTabStore();

  const handleCloseTab = (tabId, event) => {
    event.stopPropagation();
    if (tabs.length === 1) {
      Alert.alert('Нельзя закрыть', 'Последнюю вкладку нельзя закрыть');
      return;
    }
    closeTab(tabId);
  };

  const handleSelectTab = (tabId) => {
    switchTab(tabId);
    navigation.goBack();
  };

  const handleNewTab = () => {
    createTab('intra://home', 'Новая вкладка');
    navigation.goBack();
  };

  const handleNewPrivateTab = () => {
    createTab('intra://home', 'Приватная вкладка', true);
    navigation.goBack();
  };

  const renderTab = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.tabItem,
        item.id === activeTabId && styles.tabItemActive,
        item.isPrivate && styles.tabItemPrivate,
      ]}
      onPress={() => handleSelectTab(item.id)}
      activeOpacity={0.7}
    >
      {/* Иконка вкладки */}
      <View style={styles.tabIcon}>
        {item.isPrivate ? (
          <Ionicons name="eye-off-outline" size={22} color={theme.private} />
        ) : item.favicon ? (
          <Image source={{ uri: item.favicon }} style={styles.favicon} />
        ) : item.loading ? (
          <Ionicons name="hourglass-outline" size={22} color={theme.primary} />
        ) : (
          <View style={styles.defaultIcon}>
            <Text style={styles.defaultIconText}>
              {item.title?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>

      {/* Информация о вкладке */}
      <View style={styles.tabInfo}>
        <Text
          style={[
            styles.tabTitle,
            item.id === activeTabId && styles.tabTitleActive,
            item.isPrivate && styles.tabTitlePrivate,
          ]}
          numberOfLines={1}
        >
          {item.title || 'Новая вкладка'}
        </Text>
        {item.url && item.url !== 'intra://home' && (
          <Text style={styles.tabUrl} numberOfLines={1}>
            {item.url}
          </Text>
        )}
      </View>

      {/* Активная метка */}
      {item.id === activeTabId && (
        <View style={styles.activeIndicator} />
      )}

      {/* Кнопка закрытия */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={(e) => handleCloseTab(item.id, e)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={18} color={theme.textTertiary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Заголовок */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Вкладки ({tabs.length})</Text>
        <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
          <Text style={styles.doneButtonText}>Готово</Text>
        </TouchableOpacity>
      </View>

      {/* Список вкладок */}
      <FlatList
        data={tabs}
        keyExtractor={(item) => item.id}
        renderItem={renderTab}
        contentContainerStyle={styles.list}
      />

      {/* Кнопки действий */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={handleNewTab}
        >
          <Ionicons name="add" size={20} color={theme.textInverse} style={{ marginRight: 6 }} />
          <Text style={styles.actionButtonText}>Новая вкладка</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.privateButton]}
          onPress={handleNewPrivateTab}
        >
          <Ionicons name="eye-off-outline" size={20} color={theme.private} style={{ marginRight: 6 }} />
          <Text style={[styles.actionButtonText, { color: theme.private }]}>Приватная вкладка</Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: theme.background,
  },
  headerTitle: {
    fontSize: SIZES.textXl,
    fontWeight: '700',
    color: theme.text,
  },
  doneButton: {
    padding: SIZES.paddingSm,
  },
  doneButtonText: {
    fontSize: SIZES.textMd,
    color: theme.primary,
    fontWeight: '600',
  },
  list: {
    padding: SIZES.paddingMd,
    paddingBottom: SIZES.paddingLg,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.paddingMd,
    marginBottom: SIZES.paddingSm,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: SIZES.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tabItemActive: {
    backgroundColor: theme.tabActive,
    borderColor: theme.primary,
  },
  tabItemPrivate: {
    borderColor: theme.privateBorder,
  },
  tabIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SIZES.paddingMd,
  },
  favicon: {
    width: 28,
    height: 28,
    borderRadius: SIZES.radiusMd,
  },
  defaultIcon: {
    width: 28,
    height: 28,
    borderRadius: SIZES.radiusMd,
    backgroundColor: theme.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultIconText: {
    fontSize: SIZES.textMd,
    fontWeight: '700',
    color: theme.primary,
  },
  tabInfo: {
    flex: 1,
    marginRight: SIZES.paddingSm,
  },
  tabTitle: {
    fontSize: SIZES.textMd,
    color: theme.text,
    fontWeight: '500',
    marginBottom: 2,
  },
  tabTitleActive: {
    color: theme.primaryDark,
    fontWeight: '600',
  },
  tabTitlePrivate: {
    color: theme.private,
  },
  tabUrl: {
    fontSize: SIZES.textXs,
    color: theme.textSecondary,
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.primary,
    marginRight: SIZES.paddingSm,
  },
  closeButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: SIZES.radiusMd,
  },
  actions: {
    padding: SIZES.paddingLg,
    paddingBottom: insets.bottom + SIZES.paddingLg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: SIZES.paddingSm,
  },
  actionButton: {
    flexDirection: 'row',
    paddingVertical: SIZES.paddingMd,
    borderRadius: SIZES.radiusLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: theme.primary,
  },
  privateButton: {
    backgroundColor: theme.privateLight,
    borderWidth: 1,
    borderColor: theme.privateBorder,
  },
  actionButtonText: {
    fontSize: SIZES.textMd,
    fontWeight: '600',
    color: theme.textInverse,
  },
});
