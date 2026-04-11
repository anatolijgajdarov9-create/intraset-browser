import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getHistory, clearHistory, removeHistoryEntry } from '../utils/storage';
import * as Haptics from 'expo-haptics';
import { useTabStore } from '../store/tabStore';
import { useTheme } from '../hooks/useTheme';
import { SIZES } from '../utils/theme';

function groupByDate(items) {
  const groups = {};
  items.forEach(item => {
    const key = new Date(item.timestamp).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
}

function HistoryItemRow({ item, onPress, onDelete, styles, theme }) {
  const [faviconError, setFaviconError] = useState(false);

  return (
    <TouchableOpacity
      style={styles.historyItem}
      onPress={() => onPress(item.url)}
      onLongPress={() => onDelete(item)}
      activeOpacity={0.7}
      delayLongPress={400}
    >
      <View style={styles.historyIcon}>
        {item.favicon && !faviconError ? (
          <Image
            source={{ uri: item.favicon }}
            style={styles.favicon}
            onError={() => setFaviconError(true)}
          />
        ) : (
          <View style={styles.faviconPlaceholder}>
            <Text style={styles.faviconText}>
              {item.title?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.historyInfo}>
        <Text style={styles.historyTitle} numberOfLines={1}>
          {item.title || item.url}
        </Text>
        <Text style={styles.historyUrl} numberOfLines={1}>{item.url}</Text>
      </View>
      <Text style={styles.historyTime}>{formatTime(item.timestamp)}</Text>
    </TouchableOpacity>
  );
}

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const days = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (days === 0) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Вчера';
  if (days < 7) return date.toLocaleDateString('ru-RU', { weekday: 'short' });
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
};

export default function HistoryScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, insets), [theme, insets]);
  // useTabStore нужен только через getState() в handleOpen

  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const query = searchQuery.toLowerCase();
    return history.filter(item =>
      item.title?.toLowerCase().includes(query) ||
      item.url?.toLowerCase().includes(query)
    );
  }, [searchQuery, history]);

  const groupedHistory = useMemo(
    () => Object.entries(groupByDate(filteredHistory)),
    [filteredHistory]
  );

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    const data = await getHistory();
    setHistory(data);
  };

  const handleOpen = (url) => {
    // Навигация в текущей вкладке (не открываем новую)
    const { activeTabId, updateTabUrl, setTabHomeOverlay } = useTabStore.getState();
    setTabHomeOverlay(activeTabId, false);
    updateTabUrl(activeTabId, url);
    navigation.goBack();
  };

  const handleDeleteEntry = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Удалить запись?',
      item.title || item.url,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить', style: 'destructive',
          onPress: async () => {
            await removeHistoryEntry(item.id);
            await loadHistory();
          },
        },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Очистить историю?',
      'Все записи будут удалены. Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить', style: 'destructive',
          onPress: async () => {
            await clearHistory();
            await loadHistory();
          },
        },
      ]
    );
  };

  const renderSection = ({ item: [date, items] }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{date}</Text>
      {items.map((item) => (
        <HistoryItemRow
          key={item.id}
          item={item}
          onPress={handleOpen}
          onDelete={handleDeleteEntry}
          styles={styles}
          theme={theme}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Заголовок */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>История</Text>
        <View style={styles.headerButtons}>
          {history.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={handleClearHistory}>
              <Text style={styles.clearButtonText}>Очистить</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneButtonText}>Готово</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Поиск */}
      {history.length > 0 && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color={theme.textTertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Поиск в истории..."
            placeholderTextColor={theme.textTertiary}
            clearButtonMode="while-editing"
          />
        </View>
      )}

      {/* Список */}
      {filteredHistory.length > 0 ? (
        <FlatList
          data={groupedHistory}
          keyExtractor={([date]) => date}
          renderItem={renderSection}
          contentContainerStyle={styles.list}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={64} color={theme.textTertiary} />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'Ничего не найдено' : 'Нет истории'}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'Попробуйте другой запрос'
              : 'Здесь будут отображаться посещённые сайты'}
          </Text>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: SIZES.paddingMd,
    backgroundColor: theme.addressBarBg,
    borderRadius: SIZES.radiusLg,
    borderWidth: 1,
    borderColor: theme.addressBarBorder,
    paddingHorizontal: SIZES.paddingMd,
  },
  searchIcon: { marginRight: SIZES.paddingXs },
  searchInput: {
    flex: 1,
    fontSize: SIZES.textMd,
    color: theme.text,
    paddingVertical: SIZES.paddingMd,
  },
  list: { padding: SIZES.paddingMd },
  section: { marginBottom: SIZES.paddingLg },
  sectionTitle: {
    fontSize: SIZES.textXs,
    fontWeight: '700',
    color: theme.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SIZES.paddingSm,
    paddingHorizontal: SIZES.paddingXs,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SIZES.paddingMd,
    marginBottom: SIZES.paddingXs,
    backgroundColor: theme.backgroundSecondary,
    borderRadius: SIZES.radiusMd,
  },
  historyIcon: { marginRight: SIZES.paddingMd },
  favicon: {
    width: 32,
    height: 32,
    borderRadius: SIZES.radiusMd,
  },
  faviconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: SIZES.radiusMd,
    backgroundColor: theme.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faviconText: {
    fontSize: SIZES.textMd,
    fontWeight: '700',
    color: theme.primary,
  },
  historyInfo: {
    flex: 1,
    marginRight: SIZES.paddingSm,
  },
  historyTitle: {
    fontSize: SIZES.textMd,
    color: theme.text,
    fontWeight: '500',
    marginBottom: 2,
  },
  historyUrl: {
    fontSize: SIZES.textXs,
    color: theme.textSecondary,
  },
  historyTime: {
    fontSize: SIZES.textXs,
    color: theme.textTertiary,
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
